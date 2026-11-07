# Public UX and wireframes

Planning baseline: 2026-11-07. Proposed design; no participant collection or product implementation has occurred.

Implement screens P01–P13 in the inventory. Main navigation: Explore, Then & Now, Community Voices, Urban Insights, Research. Search/layers use URL state with privacy-safe filters; no raw interview parameter. Place selection announces name and moves focus only on explicit details action; closing returns focus to marker/list item.

```text
DESKTOP ≥1200
+-----------------------------------------------------------+
| MAKARBA 360 | Explore | Then & Now | Insights | Research    |
+-------------+---------------------------+-----------------+
| Search      |                           | Name / category |
| Layers      |       INTERACTIVE MAP     | Photos / dates  |
| Categories  |       selected feature    | Evidence tabs   |
| List toggle |                           | Safe findings   |
+-------------+--attribution / zoom-------+-----------------+
MOBILE
+---------------------------+
| Search        Layers      |
|           MAP       + / - |
|                           |
| attribution               |
| [Place name   Expand]     |
| [sheet content / collapse]|
+---------------------------+
```

Home uses a permitted image and clear research purpose. Then & Now offers slider plus side-by-side and text descriptions; date/source/evidence quality visible beside each image. Panorama opens on demand with static fallback and source date. Voices labels quotation, recollection, analyst theme and verified evidence separately. Insights shows valid n, excluded/missing/unsure, period and sample caveat next to chart, not only in footer. Guided story has ordered stops and accessible list; no invented route. Sources/credits and accessibility/language settings always reachable. Empty research findings explain collection status; demo fixtures are unmistakably synthetic and not mixed with production.

## Public shell implementation (issue #72)

`apps/web` is the React/Vite public app. Run it with the synthetic API: `pnpm dev:mock` (port 4010) and `pnpm --filter @makarba/web dev`; build with `pnpm --filter @makarba/web build`.

- **Routes** come from `@makarba/public-ia`; pages not yet built (everything except Home and the Explore list) show an honest "being built" page, never invented content. Unknown paths return a not-found page.
- **Navigation:** skip link, labelled main navigation (Explore, Then & Now, Community Voices, Urban Insights, Research), footer links to Sources and Accessibility, one `h1` per page, per-route document title, 44px targets, visible focus, reduced-motion support.
- **Language shell:** English is active. Gujarati and Hindi are listed but disabled and labelled "translation pending review" until a human reviewer approves them (no machine-only translation); `html lang` stays `en`.
- **List alternative:** `/explore` lists published places from `GET /api/v1/public/locations`, validated against `@makarba/contracts` before use. Distinct states: loading, empty ("No places have been published yet."), error (with retry only if retryable) and invalid payload (treated as an error, never rendered). Datasets flagged synthetic are labelled "Demonstration data".
- **No survey entry:** no route, link, form or input for survey submission, interview, login or admin exists in the public app; tests check every public route and the 404 path. The built bundle passes `scan_secrets.py --bundle` (its only "interview/survey" strings are the contract's forbidden-field deny list).
- **Privacy:** the client calls only the public API with `credentials: "omit"`, receives only allowlisted DTO fields, and holds no private IDs, coordinates or original media.
- **Tests (10, jsdom + axe-core):** navigation/language/footer, disabled unreviewed languages, no survey route across all routes, 404, axe (no violations; colour-contrast is checked via the token tests because jsdom cannot compute it), list states and contract-violation rejection.
- **Limitations:** no real-browser or screen-reader testing yet (#82, #114, #117); the map is #74; live backend integration waits for Developer A's public API.

## Public map explorer (issue #74)

`/explore` is the map explorer: MapLibre map plus the full place list and a details panel.

- **Browse:** published, contract-validated features only. Points cluster (50px radius up to zoom 14; clicking a cluster zooms to expand it); lines and polygons are not clustered. The view fits the data bounds on load. Cluster size is shown by circle size; the exact number is available in the list because map glyph text is not loaded.
- **Stable URL state:** the selected place is `?place=<public feature id>` and is written by both map clicks and list buttons. It survives reload, sharing and browser back/forward (each selection is a history entry). Only allowlisted keys pass `sanitizeQuery`; `interview`, `gps`, `lat` and similar keys are dropped.
- **Details panel:** name and category from the public DTO, with a "Clear selection" control. A `place` id that is not in the published list (unpublished, withdrawn or mistyped) shows "That place was not found" and no details; it never falls back to cached or draft data.
- **Fallback and states:** loading, empty, error/retry, invalid payload (not rendered) and map-unavailable (list remains the full alternative) as in #25/#72.
- **Privacy:** the only request is `GET /api/v1/public/locations`; the map has exactly one data source (`places`) built from that response. A test asserts that no request URL contains interview, GPS, participant or private terms and that the map registers no other source, even when such parameters appear in the page URL.
- **Tests:** 22 web tests pass (13 shell/list/explorer, 7 MapView incl. cluster zoom and bounds, plus axe). Limitations: map rendering is verified only against a mocked MapLibre; real-browser rendering, tile loading and touch behaviour are tracked in #82 and #117 and are not claimed here. Category layer toggles (#75), search (#76) and profile pages (#77) are separate issues.

## Evidence-led home page (issue #73)

`apps/web/src/Home.tsx`. Sections in reading order: hero (identity, one-line purpose, **Explore the map** action) → About this atlas (researcher-led collection, no public submissions, methodology link) → Featured places → Then & Now → Community Voices.

- **Featured places:** up to four published places from the public locations endpoint, each linking to `/explore?place=<id>`. Loading, empty ("No places have been published yet.") and error states are announced in a polite live region. Datasets flagged synthetic are labelled "Demonstration data".
- **Hero media:** a single approved image slot (`APPROVED_HERO`, currently **none**). With no approved image, or one missing a date, credit or licence, an `https:`/same-origin-only source, or one that fails to load, the page shows an honest typographic panel (labelled for assistive technology as having no approved photograph). Approved images show date, credit and licence in a caption. No stock or invented picture is used.
- **No fabricated findings:** Then & Now and Community Voices are introductions only; the page contains no counts, percentages, ratings or quotations (tested). Findings appear on their own pages only when approved aggregated data exists.
- **Tests (8):** structure and links, featured places from the contract, no numbers/findings, empty/error states, fallback with no `<img>`, approved/unsafe/incomplete/failed hero media, axe.
- **Limitations:** no approved hero photograph exists yet (needs rights-cleared media, see the human-action list, H9); responsive visual layout is checked in a real browser under #82.
