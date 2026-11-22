import { Link } from "react-router-dom";
import { Icon } from "../Icon.js";
import "./past.css";

/** One thread through the whole site: Past (documented), Present (observed and lived), Future (projections and plans). */
export function EraNav({ current }: { current: "past" | "present" | "future" }) {
  const items = [
    { id: "past", to: "/past", label: "Past", sub: "documented change" },
    { id: "present", to: "/explore?place=sarkhej-roza-area", label: "Present", sub: "observed today" },
    { id: "future", to: "/forecasts", label: "Future", sub: "projections and plans" },
  ] as const;
  return (
    <nav className="era-nav" aria-label="Past, present and future">
      {items.map((i, n) => (
        <span key={i.id} className="era-step">
          {n > 0 && <Icon name="chevR" size={14} />}
          <Link to={i.to} aria-current={i.id === current ? "page" : undefined}><b>{i.label}</b><small>{i.sub}</small></Link>
        </span>
      ))}
    </nav>
  );
}

