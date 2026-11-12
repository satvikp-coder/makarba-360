import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { publicRoutes } from "@makarba/public-ia";
import { Icon, type IconName } from "./Icon.js";
import { strings } from "./i18n.js";
import { DEFAULT_PREFS, usePrefs, type Prefs } from "./prefs.js";
import { ensureAi, useAiBusy } from "./aiStore.js";
import { DEFAULT_END_YEAR, loadForecasts } from "./forecastData.js";
import { Orb } from "./Orb.js";

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
        {options.map((o) => <button key={String(o.v)} type="button" role="radio" aria-checked={value === o.v} aria-pressed={value === o.v} onClick={() => onChange(o.v)}>{o.label}</button>)}
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
  const busy = useAiBusy();
  // Publish the header height so the full-height sheet starts below it and navigation is never covered.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    // On wide screens the header is a vertical side rail and covers nothing above the content.
    const set = () => document.documentElement.style.setProperty("--header-h", `${el.offsetWidth > el.offsetHeight ? el.offsetHeight : 0}px`);
    set();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [rail, setRail] = useState(() => { try { return localStorage.getItem("rail") === "min"; } catch { return false; } });
  useEffect(() => { document.documentElement.classList.toggle("rail-min", rail); try { localStorage.setItem("rail", rail ? "min" : "full"); } catch { /* private mode */ } }, [rail]);
  useEffect(() => { document.documentElement.lang = "en"; }, []);
  // A page change starts at the top with focus on the main region (from #227); in-page links land on their section.
  const previousPath = useRef(loc.pathname);
  useEffect(() => {
    if (loc.hash) { document.getElementById(decodeURIComponent(loc.hash.slice(1)))?.scrollIntoView?.(); return; }
    if (previousPath.current !== loc.pathname) {
      previousPath.current = loc.pathname;
      window.scrollTo?.(0, 0);
      document.getElementById("main")?.focus({ preventScroll: true });
    }
  }, [loc.pathname, loc.hash]);
  useEffect(() => { document.title = `${titleFor(loc.pathname)} – ${t.siteName}`; }, [loc.pathname, t.siteName]);
  // Background AI insights for the default year, started once the page has settled; cached results make this a no-op.
  useEffect(() => {
    // not in tests/automation (each run would start a fresh model generation), and not when the visitor asked to save data
    if (typeof window === "undefined" || /jsdom/i.test(navigator.userAgent) || navigator.webdriver || (navigator as { connection?: { saveData?: boolean } }).connection?.saveData) return;
    const id = window.setTimeout(() => { loadForecasts().then((doc) => ensureAi(doc, DEFAULT_END_YEAR, { background: true })).catch(() => undefined); }, 2500);
    return () => clearTimeout(id);
  }, []);
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
  return (
    <>
      <a className="skip" href="#main">{t.skip}</a>
      <header ref={headerRef}>
        <Link to="/" className="brand"><span className="brand-mark" aria-hidden="true"><Icon name="orbit" size={18} /></span><span className="lbl">{t.siteName}</span></Link>
        <button type="button" className="rail-toggle tb" aria-pressed={rail} aria-label={rail ? "Expand menu" : "Collapse menu"} data-tip={rail ? "Expand menu" : "Collapse menu"} onClick={() => setRail(!rail)}><Icon name={rail ? "chevR" : "chevL"} size={16} /></button>
        <nav aria-label={t.navLabel}>
          <ul>
            {NAV.map((n) => <li key={n.to}><NavLink to={n.to} end={n.end} data-tip={n.tip}><span className="ico" aria-hidden="true"><Icon name={n.icon} /></span><span className="lbl">{n.label}</span></NavLink></li>)}
          </ul>
        </nav>
        <div className="rail-tools">
          <Link to="/forecasts" className="ai-status" data-tip={busy ? "AI insights are being generated in the background" : "AI insights"} aria-label={busy ? "AI insights: generating" : "AI insights"}>
            <Orb state={busy ? "thinking" : "idle"} size={22} /><span className="lbl">{busy ? "Thinking…" : "AI insights"}</span>
          </Link>
          <button type="button" className="rail-btn" onClick={() => setDlg("prefs")} data-tip="Display and accessibility (,)" aria-label="Display and accessibility settings"><Icon name="settings" /><span className="lbl">Display</span></button>
          <button type="button" className="rail-btn" onClick={() => setDlg("keys")} data-tip="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts"><Icon name="keyboard" /><span className="lbl">Shortcuts</span></button>
        </div>
      </header>
      <main id="main" tabIndex={-1} className={loc.pathname === "/explore" ? "main-explore" : "main-content"}>
        <Outlet />
      </main>
      <footer>
        <nav aria-label={t.footerLabel}>
          <ul>
            {LIBRARY.map((l) => <li key={l.to}><Link to={l.to}>{l.label}</Link></li>)}
            {publicRoutes.filter((r) => r.nav === "footer").map((r) => <li key={r.id}><Link to={r.path}>{r.title}</Link></li>)}
          </ul>
        </nav>
        <p className="footer-note">{t.footerNote} <Link to="/research/methodology#prototype-data">About the data</Link></p>
      </footer>
      <Dialog id="prefs" title="Display and accessibility" icon="eye" open={dlg === "prefs"} onClose={() => setDlg(null)}>
        <DisplaySettings prefs={prefs} set={setPrefs} />
      </Dialog>
      <Dialog id="keys" title="Keyboard shortcuts" icon="keyboard" open={dlg === "keys"} onClose={() => setDlg(null)}>
        <ShortcutList />
      </Dialog>
    </>
  );
}
