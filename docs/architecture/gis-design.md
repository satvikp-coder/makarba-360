# GIS design

Planning baseline: 2026-11-07. Proposed design; no participant collection or product implementation has occurred.

No official boundary, exact coordinates or road geometry is supplied as verified. Candidates include Sarkhej Roza, Makarba Lake and Sarkhej Pond; each requires study-boundary, naming, access and source checks. Boundary is a versioned research extent, not automatically an administrative limit.

Import workflow: inventory source/licence/date/CRS → retain restricted provenance → transform to EPSG:4326 → reject empty/nonfinite/out-of-range/invalid geometry → compare with appropriate municipal or ward source where available → field-check name, access and position → independent reviewer → publish versioned feature. Never trace restricted Google imagery. OSM IDs/version/extract date and ODbL attribution travel with imported roads; public tile services are not offline caches.

Store Point, MultiLineString and MultiPolygon with dimensional/type checks and GiST indexes; use ST_IsValid and explicit non-null checks, ST_Covers for edge-inclusive study membership, ST_Intersects for bbox and geography calculations for metre distances. Keep original imported CRS metadata; Web Mercator is display only. Invalid repairs create a reviewed new version, never a silent geometric change.

Initial 20–30 places fit bounded GeoJSON; cluster points client-side and highlight by stable public feature ID. Roads/large layers move to bounded server vector tiles only if profiling warrants it. Search normalised English/Gujarati/Hindi names and aliases via indexed database search; avoid public external geocoder dependence. Point clusters do not cluster lines/polygons.

Coverage uses private interview positions inside controlled aggregation; topic charts use linked subject places. Fixed approved broad grid cells (initial 500 m candidate) require k≥5 interviews, minimum 2 researchers/visits where feasible, complementary suppression and cross-filter disclosure tests. Grid size and thresholds require institutional review; 500 m/k5 are provisional policy choices, not anonymity guarantees. Publish static approved coverage snapshots without precise points or arbitrary date/geometry query endpoints.

Historic raster overlays require dates, georeferencing control points, residual uncertainty, licence and matched bounds. Walkability is an observed corridor audit with date/rubric, not inferred pedestrian accessibility. Optional satellite/terrain/building layers require provider permission, coverage and budget; 3D extrusion is not street-level photography.

## PostGIS migrations and grants (issue #22)
`packages/db/migrations/NNNN_name.sql` are contiguous, forward-only SQL files applied by `packages/db` (`pnpm --filter @makarba/db migrate`) as `makarba_migrator` using a dedicated `MIGRATION_DATABASE_URL` credential (never the runtime API credential). Each runs in its own transaction; a failure rolls back completely. Applied files are recorded with a SHA-256 checksum (LF-normalised) in `migrations.applied`, a schema no runtime role can reach; editing an applied file, or running a checkout that lacks an applied version, stops the migrator. The prerequisite `db/bootstrap/001_roles_and_schemas.sql` (superuser, #36) provisions roles, schemas and default grants.

`0001_core_gis` creates `private.study_areas` (versioned MultiPolygon), `private.location_categories` (stable codes), `private.locations` (Point/MultiLineString/MultiPolygon only) and the allowlisted `published.locations` projection. Geometry is 2D EPSG:4326 and every table enforces non-empty, `ST_IsValid`, 2D and longitude/latitude range by CHECK; the wrong type, a bow-tie polygon, longitude 200 or an empty geometry is rejected at the database. GiST indexes cover every geometry column; foreign keys and `(state, study_area_id)` are indexed. `0002` (additive) adds immutable `audit.location_geometry_revisions` with a trigger, so the upgrade path from a populated 0001 database is tested.

Grants: the public role can only `SELECT` from `published`; it has no privilege on `private`, `audit` or `migrations`, including tables created by future migrations (default privileges), asserted for every existing table in the tests. Interview positions will live in `private` and are never in `published` (separate issues #42/#50 add their tables). Limitations: study-area `source_ref`/`verified_by` become foreign keys when the source and user tables land (#32); study-boundary semantics and re-evaluation are #23; the database tests run in CI (PostGIS container) and are skipped without `TEST_DATABASE_URL`, so they were not run on the author's machine.

## Basemap provider and attribution decision (issue #24)

Source of terms: OpenStreetMap Foundation Tile Usage Policy (https://operations.osmfoundation.org/policies/tiles/), read 2026-11-07. Re-check before launch because policies change.

| Question | Decision |
|---|---|
| Development, tests, staging, small pilot | Standard OSM raster tiles through one configurable URL template (`VITE_BASEMAP_TILE_URL`), no API key. Allowed by the policy provided usage is ordinary viewing. |
| Production / reliable public launch | The OSM policy states best-effort availability, no SLA and that heavy use can be blocked without notice. Production therefore needs a hosted OSM-derived provider or institution-hosted tiles. **Provider and any spend are a human decision (H7 in `docs/project/HUMAN_ACTION_REQUIRED.md`); nothing paid is activated.** The URL template makes the switch a configuration change. |
| Attribution | "© OpenStreetMap contributors" (linking to https://www.openstreetmap.org/copyright), always visible bottom-right, never behind panels, toggles or off-screen. Imported OSM roads also carry ODbL attribution and OSM IDs/version/extract date. Any provider's own attribution is appended. |
| Request budget | No numeric limit exists in the policy. Our budget: tiles only for the viewed area; honour cache headers (or cache >=7 days); conditional requests for expired tiles; no prefetching; no bots or load tests against the public server; automated tests use no network tiles. Initial scope is one neighbourhood at <=~50 pilot users, which is ordinary use. |
| User-Agent / Referer | Browsers send the Referer; the app must not set a `Referrer-Policy` that strips it for tile requests. Any server-side proxy must use a distinct app User-Agent such as `Makarba360/<version>`. |
| Offline | **Standard OSM tiles are never bulk-cached or pre-downloaded.** Offline field maps must use self-hosted tiles, a provider that explicitly permits prefetching, or vector tiles; the choice belongs to #54 and the Developer A offline work. Until then offline mode shows the place list and an honest "map tiles unavailable offline" state. |
| Fallback | Tile or WebGL failure falls back to the searchable list (see design-system.md, #15); attribution of data stays in the footer. |
| Privacy | Tile requests reveal the viewer's IP and viewed area to the tile host; the privacy page must say so. Interview positions are never sent to a tile provider. |
| Not allowed | Scraping or tracing Google or other restricted imagery; embedding paid APIs without approval. |

## Initial MapLibre map (issue #25)

`apps/web/src/map/MapView.tsx` renders already-validated, published public features with MapLibre GL JS. Explore (`/explore`) shows the map and the full place list; selecting in either marks the place in both.

| Aspect | Behaviour |
|---|---|
| Basemap | Raster tile URL from `VITE_BASEMAP_TILE_URL`, default standard OSM tiles (development/pilot only, see the #24 decision). No tile prefetching or offline caching. |
| Attribution | Always-visible, non-compact: "© OpenStreetMap contributors" (style source) plus the place-data source line (e.g. "Demonstration place data (synthetic)" for fixtures). |
| Layers | GeoJSON source `places` with fill (Polygon), line (LineString) and circle (Point) layers; selected point enlarged. Cooperative gestures avoid trapping page scroll on mobile. |
| Data | Only features that pass `validatePublic("locations")` reach the map; invalid payloads never render. Fixtures use obviously synthetic coordinates (not Makarba) and the page labels them "Demonstration data". No interview positions exist in any layer. |
| Failure | WebGL unsupported, constructor error or `webglcontextlost` sets status `unavailable`: the map region is hidden, a status message points to the list, and the list (same places, selection supported) keeps working. The map is removed on unmount. |
| Not done | Clustering, layer toggles, search (#74-#76), verified Makarba boundary/roads (#5, #28, #120), bulk offline tiles. |

Verification: 5 MapView tests with a mocked MapLibre (attribution, layers/data, click selection, WebGL failure, context loss, cleanup) and an Explore integration test. **Not yet verified in a real browser or on real devices** (WebGL rendering, tile loading): to be covered by #82/#117; the PR notes this limitation.

## Reusable spatial search and clustering (#29)

Implemented as `packages/geo-search` (pure TypeScript over published public features; contract v1 geometries Point, MultiLineString, MultiPolygon). It is the adapter and rule set only: no database query, API route or index exists yet. Developer A owns the spatial schema, indexes and grants, so live search stays a later integration (live prerequisite #27) and is not claimed.

**Bounding box.** `bbox=west,south,east,north` in WGS 84 degrees. Rejected, never repaired: wrong count, non-decimal tokens (including `1e3`, `NaN`, `Infinity`, empty), out-of-range values, zero or negative width/height, a box with west greater than east (it crosses the antimeridian: the error tells the caller to send two boxes), and any side wider than 2 degrees (default, configurable) so a whole-world or accidental huge box cannot trigger a full scan. Errors carry `code`, a plain message, `fieldErrors`, `retryable: false`, matching the shared error shape.

**Search.** Filters combine with AND: bbox intersection (lines and areas match when their extent overlaps), category list, and `q` matched case-, accent- and whitespace-insensitively against every language name, aliases and slug. Results are sorted by feature id, so ids and pages are stable regardless of input order; paging uses an `after` feature-id cursor with no overlap or gaps. `limit` is 1 to 200 (default 50); `q` at most 100 characters. Zero matches is a successful empty result with `total: 0`.

**Clustering.** Deterministic grid clustering of Point features only, by zoom (0 to 22). Lines and areas are returned untouched in `others`, never merged into point clusters. A lone point is returned as a single. Cluster ids are a hash of the sorted member ids, stable under input order and panning; every point appears exactly once across clusters and singles.

**Privacy.** Any input feature containing a restricted field name (for example interview latitude) or non-finite coordinates is dropped and counted in `dropped`; it is never returned. Output holds only fields already in the public contract plus cluster centres computed from public points.

**Tests.** 35 unit tests: 17 bbox cases (including span limit boundary, antimeridian and whole world), search (ordering, alias/accent, AND filters, paging, limit/cursor/query limits, leaky and broken input), clustering (zoom behaviour, no loss or double count at five zoom levels, stable ids, empty input, invalid zoom).

**Limits.** Grid clustering is an approximation for API-side grouping; the web map still uses MapLibre's own clustering for display. Antimeridian support is by rejection, which is sufficient for a single neighbourhood study area. Performance on a real indexed database is untested.
