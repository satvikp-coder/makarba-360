import express, { type Express } from "express";

export function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store"); // private-by-default
    next();
  });
  app.get("/health", (_req, res) => res.json({ status: "ok", synthetic: true }));
  return app;
}
