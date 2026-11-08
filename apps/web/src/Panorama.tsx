import { useEffect, useRef, useState } from "react";
import { formatDated, type MediaData } from "./api.js";
import { safeImageUrl } from "./Gallery.js";

type Phase = "idle" | "loading" | "ready" | "failed";

/** Largest texture the GPU accepts, or null when WebGL cannot be created at all. */
export function maxTextureSize(): number | null {
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl") ?? c.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return null;
    const n = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return typeof n === "number" && n > 0 ? n : null;
  } catch { return null; }
}

/** Why the interactive view cannot be offered, or null if it can. Pure so it is testable without a GPU. */
export function panoramaBlocker(m: MediaData, maxTex: number | null): string | null {
  if (m.format !== "equirectangular") return "This image is not a 360° panorama.";
  if (!safeImageUrl(m.url)) return "The 360° image is unavailable.";
  if (maxTex === null) return "Interactive 360° view needs WebGL, which is not available on this device.";
  if (m.width > maxTex) return "This panorama is too large for this device's graphics memory.";
  return null;
}

/**
 * Owned panorama (#69). The static approved photograph with date, credit and licence is always shown first; the
 * Pannellum viewer is only fetched and started when the visitor asks for it, so the place page never waits on or
 * depends on WebGL. Any failure leaves the static photograph and caption in place. The viewer is destroyed on close/unmount.
 */
export function Panorama({ media, loadViewer }: { media: MediaData; loadViewer?: () => Promise<void> }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [reason, setReason] = useState<string | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<PannellumViewer | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; viewer.current?.destroy(); viewer.current = null; }; }, []);

  const fallback = media.staticFallbackUrl && safeImageUrl(media.staticFallbackUrl) ? media.staticFallbackUrl : null;
  const caption = `${formatDated(media.capturedDate)} · ${media.credit} · ${media.licence}`;
  const fail = (why: string) => { viewer.current?.destroy(); viewer.current = null; if (alive.current) { setReason(why); setPhase("failed"); } };

  async function start() {
    const blocked = panoramaBlocker(media, maxTextureSize());
    if (blocked) return fail(blocked);
    setPhase("loading"); setReason(null);
    try {
      await (loadViewer ? loadViewer() : (async () => { await import("pannellum/build/pannellum.css"); await import("pannellum/build/pannellum.js"); })());
      if (!alive.current) return;
      const api = window.pannellum;
      if (!api || !host.current) return fail("The 360° viewer could not be started.");
      const v = api.viewer(host.current, {
        type: "equirectangular", panorama: media.url, crossOrigin: "anonymous", autoLoad: true, showControls: true, keyboardZoom: true,
        mouseZoom: false, // page scrolling must not be hijacked by the wheel
        hfov: 100, compass: false, showFullscreenCtrl: true, strings: { loadButtonLabel: "Load panorama", loadingLabel: "Loading panorama…", bylineLabel: "" },
      });
      viewer.current = v;
      v.on("load", () => { if (alive.current) setPhase("ready"); });
      v.on("error", (msg: unknown) => fail(typeof msg === "string" && /webgl/i.test(msg) ? "Interactive 360° view needs WebGL, which is not available on this device." : "The 360° image could not be loaded."));
    } catch { fail("The 360° viewer could not be loaded."); }
  }
  function stop() { viewer.current?.destroy(); viewer.current = null; setPhase("idle"); setReason(null); }

  const interactive = phase === "loading" || phase === "ready";
  return (
    <figure className="panorama">
      <div ref={host} className="pano-host" hidden={!interactive} role="group" aria-label={`360° view: ${media.alt}. Use arrow keys to look around, plus and minus to zoom.`} />
      {phase === "loading" && <p role="status">Loading 360° view…</p>}
      {!interactive && (fallback
        ? <img src={fallback} alt={media.alt} loading="lazy" referrerPolicy="no-referrer" draggable={false} onError={() => setReason((r) => r ?? "The photograph could not be loaded.")} />
        : <p>No still photograph is available for this panorama.</p>)}
      <figcaption>
        {caption}
        {phase === "failed" && reason && <><br /><span role="status">{reason} The still photograph above is shown instead.</span></>}
      </figcaption>
      <p>
        {!interactive && <button type="button" onClick={start}>Explore in 360°</button>}
        {interactive && <button type="button" onClick={stop}>Close 360° view</button>}
      </p>
    </figure>
  );
}
