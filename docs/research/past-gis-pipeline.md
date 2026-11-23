# Past tab: GIS and measurement pipeline

**Code:** `packages/gis-io/src/{projection,historical,historical-fs,historical-cli}.ts` and `ml/past_builtup.py`. **Data:** `data/geo/past/layers.json` (the registry). **Reviewed:** 2026-11-22.

The Past tab draws a historical or thematic layer only after it has passed this pipeline. The registry lists every layer the page can show. Layers with no verified source are `slots`: the page shows each with exactly what evidence it needs, and draws nothing.

## Commands (from the repository root)

```bash
pnpm --filter @makarba/gis-io past-layer validate <layer.geojson> <meta.json>   # report only, writes nothing
pnpm --filter @makarba/gis-io past-layer import   <layer.geojson> <meta.json> [--replace]
pnpm --filter @makarba/gis-io past-layer measure  <series.json> [--replace]
pnpm --filter @makarba/gis-io past-layer check                                    # re-verify the registry and every stored layer
```

`import` validates, reprojects to WGS 84, writes `data/geo/past/<id>.geojson` atomically with a provenance block, records its sha256 in the registry and moves the slot into `layers`. Nothing is written when validation fails. `check` also runs in the test suite, so a hand-edited layer file fails CI.

## Layer metadata (every field required unless marked)

`id`, `kind` (roads, landuse, tp-boundary, builtup, water, green, heritage-protection), `title`, `status` (proposed, sanctioned, implemented, observed, reconstruction), `source` {title, https url}, `licence` (ODbL-1.0, CC0-1.0, CC-BY-4.0, CC-BY-SA-4.0, public-domain, project-own), `crs` (EPSG:4326, EPSG:3857 or EPSG:32643 = UTM 43N), `asOf` {year, precision}, `accessed` (ISO date), `method`, `confidence`, `limitations`, `coverage` [west, south, east, north], optional `georeferencing` {method, controlPoints >= 4, rmseMetres <= 25}, and `schemeId` for tp-boundary layers. A reconstruction must say so in `method` or `limitations`.

## What is checked

- **Provenance and licence:** unapproved licences, missing source, access dates in the future, impossible years.
- **Coordinate system:** the file's declared CRS must agree with the metadata; coordinates are reprojected (Krüger series for UTM, tested for round-trip to under a millimetre). Projected coordinates mislabelled as WGS 84 are rejected.
- **Geometry:** the repository's existing checks (finite numbers, closed rings, self-intersection, vertex and size limits) plus line geometry for roads and polygon geometry for areas.
- **Extent:** every feature must lie inside the study area (west 72.44, south 22.93, east 72.58, north 23.05) and inside the declared coverage. Clip wider sources upstream.
- **Duplicates and conflicts:** a repeated feature id is rejected; an identical geometry is dropped with a warning; two different boundaries for one TP scheme are rejected.
- **Privacy:** restricted fields (participant or interview data) reject the feature; only `name, class, road_class, scheme_id, osm_id, note` survive.
- **Comparison rules (web, `compareCheck`):** different kinds, the same year, or a reconstruction are never compared; a plan against an observation is labelled as such and never as a measured change.

## Measurement series

A series needs a unit, method, limits, an https source with an access date, whole-year points, no repeated year, and `sameAreaAndDefinition: true`. The page charts it only with at least two points, and says so when it cannot.

### Built-up surface (registered)

`ml/past_builtup.py` reads the GHS-BUILT-S R2023A built-up surface (JRC, CC BY 4.0) for a fixed window and writes the series. Result for the study window (about 19,283 ha), 1975, 1990, 2000, 2010 and 2020: 1,318.5, 1,795.7, 2,445.3, 3,179.6 and 3,712.9 ha of built-up surface.

```bash
python -m venv .venv-past && .venv-past/bin/pip install -r ml/requirements-past.txt
.venv-past/bin/python ml/past_builtup.py --out ml/out/ghsl-builtup.json    # downloads about 60 MB per epoch into a fresh temp folder
pnpm --filter @makarba/gis-io past-layer measure ml/out/ghsl-builtup.json --replace
```

The script checks that the window lies inside the tile the file declares, that no value is negative, and that no cell reports more built-up surface than its own area. It refuses the 2025 and 2030 epochs, which are projections. **Read these figures as a modelled satellite estimate** (about 90 m cells), not a survey; the window is a rectangle that covers more than Makarba; earlier epochs rest on sparser imagery. They show the order of magnitude and direction of growth, not parcel-level change.

### Open water near the Roza (registered) and green cover (measured, not published)

`ml/past_water_green.py` picks one Landsat Collection 2 Level-2 scene per target year (USGS, public domain; read over HTTPS from the Microsoft Planetary Computer mirror, which needs no account. The AWS copy is requester-pays and is not used). Fixed rules: WRS-2 path 149 row 44, Tier 1, Landsat 5 TM or 8/9 OLI (Landsat 7 is excluded because of its 2003 scan-line failure), acquired 1 November to 15 December, and under 1% fill, cloud or shadow in the window by the scene's own QA band. If no scene in the target year passes, it tries the year before, then the year after. Each point keeps its true acquisition date.

```bash
.venv-past/bin/pip install -r ml/requirements-past.txt
.venv-past/bin/python ml/past_water_green.py --out-dir ml/out
pnpm --filter @makarba/gis-io past-layer measure ml/out/landsat-water-near-roza.json --replace
.venv-past/bin/python -m pytest ml/test_past_water_green.py
```

**Water** (MNDWI above 0, within 500 m of the Roza): 6.7 ha (11 Nov 1990), 3.2 ha (9 Nov 1995), 6.8 ha (22 Nov 2000), 6.0 ha (16 Nov 2015), 8.9 ha (8 Nov 2024). No target year from 2005, 2010 or 2020 (or a year either side) had a clear enough scene, and none from 1985. Moving the threshold from -0.1 to 0.1 changes each value by about 20% and never changes the order. The masks were checked visually against false-colour renders: the circle holds the rectangular tank south of the Roza point and a second pond to its north-west, and both are counted. Read the series as post-monsoon open water on one day each year. It reflects that year's rainfall, is not a tank outline, and cannot confirm or date the "29 to 14 hectares" claim.

**Green cover is not published.** Vegetated area (NDVI at least 0.4, not water) in the window was 4,855, 2,722, 3,214, 5,431 and 7,504 ha on the same dates. At NDVI 0.3 it roughly doubles, at 0.5 it falls by half or more, and the two Landsat 8 years sit above every Landsat 5 year at every threshold. The values therefore mix the change of sensor, the year's monsoon and any real change, so the `green-cover` slot stays empty. The per-threshold figures are in the audit file the script writes. A comparable series needs one sensor across the period, or a cross-calibration, and several dates per year.

## Still missing (each is a slot in the registry with its requirement)

Dated historical road geometry, as-built highway and flyover alignments, historical and current land use, the eight TP scheme boundaries, tank extent over time, green cover over time and ASI protected and regulated areas. Open data identified for some of them (checked 2026-11-22 by header or listing only): JRC Global Surface Water 30 m tiles, ESA WorldCover 2020 and 2021 (10 m, CC BY 4.0; two years only, with a method change between them), Landsat Collection 2 through the Earth Search STAC API. Landsat Collection 2 has since been processed for water near the Roza (above). JRC Global Surface Water and ESA WorldCover have not been processed. The `water-tank` slot still waits for tank polygons.
