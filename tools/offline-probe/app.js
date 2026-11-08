import { buildReport, clearAll, runAll } from "./probe.js";

const out = document.getElementById("out");
let last = [];

function render(results) {
  out.replaceChildren(...results.map((r) => {
    const d = document.createElement("div");
    d.className = `r ${r.status}`;
    const h = document.createElement("strong");
    h.textContent = `${r.status.toUpperCase()}: ${r.title}`;
    const p = document.createElement("div");
    p.textContent = r.detail;               // textContent: results can contain browser-supplied strings
    d.append(h, p);
    return d;
  }));
}

document.getElementById("ctx").textContent = `${self.isSecureContext ? "Secure context (required for storage, crypto and service workers)." : "NOT a secure context: crypto and service workers will not work. Open over HTTPS or localhost."} ${navigator.userAgent}`;
if (new URLSearchParams(location.search).has("sw")) document.getElementById("sw-line").textContent = "served from the service worker cache";

document.getElementById("run").addEventListener("click", async () => { last = await runAll(); window.__probeResults = last; render(last); });
document.getElementById("clear").addEventListener("click", async () => { await clearAll(); last = []; render([]); });
document.getElementById("dl").addEventListener("click", () => {
  const report = buildReport(last, document.getElementById("notes").value);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
  a.download = `offline-probe-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

fetch(location.href, { cache: "no-store" }).then((r) => { if (r.headers.get("x-served-from") === "service-worker-cache") document.getElementById("sw-line").textContent = "served from the service worker cache"; }).catch(() => {});
