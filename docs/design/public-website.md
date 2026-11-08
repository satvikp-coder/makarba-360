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

## Location profile pages (issue #77)

`/places/:slug` is one reusable template (`apps/web/src/Profile.tsx`); no place is hand-coded. Data comes only from the public contract: the published locations list (to resolve the slug), `/locations/:slug/history` and `/media/:id`, each validated by `@makarba/contracts` before rendering (an invalid payload is shown as an error, never partially).

| Section | With data | Without data |
|---|---|---|
| Header | name, category, geometry kind (point/line/area), "Show on the map" link, "Demonstration data" label for synthetic fixtures | – |
| Description | not in the current public DTO | "No approved description has been published yet." (a description field is requested from Developer A / #63-#64) |
| History | events with precision-aware date, text, evidence type and the cited source | "No verified history has been published yet."; a failed load says "History could not be loaded." |
| Photographs | https-only images with alt text, date, credit and licence | "No approved photographs yet."; an unavailable one says so, no broken image |
| Then & Now | shown only when the API supplies a comparison pair; dates and evidence quality shown, link to the comparison | section absent |
| Community findings | none yet | plain statement; no count is invented and a missing value is never shown as zero |
| Sources | citation, licence, verification state, https link with `rel="noopener noreferrer"` | "No sources listed yet." |

Dates use `formatDated`: unknown shows "Date unknown", and a year stays "2021 (year)" – it is never promoted to an exact date.

**Unpublished / withdrawn places:** if the slug is not in the current published list the page renders the same generic not-found page as any unknown URL, makes no history or media request, and shows no name or preview. Page state is keyed by slug so one place can never display another's content, and profile requests use `cache: "no-store"` so a withdrawn place is not revived from a browser cache. Whether the server also sends `Cache-Control: no-store`/404 for withdrawn places is Developer A's side (#81) and is tested at integration.

**Deviation from the #17 spec:** sections are stacked with headings rather than ARIA tabs/accordion; the reading order is the same. Tabs can be layered on later without changing the data flow.

Tests: 11 profile tests (published, missing data, unknown/withdrawn, list-removed, history 404/empty/503, contract-violating payload, unavailable media, public-endpoints-only, Then & Now gating, axe, date formatting). Limitations: tested against the synthetic mock contract only – live integration needs Developer A (#81, #64); panorama (#69, #79), gallery (#78) and the Then & Now component (#68) are separate issues.

## Responsive map journeys and real-browser tests (issue #82)

**Layout (`/explore`).** At >=768px the map and one side panel (places list plus selected-place details, 320px) are always visible; the sheet buttons are hidden. Below 768px the same panel is a bottom sheet: *peek* 112px (title plus Expand), *half* 50dvh, *full* from the sticky header down (`--header-h` is measured, so the sheet can never cover the navigation). Expand/Collapse/Close are real buttons (44px targets, `aria-expanded`); Escape returns to peek; selecting a place opens the sheet to half; the map attribution stays outside the sheet. The header is sticky and its navigation wraps rather than hiding. Safe-area padding is applied to the sheet.

**Real-browser tests** (`pnpm --filter @makarba/web test:e2e`, Playwright + Chromium headless, own CI job `browser`; mock API and Vite started automatically; basemap tiles are stubbed so no external network is used). The responsive-map suite checks that the real MapLibre canvas and attribution render; place selection survives URL, back/forward and reload; only the public locations endpoint is requested; WebGL failure preserves the list; keyboard selection works; and the mobile sheet supports peek/expand/collapse/Escape with 44px targets. At 320px wide (equivalent to 400% zoom of a 1280px window), 667x375 landscape and 820x1180 tablet, all five navigation links remain reachable with no horizontal scroll and the open sheet does not cover navigation. A viewport-shrink test also checks navigation visibility when a mobile browser resizes its viewport as a keyboard opens. Tiles are stubbed.

The new viewport-shrink case is included but was not executable in this local run: Playwright's Chromium binary is unavailable in the environment. CI or a machine with the configured browser must run it before the issue's browser-test acceptance is considered complete.

**A defect these tests found and fixed:** at 320px the full sheet covered the lower part of the wrapped header navigation. Fixed with the sticky header and `--header-h`.

**Not verified (kept open on the issue):** soft-keyboard behaviour on real iOS/Android devices (the viewport-shrink browser case is an emulation, not a device keyboard); touch gestures such as dragging the sheet (not implemented; buttons only); Safari/Firefox; real tile loading from a provider; and screen readers. Tracked by #117 and #114 and in the human-action list.

## Methodology, sources and accessibility pages (issue #83)

Implemented in `apps/web/src/ResearchPages.tsx` at `/research/methodology` (P11), `/research/sources` (P12) and `/accessibility` (P13). Text is derived from `docs/research/methodology.md` and `sampling-plan.md`.

- **Methodology:** states up front that it describes the *planned* approach and that real data collection has not started and needs ethics approval; explains the convenience/purposive sample (results are not estimates for all residents, no confidence intervals), counting rules (one interview counted once overall; place summaries use interviews about that place; multi-answer questions can exceed 100%), suppression (hidden is not zero and is not derivable), the difference between no data, zero and hidden, the four evidence classes, and privacy (no exact interview positions, names, raw answers or recordings).
- **Sources and credits:** OpenStreetMap contributors (ODbL) credit; says place pages carry their own citations and that no historical sources or photographs are listed until rights and dates are checked; a corrections note says no public contact route exists yet.
- **Accessibility and language:** lists what is built in; says plainly that human assistive-technology review has not happened and no conformance is claimed; the language paragraph is generated from the app's actual language table, so it cannot advertise Gujarati or Hindi before they are enabled.
- **No invented content:** tests assert no email address, phone number, team names or titles, response counts or percentages-of-respondents, and no "fully accessible"/"WCAG conformant" wording.
- **Tests (6 new, 53 total):** limits stated, no invented content, OSM credit, language claims match the app, no conformance claim, routes render with one h1 and pass axe.
- **Limitations:** the wording has not been reviewed by the research lead (see human-action list) and the methodology page must be updated when the approved plan changes; Gujarati/Hindi versions await reviewed translations (#129).

## Map layers and category controls (#75)

Implemented in `apps/web/src/filters.ts` and the explorer (`App.tsx`).

**Controls.** Category chips (toggle buttons, `aria-pressed`, 44px tall) built from the categories actually present in the published data; layer checkboxes for Points, Streets and routes, Areas (geometry kinds). Nothing selected means no restriction. Category and layer filters combine with AND. All controls are native buttons/checkboxes, so Tab, Enter and Space work.

**State.** Filters live in the URL (`?category=heritage,transport&layers=points`) alongside `?place=`, so they survive reload, sharing and back/forward. Values not present in the data (stale or hand-edited links) are ignored rather than emptying the map. Selecting a place keeps the filters.

**One filter, two views.** The same filtered set feeds the map source and the text list, so they cannot disagree. A live status line says "Showing 1 of 3 places." or "Showing all 3 places."

**Empty result.** "No places match these filters." The map stays mounted with its attribution, the Reset filters button remains, and the list area stays. Reset clears both keys from the URL.

**Failure/absence.** If the data cannot load, no controls are shown (the existing error state and retry apply). A place hidden by a filter can still be opened from `?place=` and its profile link.

**Tests.** 9 component tests (logic, URL round trip, stale link, keyboard, empty result, axe) and 2 real-Chromium tests (real canvas, URL, back/forward, attribution on empty result, 375px keyboard and 44px targets). Tiles are stubbed.

**Limits.** Layers are geometry groups, not separate data themes; additional themed layers need taxonomy from the shared contract (#26 live). Free-text search is not part of this issue. Real-device touch behaviour is unverified (#82, #117).

## Approved photo gallery (#78)

`apps/web/src/Gallery.tsx`, used by the profile "Photographs" section.

**What is shown.** A responsive grid (one column at 320px) of the public derivative images with alt text, capture date exactly as recorded (unknown stays "Date unknown"), credit and licence under each. Each thumbnail is a real button ("Open photograph: <alt>") that opens a lightbox built on a native modal `<dialog>`: the page behind is inert, Escape closes, focus returns to the thumbnail, Previous/Next buttons and Left/Right arrows move through the set (wrapping), and the caption repeats alt, date, credit and licence.

**Never exposed.** The component renders only `https` URLs not containing `/original/` or `/originals/` (defence in depth on top of the contract rule); the images send no referrer, are not draggable, and nothing in the page fetches an original object. EXIF removal is a server-side derivative step (#61 model: `exifStripped` must be true before a copy can be public); the browser cannot strip metadata from a file it is served, so this issue relies on the derivative pipeline for that and does not claim to verify it.

**Missing assets.** An item that is unavailable, unsafe or fails to load is dropped from the grid and counted in a status note ("A photograph is unavailable." / "N photographs are unavailable."); if it fails inside the open lightbox the lightbox closes. No broken-image icons or empty tiles.

**Tests.** 11 component tests (URL safety, captions, unknown date, counting, failure, referrer, keyboard navigation, focus return, axe) and 2 real-Chromium tests (real dialog: Escape and focus return, page inert; failing image at 320px). Images are 1x1 synthetic PNGs.

**Limits.** Touch gestures (swipe, pinch zoom) are not implemented; navigation is by buttons and keys. No real photographs exist; screen-reader behaviour of the dialog and real-device checks are pending (#114, #117). Live media rights/consent integration (#61 pipeline) is not claimed.

## Public location search (#76)

Search box on the explorer (`role="search"`, native `type="search"`, 44px high, Enter or the Search button), backed by `@makarba/geo-search` (#29) over the already-fetched, contract-validated published features.

**What it matches.** Every language in a place's name (a Gujarati name finds the place), and its slug; case-, accent- and spacing-insensitive. (The shared public contract has no separate alias field, so `aliases` only match if the contract adds one; the search code already handles them.) Queries are trimmed, collapsed and capped at 100 characters, and are rendered only as text.

**State.** The query is in the URL (`?q=`), alongside `?place=` and the filters, so a shared link restores the search, the narrowed list and map, and the selected place. Search combines with category and layer filters (AND). A status line says "1 place matches “atlas”." / "No places match “zzzz”." / "Searching…"; no match keeps the map with its attribution, the Clear search button and the filters.

**Stale responses and private data.** Each query gets a sequence number and an abort signal; only the answer to the latest query is applied, so a slow older response cannot overwrite a newer one, and while a search is pending the list shows nothing from the previous query. Search results are mapped back onto the published places already on the page: any id a source returns that is not a published place (for example a private candidate) is ignored, and no private data is available to the component in the first place. A failing source shows "Search could not be completed. Clear the search to see all places." and never falls back to unfiltered or stale results.

**Local by design.** The default source searches in the browser, so the query is never sent anywhere (verified in the browser test: no API request contains the query). A remote source can replace it through the `makeSource` interface when the public search API exists (#81).

**Tests.** 13 component tests (names, Gujarati, accents, no match, restore from link, filter AND, hostile query, axe, out-of-order responses, pending, private id ignored, failing source) and 2 real-Chromium tests (real map, reload, back/forward, selection, no-match with attribution, 375px). Tiles stubbed.

**Limits.** Searches names only (no addresses, categories as text, or fuzzy/typo matching). Local search covers the first 200 places the API returns. No real device or screen-reader check.

## Panorama and unavailable-coverage states (#79), history and voices routes (#80 partial)

**#79.** The place profile shows a 360° view only when a media record is an approved equirectangular image (see #69), with a link to its own page (P07, `/places/:slug/panorama`). The P07 page shows the dated still photograph with an on-demand "Explore in 360°" button, or, when the place has none, the heading "No 360° view for this place" with the sentence that street-level coverage is not available everywhere and none is promised, plus any ordinary approved photographs and a link back. Media that cannot be fetched gives the same honest state, an unpublished place gives the generic not-found page without requesting media, and the place profile says "No 360° view has been published for this place." Third-party loads: no third-party imagery provider is enabled (#70 decision); the only third-party-style load is the viewer's own code chunk, and a browser test blocks it: the page stays usable, shows "The 360° viewer could not be loaded", keeps the still photograph and the navigation. Tests: 4 component tests, 2 real-Chromium tests (blocked viewer chunk; place without panorama on both pages).

**#80 (partial).** Added the P06 page (`/places/:slug/then-and-now`) listing a place's verified comparisons, fetched fresh with `no-store` so a withdrawn pair disappears on the next load (tested: history without the pair removes the slider; history that fails says so), and the P08 Community Voices page, which states "No community accounts have been approved for publication yet." and how accounts will be handled (separate permission, labelled as what was said with question/place/period/sample size, removed on withdrawal). It contains no quotes or numbers. Not done: showing permitted accounts. The shared public contract has no quote/theme DTO, so a contract addition through the handoff process (Developer A) is needed first; sourced timeline events already appear on the profile through the history endpoint but the timeline rules of #66 (`buildTimeline`) are not yet wired to a live feed (#71). Issue #80 therefore stays open.

## Community Voices from a proposed stories contract (#80, partial, second pass)

`apps/web/src/Voices.tsx` now fetches `GET /api/v1/public/stories` (`cache: no-store`, no credentials) and shows approved stories block by block with the fixed labels "Verified fact", "What a person remembers" and "Official statement". A memory is always marked as one person's memory, never as proof; attribution appears only if the API supplies it; an official statement shows its body, date and scope. `apps/web/src/stories.ts` validates strictly: forbidden private fields anywhere, unknown labels, extra keys, empty text or a bad envelope are refused, and a story with any invalid block is dropped whole. A 404 or an empty list shows "No community accounts have been approved for publication yet."; a validation failure or server error shows a message and nothing from the payload (retry only when it can help). A withdrawn account disappears at the next load (tested). Hostile text is rendered as text. Tests: 9 component tests; the page is also in the 26-scan axe suite.

**The contract is proposed, not adopted**: the schema is not in `packages/contracts` and the fixture is `docs/project/contracts/proposed/stories-fixture.json` (invented text). **#80 stays open** until Developer A and Developer B adopt the contract and a real endpoint exists (see `DEVELOPER_B_INTEGRATION_HANDOFF.md`); no real account has been collected or approved.
