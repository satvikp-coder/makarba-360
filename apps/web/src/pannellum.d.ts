declare module "pannellum/build/pannellum.js";
declare module "pannellum/build/pannellum.css";
interface PannellumViewer { destroy(): void; on(event: string, cb: (...a: unknown[]) => void): void }
interface Window { pannellum?: { viewer(el: HTMLElement, cfg: Record<string, unknown>): PannellumViewer } }
