// Apple Foundation Models bridge for Makarba 360's AI insights.
//
// A tiny local HTTP server (127.0.0.1 only, no dependencies) that exposes the on-device Apple Intelligence model to the web app
// through the Vite proxy at /applefm. Nothing leaves the Mac.
//
//   GET  /health    -> {"available": true|false, "reason": "...", "model": "apple-foundation-model"}
//   POST /generate  {"prompt": "...", "json": false, "stream": true}
//                   -> stream: NDJSON lines {"response": "<new text>"} then {"done": true}   (same shape as Ollama)
//                      no stream: {"response": "<full text>"}
//
// Build and run (macOS 26+ with Apple Intelligence enabled):  ./run.sh  (does this automatically)  or
//   swiftc -O tools/applefm/server.swift -o tools/applefm/.build/applefm-server && tools/applefm/.build/applefm-server [port]
import Foundation
import FoundationModels
import Network

let port = NWEndpoint.Port(rawValue: UInt16(CommandLine.arguments.dropFirst().first ?? "11535") ?? 11535)!
let INSTRUCTIONS = "You are a careful urban-planning analyst. Follow the user's format exactly. Never invent numbers."

// Guided generation with a runtime schema (no macros needed, so it builds with the command-line tools): the on-device model can only
// produce this shape, so the JSON is always valid. Icons and anchors must match the web app's fixed lists
// (apps/web/src/aiStore.ts, data/content/anchors.json).
let ICONS = ["building", "home2", "car", "bus", "thermo", "drop", "leaf", "bolt", "users", "coins", "shield", "heart", "wifi", "school", "factory", "haze", "shop", "landmark", "water", "trend", "chart"]
let ANCHOR_IDS = ["corridor", "redevelop", "densify", "solar", "haze", "traffic", "heat", "roza", "lake", "canal", "mill", "market", "junction"]

func highlightsSchema() throws -> GenerationSchema {
    let str = DynamicGenerationSchema(type: String.self)
    let item = DynamicGenerationSchema(name: "Highlight", properties: [
        .init(name: "title", description: "Short title, at most 40 characters", schema: str),
        .init(name: "body", description: "Impact on people's lives and livelihoods in plain words, at most 150 characters, using 'could' or 'may', no numbers", schema: str),
        .init(name: "who", description: "Two or three groups of people most affected, e.g. street vendors, renters, auto drivers", schema: DynamicGenerationSchema(arrayOf: str, minimumElements: 2, maximumElements: 3)),
        .init(name: "right", description: "The right-to-the-city question this raises, at most 90 characters", schema: str),
        .init(name: "icon", schema: DynamicGenerationSchema(name: "Icon", anyOf: ICONS)),
        .init(name: "tone", schema: DynamicGenerationSchema(name: "Tone", anyOf: ["positive", "negative", "mixed"])),
        .init(name: "anchor", description: "Place on the map where this would be most visible", schema: DynamicGenerationSchema(name: "Anchor", anyOf: ANCHOR_IDS)),
        .init(name: "indicators", description: "One or two indicator ids copied exactly from the prompt", schema: DynamicGenerationSchema(arrayOf: str, minimumElements: 1, maximumElements: 2)),
    ])
    let root = DynamicGenerationSchema(name: "Highlights", properties: [
        .init(name: "headline", description: "One-line headline, at most 80 characters", schema: str),
        .init(name: "highlights", description: "Four different impacts on people", schema: DynamicGenerationSchema(arrayOf: item, minimumElements: 4, maximumElements: 4)),
    ])
    return try GenerationSchema(root: root, dependencies: [])
}

func availability() -> (Bool, String) {
    switch SystemLanguageModel.default.availability {
    case .available: return (true, "available")
    case .unavailable(let r): return (false, String(describing: r))
    }
}

func jsonLine(_ obj: [String: Any]) -> Data {
    var d = (try? JSONSerialization.data(withJSONObject: obj)) ?? Data("{}".utf8)
    d.append(0x0A)
    return d
}

final class Conn: @unchecked Sendable {
    let c: NWConnection
    var buf = Data()
    init(_ c: NWConnection) { self.c = c }

    func start() {
        c.start(queue: .global())
        read()
    }

    func read() {
        c.receive(minimumIncompleteLength: 1, maximumLength: 1 << 20) { data, _, done, err in
            if let data { self.buf.append(data) }
            if let req = self.parse() { Task { await self.handle(req) }; return }
            if done || err != nil { self.c.cancel(); return }
            self.read()
        }
    }

    /// Returns (method, path, body) once the headers and the whole body (Content-Length) have arrived.
    func parse() -> (String, String, Data)? {
        guard let end = buf.range(of: Data("\r\n\r\n".utf8)) else { return nil }
        let head = String(decoding: buf[..<end.lowerBound], as: UTF8.self)
        let lines = head.components(separatedBy: "\r\n")
        let first = lines.first?.split(separator: " ") ?? []
        guard first.count >= 2 else { return ("BAD", "", Data()) }
        let len = lines.dropFirst().compactMap { l -> Int? in
            let p = l.split(separator: ":", maxSplits: 1)
            return p.count == 2 && p[0].lowercased() == "content-length" ? Int(p[1].trimmingCharacters(in: .whitespaces)) : nil
        }.first ?? 0
        let bodyStart = end.upperBound
        guard buf.count - bodyStart >= len else { return nil }
        return (String(first[0]), String(first[1]), buf[bodyStart..<(bodyStart + len)])
    }

    func send(_ status: String, _ type: String, _ body: Data, close: Bool = true) {
        var h = Data("HTTP/1.1 \(status)\r\nContent-Type: \(type)\r\nContent-Length: \(body.count)\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n".utf8)
        h.append(body)
        c.send(content: h, completion: .contentProcessed { _ in if close { self.c.cancel() } })
    }

    func chunk(_ d: Data) async {
        var out = Data(String(d.count, radix: 16).utf8); out.append(contentsOf: [13, 10]); out.append(d); out.append(contentsOf: [13, 10])
        await withCheckedContinuation { k in c.send(content: out, completion: .contentProcessed { _ in k.resume() }) }
    }

    func handle(_ r: (String, String, Data)) async {
        let (method, path, body) = r
        if method == "GET" && path.hasPrefix("/health") {
            let (ok, why) = availability()
            return send("200 OK", "application/json", jsonLine(["available": ok, "reason": why, "model": "apple-foundation-model"]))
        }
        guard method == "POST", path.hasPrefix("/generate") else { return send("404 Not Found", "application/json", jsonLine(["error": "not found"])) }
        guard availability().0 else { return send("503 Service Unavailable", "application/json", jsonLine(["error": availability().1])) }
        let req = (try? JSONSerialization.jsonObject(with: body)) as? [String: Any] ?? [:]
        guard let prompt = req["prompt"] as? String, !prompt.isEmpty else { return send("400 Bad Request", "application/json", jsonLine(["error": "prompt required"])) }
        let wantsJSON = req["json"] as? Bool ?? false
        let schema = req["schema"] as? String
        let stream = req["stream"] as? Bool ?? false
        // Analysing displacement, eviction or inequality is ordinary social-science work; the permissive guardrail mode avoids false
        // "sensitive content" refusals on such prompts (Apple still applies its safety checks).
        let model = SystemLanguageModel(guardrails: .permissiveContentTransformations)
        let session = LanguageModelSession(model: model, instructions: INSTRUCTIONS + (wantsJSON ? " Reply with one JSON object only, no prose, no code fences." : ""))
        let options = GenerationOptions(temperature: wantsJSON ? 0.2 : 0.3)
        do {
            if schema == "highlights" {
                let res = try await session.respond(to: prompt, schema: try highlightsSchema(), options: options)
                return send("200 OK", "application/json", jsonLine(["response": res.content.jsonString]))
            }
            if !stream {
                let res = try await session.respond(to: prompt, options: options)
                return send("200 OK", "application/json", jsonLine(["response": res.content]))
            }
            let head = Data("HTTP/1.1 200 OK\r\nContent-Type: application/x-ndjson\r\nTransfer-Encoding: chunked\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n".utf8)
            await withCheckedContinuation { k in c.send(content: head, completion: .contentProcessed { _ in k.resume() }) }
            var sent = ""
            // the stream yields cumulative snapshots; forward only the new text
            for try await snap in session.streamResponse(to: prompt, options: options) {
                let text = snap.content
                if text.count > sent.count, text.hasPrefix(sent) {
                    await chunk(jsonLine(["response": String(text.dropFirst(sent.count))]))
                } else if text != sent {
                    await chunk(jsonLine(["response": text, "replace": true]))
                }
                sent = text
            }
            await chunk(jsonLine(["done": true]))
            c.send(content: Data("0\r\n\r\n".utf8), completion: .contentProcessed { _ in self.c.cancel() })
        } catch {
            send("500 Internal Server Error", "application/json", jsonLine(["error": String(describing: error)]))
        }
    }
}

let params = NWParameters.tcp
params.requiredLocalEndpoint = NWEndpoint.hostPort(host: "127.0.0.1", port: port)   // loopback only
let listener = try NWListener(using: params)
listener.newConnectionHandler = { Conn($0).start() }
listener.stateUpdateHandler = { s in if case .ready = s { print("Apple Foundation Models bridge on http://127.0.0.1:\(port) (\(availability().1))") } }
listener.start(queue: .main)
dispatchMain()
