import { Link } from "react-router-dom";
import { strings } from "./i18n.js";

/**
 * Small, calm disclosure on survey-derived items (places, stories, figures) when the served dataset is not an approved publication.
 * A native disclosure widget: keyboard and screen-reader operable, no script, and the text is always in the document.
 */
export function DataNote() {
  return (
    <details className="data-note">
      <summary><span aria-hidden="true">ⓘ</span> About this example data</summary>
      <p>{strings.en.synthetic} <Link to="/research/methodology#prototype-data">How this prototype works</Link></p>
    </details>
  );
}
