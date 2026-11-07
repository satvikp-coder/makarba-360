# GIS design

Planning baseline: 2026-11-07. Proposed design; no participant collection or product implementation has occurred.

No official boundary, exact coordinates or road geometry is supplied as verified. Candidates include Sarkhej Roza, Makarba Lake and Sarkhej Pond; each requires study-boundary, naming, access and source checks. Boundary is a versioned research extent, not automatically an administrative limit.

Import workflow: inventory source/licence/date/CRS → retain restricted provenance → transform to EPSG:4326 → reject empty/nonfinite/out-of-range/invalid geometry → compare with appropriate municipal or ward source where available → field-check name, access and position → independent reviewer → publish versioned feature. Never trace restricted Google imagery. OSM IDs/version/extract date and ODbL attribution travel with imported roads; public tile services are not offline caches.

Store Point, MultiLineString and MultiPolygon with dimensional/type checks and GiST indexes; use ST_IsValid and explicit non-null checks, ST_Covers for edge-inclusive study membership, ST_Intersects for bbox and geography calculations for metre distances. Keep original imported CRS metadata; Web Mercator is display only. Invalid repairs create a reviewed new version, never a silent geometric change.

Initial 20–30 places fit bounded GeoJSON; cluster points client-side and highlight by stable public feature ID. Roads/large layers move to bounded server vector tiles only if profiling warrants it. Search normalised English/Gujarati/Hindi names and aliases via indexed database search; avoid public external geocoder dependence. Point clusters do not cluster lines/polygons.

Coverage uses private interview positions inside controlled aggregation; topic charts use linked subject places. Fixed approved broad grid cells (initial 500 m candidate) require k≥5 interviews, minimum 2 researchers/visits where feasible, complementary suppression and cross-filter disclosure tests. Grid size and thresholds require institutional review; 500 m/k5 are provisional policy choices, not anonymity guarantees. Publish static approved coverage snapshots without precise points or arbitrary date/geometry query endpoints.

Historic raster overlays require dates, georeferencing control points, residual uncertainty, licence and matched bounds. Walkability is an observed corridor audit with date/rubric, not inferred pedestrian accessibility. Optional satellite/terrain/building layers require provider permission, coverage and budget; 3D extrusion is not street-level photography.
