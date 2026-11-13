import { Suspense, lazy, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { publicRoutes } from "@makarba/public-ia";
import { Icon, type IconName } from "./Icon.js";
import { strings } from "./i18n.js";
import { DEFAULT_PREFS, usePrefs, type Prefs } from "./prefs.js";
import { MapProvider } from "./mapCtx.js";
import { PageTransition } from "./Transition.js";
import { Preloader } from "./Preloader.js";

// The 3D stage (map, time dock, lenses, AI dock) loads after the first paint and then stays mounted across pages.
const Stage = lazy(() => import("./Stage.js"));
const IN_TESTS = typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent);

/** True while the visitor is typing, so single-key shortcuts never steal letters from a form field. */
export const isTyping = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) && (t as HTMLInputElement).type !== "range";
};
/** Shortcut keys are ignored with Ctrl/Cmd/Alt so browser and screen-reader shortcuts keep working. */
export const plainKey = (e: KeyboardEvent) => !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping(e);

export const SHORTCUTS: { group: string; keys: string[]; what: string }[] = [
  { group: "Anywhere", keys: ["1"], what: "Overview" },
  { group: "Anywhere", keys: ["2"], what: "Explore the 3D map" },
  { group: "Anywhere", keys: ["3"], what: "Outlook (forecasts and AI insights)" },
  { group: "Anywhere", keys: [","], what: "Display and accessibility settings" },
  { group: "Anywhere", keys: ["?"], what: "This list of shortcuts" },
  { group: "Explore", keys: ["/"], what: "Search places" },
  { group: "Explore", keys: ["[", "]"], what: "Previous / next place" },
  { group: "Explore", keys: ["F"], what: "Switch Today / Future scenario" },
  { group: "Explore", keys: ["P"], what: "Play the future year by year" },
  { group: "Explore", keys: ["T"], what: "Start or end the tour" },
  { group: "Explore", keys: ["←", "→"], what: "Previous / next tour stop or highlight" },
  { group: "Explore", keys: ["H"], what: "Highlights camera on or off (future scenario)" },
  { group: "Explore", keys: ["C"], what: "360° camera" },
  { group: "Explore", keys: ["L"], what: "Cycle light: dawn, day, dusk, night" },
  { group: "Explore", keys: ["B"], what: "3D buildings on or off" },
  { group: "Explore", keys: ["M"], what: "Pause or play map motion" },
  { group: "Explore", keys: ["R"], what: "Reset the view" },
  { group: "Explore", keys: ["+", "−"], what: "Zoom in / out" },
  { group: "Explore", keys: ["Q", "E"], what: "Rotate left / right" },
  { group: "Explore", keys: ["W", "S"], what: "Tilt up / down" },
  { group: "Explore", keys: ["Esc"], what: "Stop the camera, tour or selection" },
  { group: "Map focused", keys: ["↑", "↓", "←", "→"], what: "Pan the map (after clicking or tabbing into it)" },
];

const NAV: { to: string; label: string; icon: IconName; tip: string; end?: boolean }[] = [
  { to: "/", label: "Overview", icon: "home", tip: "Overview (1)", end: true },
  { to: "/explore", label: "Explore", icon: "map", tip: "Explore the 3D map (2)" },
  { to: "/forecasts", label: "Outlook", icon: "trend", tip: "Outlook: forecasts and AI insights (3)" },
];
/** The reading pages live on the Overview and in the footer rather than in the rail. */
export const LIBRARY: { to: string; label: string; icon: IconName; blurb: string }[] = [
  { to: "/stories/index", label: "Then & Now", icon: "history", blurb: "Places compared across time, with dates and sources." },
  { to: "/voices", label: "Community Voices", icon: "voices", blurb: "Stories from people who use Makarba's streets and spaces." },
  { to: "/insights", label: "Urban Insights", icon: "insights", blurb: "Privacy-safe survey figures, group by group." },
  { to: "/research/methodology", label: "Research", icon: "research", blurb: "How the research is done and how to read the figures." },
];

function Dialog({ id, title, icon, open, onClose, children }: { id: string; title: string; icon: IconName; open: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    // engines without showModal (older browsers, jsdom) still get an open, non-modal dialog
    if (open && !d.open) { if (typeof d.showModal === "function") { try { d.showModal(); } catch { d.setAttribute("open", ""); } } else d.setAttribute("open", ""); }
    if (!open && d.open) { if (typeof d.close === "function") d.close(); else d.removeAttribute("open"); }
  }, [open]);
  return (
    <dialog ref={ref} className="sheet-dialog" aria-labelledby={`${id}-h`} onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      <div className="dlg-head">
        <h2 id={`${id}-h`}><Icon name={icon} /> {title}</h2>
        <button type="button" className="tb" aria-label="Close" onClick={onClose}><Icon name="close" /></button>
      </div>
      {open && children}
    </dialog>
  );
}

function Choice<T extends string | number>({ label, icon, value, options, onChange }: { label: string; icon: IconName; value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset className="pref">
      <legend><Icon name={icon} size={16} /> {label}</legend>
      <div className="seg-tabs" role="radiogroup" aria-label={label}>
        {options.map((o) => <button key={String(o.v)} type="button" role="radio" aria-checked={value === o.v} onClick={() => onChange(o.v)}>{o.label}</button>)}
      </div>
    </fieldset>
  );
}

function Toggle({ label, icon, hint, on, onChange }: { label: string; icon: IconName; hint: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="pref pref-toggle">
      <span><Icon name={icon} size={16} /> <b>{label}</b><small>{hint}</small></span>
      <input type="checkbox" role="switch" checked={on} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function DisplaySettings({ prefs, set }: { prefs: Prefs; set: (p: Partial<Prefs>) => void }) {
  return (
    <div className="prefs">
      <Choice label="Contrast" icon="contrast" value={prefs.contrast} onChange={(v) => set({ contrast: v })} options={[{ v: "standard", label: "Standard" }, { v: "high", label: "High" }]} />
      <Choice label="Colours" icon="palette" value={prefs.palette} onChange={(v) => set({ palette: v })} options={[{ v: "standard", label: "Standard" }, { v: "cvd", label: "Colour-blind safe" }]} />
      <Choice label="Text size" icon="text" value={prefs.text} onChange={(v) => set({ text: v })} options={[{ v: 100, label: "A" }, { v: 115, label: "A+" }, { v: 130, label: "A++" }, { v: 150, label: "A+++" }]} />
      <Choice label="Motion" icon="motion" value={prefs.motion} onChange={(v) => set({ motion: v })} options={[{ v: "system", label: "Follow device" }, { v: "reduce", label: "Reduce" }]} />
      <Choice label="Map detail" icon="cube" value={prefs.detail} onChange={(v) => set({ detail: v })} options={[{ v: "auto", label: "Auto" }, { v: "high", label: "High" }, { v: "low", label: "Low" }]} />
      <Toggle label="Readable text" icon="eye" hint="Wider letter and line spacing, plainer font" on={prefs.readable} onChange={(v) => set({ readable: v })} />
      <Toggle label="Underline links" icon="link" hint="Every link is underlined" on={prefs.underline} onChange={(v) => set({ underline: v })} />
      <p className="pref-foot"><button type="button" onClick={() => set(DEFAULT_PREFS)}>Reset to defaults</button> <Link to="/accessibility">Accessibility statement</Link></p>
    </div>
  );
}

export function ShortcutList() {
  const groups = [...new Set(SHORTCUTS.map((s) => s.group))];
  return (
    <div className="shortcuts">
      {groups.map((g) => (
        <section key={g} aria-labelledby={`sc-${g}`}>
          <h3 id={`sc-${g}`}>{g}</h3>
          <dl>{SHORTCUTS.filter((s) => s.group === g).map((s) => <div key={s.what}><dt>{s.keys.map((k) => <kbd key={k}>{k}</kbd>)}</dt><dd>{s.what}</dd></div>)}</dl>
        </section>
      ))}
    </div>
  );
}

function titleFor(path: string): string {
  if (path === "/forecasts") return "Outlook";
  if (path === "/stories/index") return "Then & Now";
  const route = publicRoutes.find((r) => !r.path.includes(":") && r.path === path);
  return route?.title ?? "Makarba 360°";
}

export function Layout() {
  const t = strings.en;
  const headerRef = useRef<HTMLElement>(null);
  const loc = useLocation();
  const nav = useNavigate();
  const [prefs, setPrefs] = usePrefs();
  const [dlg, setDlg] = useState<null | "prefs" | "keys">(null);
  const libRef = useRef<HTMLDetailsElement>(null);
  // the Library menu closes on navigation, on Escape and on a click elsewhere
  useEffect(() => { if (libRef.current) libRef.current.open = false; }, [loc.pathname]);
  useEffect(() => {
    const close = (e: Event) => { const d = libRef.current; if (d?.open && (e.type === "keydown" ? (e as KeyboardEvent).key === "Escape" : !d.contains(e.target as Node))) d.open = false; };
    document.addEventListener("click", close); document.addEventListener("keydown", close);
    return () => { document.removeEventListener("click", close); document.removeEventListener("keydown", close); };
  }, []);
  // Publish where the floating top bar ends so a full-height sheet never covers navigation.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty("--header-h", `${Math.round(el.getBoundingClientRect().bottom)}px`);
    set();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => { document.documentElement.lang = "en"; }, []);
  // A page change focuses the main region; in-page links land on their section.
  const previousPath = useRef(loc.pathname);
  useEffect(() => {
    if (loc.hash) {
      // the target may live in a page that is still loading: look for it for up to ~3 s
      const id = decodeURIComponent(loc.hash.slice(1));
      let raf = 0, tries = 0;
      const find = () => { const el = document.getElementById(id); if (el) el.scrollIntoView?.(); else if (tries++ < 180) raf = requestAnimationFrame(find); };
      find();
      return () => cancelAnimationFrame(raf);
    }
    if (previousPath.current !== loc.pathname) {
      previousPath.current = loc.pathname;
      document.getElementById("main")?.scrollTo?.(0, 0);
      document.getElementById("main")?.focus({ preventScroll: true });
    }
  }, [loc.pathname, loc.hash]);
  // place pages name the place in their own titles once loaded
  useEffect(() => { if (!loc.pathname.startsWith("/places/")) document.title = `${titleFor(loc.pathname)} – ${t.siteName}`; }, [loc.pathname, t.siteName]);
  // Global shortcuts.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (!plainKey(e) || document.querySelector("dialog[open]")) return;
      if (e.key === "1") nav("/"); else if (e.key === "2") nav("/explore"); else if (e.key === "3") nav("/forecasts");
      else if (e.key === "?") setDlg("keys"); else if (e.key === ",") setDlg("prefs"); else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [nav]);
  const page = loc.pathname === "/" ? "home" : loc.pathname === "/explore" ? "explore" : loc.pathname === "/forecasts" ? "outlook" : "reader";
  return (
    <MapProvider>
      <a className="skip" href="#main">{t.skip}</a>
      <PageTransition />
      <Preloader />
      <header ref={headerRef} className="topbar glass">
        <Link to="/" className="brand" data-tip="Makarba 360° home"><span className="brand-mark" aria-hidden="true"><Icon name="orbit" size={17} /></span><span className="lbl">{t.siteName}</span></Link>
        <nav aria-label={t.navLabel}>
          <ul>
            {NAV.map((n) => <li key={n.to}><NavLink to={n.to} end={n.end} data-tip={n.tip}><Icon name={n.icon} size={16} /><span className="lbl">{n.label}</span></NavLink></li>)}
          </ul>
        </nav>
        <details className="tb-menu" ref={libRef}>
          <summary data-tip="Then & Now, Voices, Insights, Research"><Icon name="layers" size={16} /><span className="lbl">Library</span></summary>
          <nav aria-label={t.footerLabel} className="tb-menu-list glass">
            <ul>
              {LIBRARY.map((l) => <li key={l.to}><Link to={l.to}><Icon name={l.icon} size={16} />{l.label}</Link></li>)}
              {publicRoutes.filter((r) => r.nav === "footer").map((r) => <li key={r.id}><Link to={r.path}><Icon name={r.path.includes("access") ? "eye" : "link"} size={16} />{r.title}</Link></li>)}
            </ul>
          </nav>
        </details>
        <div className="tb-tools">
          <button type="button" className="icon-btn" onClick={() => setDlg("prefs")} data-tip="Display and accessibility (,)" aria-label="Display and accessibility settings"><Icon name="settings" size={17} /></button>
          <button type="button" className="icon-btn" onClick={() => setDlg("keys")} data-tip="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts"><Icon name="keyboard" size={17} /></button>
        </div>
      </header>
      <main id="main" tabIndex={page === "reader" ? 0 : -1} className={`main main-${page}`} key={page === "reader" ? loc.pathname : page}>
        <Outlet />
      </main>
      <footer className="credits">
        <p>© 2026 Varun Karthic and Satvik Patel</p>
        <Link to="/research/methodology#prototype-data">About the data</Link>
      </footer>
      {/* after the page in the DOM so keyboard users reach the page first; it sits behind everything visually */}
      {!IN_TESTS && <Suspense fallback={<div className="stage stage-loading" aria-hidden="true" />}><Stage /></Suspense>}
      <Dialog id="prefs" title="Display and accessibility" icon="eye" open={dlg === "prefs"} onClose={() => setDlg(null)}>
        <DisplaySettings prefs={prefs} set={setPrefs} />
      </Dialog>
      <Dialog id="keys" title="Keyboard shortcuts" icon="keyboard" open={dlg === "keys"} onClose={() => setDlg(null)}>
        <ShortcutList />
      </Dialog>
    </MapProvider>
  );
}
