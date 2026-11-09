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

## Validated GIS import and export (issue #31)

Implemented as `packages/gis-io` (pure TypeScript, 25 tests, synthetic data around [10,10]). It stages and reports; it never writes to a database, route or file. Persisting an accepted import and exposing import/export endpoints are Developer A's (live prerequisites #27, #35), so this is not a live integration.

**Import report (accept/reject, never silent repair).** Inputs: GeoJSON text plus a declared source and licence. File-level checks: source present; licence on the approved list (ODbL-1.0, CC0-1.0, CC-BY-4.0, CC-BY-SA-4.0, public-domain, project-own); size at most 2 MB; valid JSON; a FeatureCollection; 1 to 500 features; a declared `crs` must be WGS 84 (CRS84 or EPSG:4326), otherwise rejected with "reproject before importing". Per-feature checks: numeric finite 2D/3D positions; longitude within ±180 and latitude within ±90 (catches projected metres and swapped axes); lines of at least 2 positions; polygon rings closed with at least 4 positions and no self-crossing; only Point, LineString, Polygon and their Multi forms (GeometryCollection refused); a name; no restricted participant field in properties; at most 20,000 vertices in total. Features outside the optional study bounds are accepted with a warning for lead review and are never moved, clipped or snapped. A file with any rejected feature stages nothing (all-or-nothing) but the report still lists every reason per feature index. Only allowlisted properties (name, category, slug, description_source, osm_id) are kept, with `source` and `licence` added; dropped property names are reported.

**Export.** Formats GeoJSON and CSV. A stated purpose (at least 5 characters) and an explicit field list from an allowlist (id, name, category, slug, source, licence) are required; at most 1,000 rows. Any private row, any restricted property or any malformed geometry rejects the entire export (no partial file). The returned audit record contains purpose, format, fields and row count, and no coordinates. CSV cells starting with `=`, `+`, `-`, `@`, tab or carriage return are prefixed with an apostrophe, and cells with commas, quotes or newlines are quoted.

**Not covered / limits.** Shapefile, GeoPackage and KML are not supported (convert to GeoJSON first). Self-intersection is checked per ring up to 2,000 vertices (larger rings are rejected as too large to validate); holes lying outside shells and overlapping polygons are not checked, and PostGIS `ST_IsValid` remains the authority at write time. The licence list is a proposal until the research lead approves it. Source and licence are declarations by the importer; software cannot confirm they are true. Study bounds come from the caller; the verified Makarba boundary (#5) does not exist yet.

## Category taxonomy (issue #26)

Migration `0008_category_taxonomy.sql` extends `private.location_categories`. **Codes** match `^[a-z][a-z0-9_]{1,40}$`, never change and can never be deleted (trigger, SQLSTATE 23001; the private API role also has no DELETE grant). **Labels** are a locale map; English is the required fallback and every label must be a non-blank string. **Icons** are names from the icon set (`^[a-z][a-z0-9-]{1,40}$`) and must be distinct among active categories (partial unique index); an archived category frees its icon. Optional `color_token` (a design-token name, never a raw colour), `description`, `sort_order`. **Archive** sets `archived` and `archived_at` together (check constraint) and may name a `replaced_by` category that must exist and be active. Places already using an archived category are untouched and still editable; a trigger refuses new places or moves onto it. Every create, update, archive and restore is appended to `audit.location_category_events` (append-only for runtime roles). The public read model is `published.categories`, written only by the publication worker; it keeps archived rows that published places still reference so old places keep a label, and `archived` tells the filter UI not to offer them.

Pure rules mirroring the database live in `packages/gis-io/src/categories.ts` (`validateTaxonomy`, `archiveCategory`, `canAssign`, `labelFor` with locale then English then code fallback, `publicCategories`). **Permissions:** category writes are private-API-only; exposure on the public API is a read of `published.categories` after approval. **Evidence:** 9 gis-io unit tests and 8 PostGIS tests (`packages/db/src/categories.test.ts`, CI database job). **Limits:** the category names, icons and colours are synthetic placeholders; the research lead chooses the real taxonomy. No public `/categories` route exists yet (the public contract belongs to the frontend owner), so the web app still derives filters from places.

## Location geometry create/update (issue #27)

**Types.** A place is a Point, a route (`MultiLineString`) or an area (`MultiPolygon`); `LineString` and `Polygon` input is accepted and stored as the multi form. MultiPoint, GeometryCollection and anything else is rejected. **CRS.** The request must declare WGS 84 (`EPSG:4326`, `urn:ogc:def:crs:EPSG::4326` or `CRS84`); a missing or different CRS is rejected, and coordinates outside lon -180..180 / lat -90..90 (typical of projected metres mislabelled as degrees) are rejected. **Rejected, never repaired:** empty, non-finite or non-numeric coordinates, lines under 2 positions, rings under 4 positions or not closed, self-intersecting rings (app check in `packages/gis-io/src/location-geometry.ts`; `ST_IsValid` and the range check again in `private.locations`). **Provenance** (migration 0009 `geometry_provenance`): `source` (required text), `method` (`digitised|surveyed|imported|reported|gps_walk`), `licence` (required and on the approved list for `imported`), optional real past `capturedOn` and `note`; unknown fields are dropped. A place without provenance can exist only as a candidate and can never be reviewed (check constraint).

**Versioning.** Every change to geometry or provenance requires the caller's `expectedRevision`, produces the next revision, and appends to `audit.location_geometry_revisions` with provenance and author. A stale revision is a 409 with the current revision; resubmitting identical content is a 409 `unchanged`. Concurrent edits from the same revision: one wins, the other is stale (tested on PostGIS). Changing an already reviewed, approved or published geometry returns it to `candidate` and clears the reviewer, so it needs a new independent review.

**Routes** (`apps/api/src/location-routes.ts`, private API, session + CSRF + capability on every route): `POST /locations` and `PUT /locations/:id/geometry` need `location.propose_geometry` (researcher, own record); `GET /locations`, `GET /locations/:id`, `GET /locations/:id/revisions` and `POST /locations/:id/review` need `location.review_geometry` (lead, assigned study). Ownership and study come from the stored record; the author is the session user, never a body field. A reviewer cannot review a geometry they authored (route 409 and database check). An unknown id is denied exactly like a forbidden one. No route deletes a place. **Not done:** publishing a reviewed place to `published.locations` (publication worker, issues #81/#103), real geometry (none exists; fixtures are synthetic around 10,10), and the capability matrix is still PROPOSED (#6) so production start-up refuses these routes until it is approved.

## Road corridor import and verification (issue #28)

Implemented in `packages/gis-io/src/roads.ts` (pure TypeScript, 9 tests in `packages/gis-io/src/roads.test.ts`). Stages and validates licensed street and corridor geometries from OpenStreetMap (OSM) extracts and spatial datasets prior to database ingestion.

**Validation and observable error states:**
- **Geometry constraint:** Only route geometries (`LineString` and `MultiLineString`) are accepted as road corridors. `Point`, `Polygon`, `MultiPolygon`, and `GeometryCollection` are rejected with `"geometry type ... is not a valid road corridor; road corridors must be LineString or MultiLineString"`.
- **Negative contract — restricted imagery tracing blocked:** Tracing commercial or unapproved satellite or street imagery is strictly forbidden. Any file or feature declaring `imagery_tracing`, `satellite_tracing`, `aerial_tracing`, or `restricted_imagery` is rejected immediately.
- **Negative contract — unverified road names blocked:** Corridors must carry an established, verified name. Generic placeholders (`unnamed road`, `unnamed`, `unknown road`, `road`, `street`, `unverified`) or explicit unverified markers (`verified_name: false`, `name_status: "unverified"`) are blocked from publishing.
- **Source-dated licensing & provenance:** Staged road files require a declared source, approved open licence (`ODbL-1.0`, `CC0-1.0`, `CC-BY-4.0`, `CC-BY-SA-4.0`), and a valid ISO extract date (`extractDate`).
- **Property allowlist:** Only allowlisted road attributes survive staging (`name`, `name_en`, `name_gu`, `name_hi`, `highway`, `surface`, `osm_id`, `osm_version`, `category`, `slug`, `corridor_id`), along with `source`, `licence`, and `extract_date`. Dropped properties are reported.
- **Privacy boundary:** Restricted participant fields or survey responses are never permitted in spatial features (`findForbiddenField` rejection).
- **Study extent:** Features outside the optional study bounds generate an advisory warning for research lead review and are never clipped or forcibly moved.

**Limitations:** Road corridor import stages and validates files without direct database writes; publishing verified corridors to PostGIS and public layers requires live integration (#23, #27).

