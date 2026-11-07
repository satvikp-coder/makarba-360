import type { RequestHandler } from "express";

/**
 * Request log with no content: method, route TEMPLATE (e.g. /interviews/:id, never the real URL),
 * status, duration and a validated request id. Query strings, headers, cookies, bodies and
 * parameters never enter the log line, so GPS, answers and session tokens cannot leak into logs.
 */
export function safeRequestLogger(write: (line: string) => void = console.log): RequestHandler {
  return (req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const rid = req.headers["x-request-id"];
      write(JSON.stringify({
        t: new Date().toISOString(),
        method: req.method,
        route: typeof req.route?.path === "string" ? `${req.baseUrl}${req.route.path}` : "unmatched",
        status: res.statusCode,
        ms: Date.now() - start,
        requestId: typeof rid === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(rid) ? rid : undefined,
      }));
    });
    next();
  };
}
