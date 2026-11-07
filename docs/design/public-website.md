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
