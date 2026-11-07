import { Link } from "react-router-dom";
import { strings } from "./i18n.js";

/** One safe not-found page for unknown, unpublished and withdrawn content: it never says which, and shows no name or preview. */
export function NotFound() {
  return <section aria-labelledby="nf"><h1 id="nf">{strings.en.notFound}</h1><p>This page does not exist or is not published.</p><p><Link to="/">{strings.en.siteName}</Link> · <Link to="/explore">{strings.en.homeCta}</Link></p></section>;
}
