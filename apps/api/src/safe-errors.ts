import type { ErrorRequestHandler, RequestHandler } from "express";

/**
 * Last-resort handlers that return the shared error shape and never a stack trace, file path or parser message.
 * Express's default handler prints stack traces (including local file paths) whenever NODE_ENV is not "production".
 * Mount `notFound` and then `safeErrors` after all routes. Found by the threat-model tests (AC-09).
 */
export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ code: "NOT_FOUND", message: "Not found", fieldErrors: {}, requestId: "n/a", retryable: false });
};

export const safeErrors: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) return next(err);
  const status = typeof err?.status === "number" && err.status >= 400 && err.status < 500 ? err.status : 500;
  const message = status === 413 ? "Request too large" : status === 400 ? "Malformed request" : status < 500 ? "Request rejected" : "Something went wrong";
  if (status >= 500) {
    // Operators need to know WHAT failed without the message (which can quote data): error class, SQLSTATE, constraint/table/routine names only.
    const e = (err ?? {}) as { name?: unknown; code?: unknown; constraint?: unknown; table?: unknown; routine?: unknown };
    const pick = (v: unknown) => (typeof v === "string" && /^[A-Za-z0-9_.$-]{1,80}$/.test(v) ? v : undefined);
    console.error(JSON.stringify({ event: "unhandled_error", name: pick(e.name), code: pick(e.code), constraint: pick(e.constraint), table: pick(e.table), routine: pick(e.routine) }));
  }
  res.status(status).json({ code: status >= 500 ? "INTERNAL" : "BAD_REQUEST", message, fieldErrors: {}, requestId: "n/a", retryable: status >= 500 });
};
