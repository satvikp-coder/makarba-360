#!/usr/bin/env python3
"""Open water near Sarkhej Roza and vegetated area in the study window, from dated Landsat Collection 2 Level-2 scenes.

Reproducible measurement pipeline for the Past tab (issue #242). For each year it picks one clear post-monsoon scene with fixed
acquisition rules, reads only the study window from the cloud-optimised GeoTIFFs and writes the open-water series, which
`pnpm --filter @makarba/gis-io past-layer measure <series.json>` validates and registers, plus an audit file.

Vegetation is measured but NOT published as a series: the vegetated area halves between NDVI 0.3 and 0.4 and the Landsat 8
years sit above every Landsat 5 year at every threshold, so the points mix sensor change, monsoon and real change. The audit
keeps the per-threshold figures as evidence. Water near the Roza moves about 20% across MNDWI -0.1 to 0.1 and keeps its order.

Data:     USGS Landsat Collection 2 Level-2 surface reflectance (public domain, credit U.S. Geological Survey), read over HTTPS
          from the Microsoft Planetary Computer mirror (free, no account; the AWS copy is requester-pays and is not used).
Rules:    same WRS-2 path 149 row 44, Tier 1, Landsat 5 TM or Landsat 8/9 OLI (Landsat 7 is excluded: its scan-line corrector
          failed in 2003), acquired 1 November to 15 December. A scene is used only if under 1% of the window is fill, cloud,
          dilated cloud or cloud shadow in its own QA band; otherwise the next clearest scene in the season is tried, then the
          same season in the year before and the year after. Each point carries its true acquisition date.
Method:   water = MNDWI (green, SWIR-1) > 0; vegetated = NDVI >= 0.4 and not water. Area = pixel count x 900 m2.
          Water is counted inside a 500 m radius of the Roza (it contains the Sarkhej tank, but it is a circle, not a tank outline).
          Vegetation is counted inside the whole study window.
Limits:   one date per year, so it reflects that year's monsoon as much as any lasting change; 30 m pixels; thresholds are
          conventional, not calibrated against ground observations; TM and OLI sensors differ slightly in band response.

Usage:
    python -m venv .venv-past && .venv-past/bin/pip install -r ml/requirements-past.txt
    .venv-past/bin/python ml/past_water_green.py --out-dir ml/out [--years 1985 1990 ... 2025]
Writes <out-dir>/landsat-water-near-roza.json and <out-dir>/landsat-water-green.audit.json.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from datetime import date
from pathlib import Path

import numpy as np
import requests

STAC = "https://planetarycomputer.microsoft.com/api/stac/v1"
COLLECTION = "landsat-c2-l2"
STUDY_BOUNDS = (72.44, 22.93, 72.58, 23.05)  # west, south, east, north: keep equal to STUDY_BOUNDS in packages/gis-io/src/historical.ts
ROZA = (72.50539, 22.99342)  # keep equal to ROZA in ml/past_builtup.py
ROZA_RADIUS_M = 500.0
PATH, ROW = "149", "044"
PLATFORMS = ("landsat-5", "landsat-8", "landsat-9")
SEASON = ("11-01", "12-15")
MAX_BAD_FRACTION = 0.01
NDVI_MIN, MNDWI_MIN = 0.4, 0.0
PIXEL_M2 = 900.0
# QA_PIXEL bits: 0 fill, 1 dilated cloud, 3 cloud, 4 cloud shadow (USGS Landsat Collection 2 Level-2 product guide).
QA_BAD = (1 << 0) | (1 << 1) | (1 << 3) | (1 << 4)
DEFAULT_YEARS = (1985, 1990, 1995, 2000, 2005, 2010, 2015, 2020, 2025)  # targets; years with no clear scene are left out


def reflectance(dn: np.ndarray) -> np.ndarray:
    """Collection 2 Level-2 surface reflectance scale and offset; 0 is fill."""
    sr = dn.astype(np.float64) * 2.75e-5 - 0.2
    return np.where(dn == 0, np.nan, sr)


def index(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    with np.errstate(divide="ignore", invalid="ignore"):
        return (a - b) / (a + b)


def classify(green, red, nir, swir1) -> tuple[np.ndarray, np.ndarray]:
    """Boolean water and vegetated masks. Vegetation excludes water so a pixel is never counted twice."""
    water = index(green, swir1) > MNDWI_MIN
    veg = (index(nir, red) >= NDVI_MIN) & ~water
    return water, veg


def bad_fraction(qa: np.ndarray, inside: np.ndarray) -> float:
    return float(((qa & QA_BAD) != 0)[inside].mean())


def search(year: int) -> list[dict]:
    body = {"collections": [COLLECTION], "intersects": {"type": "Point", "coordinates": list(ROZA)},
            "datetime": f"{year}-{SEASON[0]}T00:00:00Z/{year}-{SEASON[1]}T23:59:59Z", "limit": 100}
    r = requests.post(f"{STAC}/search", json=body, timeout=60)
    r.raise_for_status()
    items = [f for f in r.json()["features"]
             if f["properties"].get("landsat:wrs_path") == PATH and f["properties"].get("landsat:wrs_row") == ROW
             and f["properties"].get("landsat:collection_category") == "T1" and f["properties"].get("platform") in PLATFORMS]
    return sorted(items, key=lambda f: (f["properties"].get("eo:cloud_cover", 100), f["properties"]["datetime"]))


def sas_token() -> str:
    r = requests.get(f"https://planetarycomputer.microsoft.com/api/sas/v1/token/{COLLECTION}", timeout=60)
    r.raise_for_status()
    return r.json()["token"]


def measure_scene(item: dict, token: str) -> dict | None:
    import rasterio
    from rasterio.warp import transform, transform_bounds
    from rasterio.windows import from_bounds

    def href(key: str) -> str:
        return f"/vsicurl/{item['assets'][key]['href']}?{token}"

    with rasterio.open(href("qa_pixel")) as src:
        if src.crs is None or not src.crs.is_projected or abs(src.res[0] - 30) > 1e-6:
            raise SystemExit(f"{item['id']}: expected a projected 30 m grid, got {src.crs} {src.res}")
        crs = src.crs
        win = from_bounds(*transform_bounds("EPSG:4326", crs, *STUDY_BOUNDS, densify_pts=21), transform=src.transform)
        win = win.round_offsets().round_lengths()
        qa = src.read(1, window=win, boundless=True, fill_value=1)
        wt = src.window_transform(win)
        grid = src.transform
    rows, cols = np.indices(qa.shape)
    xs, ys = rasterio.transform.xy(wt, rows.ravel(), cols.ravel())
    lon, lat = (np.asarray(v).reshape(qa.shape) for v in transform(crs, "EPSG:4326", xs, ys))
    inside = (lon >= STUDY_BOUNDS[0]) & (lon <= STUDY_BOUNDS[2]) & (lat >= STUDY_BOUNDS[1]) & (lat <= STUDY_BOUNDS[3])
    bad = bad_fraction(qa, inside)
    if bad > MAX_BAD_FRACTION:
        print(f"  {item['id']}: {100 * bad:.1f}% of the window is fill, cloud or shadow; trying the next scene", flush=True)
        return None
    bands = {}
    for key in ("green", "red", "nir08", "swir16"):
        with rasterio.open(href(key)) as src:
            if src.crs != crs or src.transform != grid:
                raise SystemExit(f"{item['id']}: band {key} is not on the QA grid")
            bands[key] = reflectance(src.read(1, window=win, boundless=True, fill_value=0))
    water, veg = classify(bands["green"], bands["red"], bands["nir08"], bands["swir16"])
    good = inside & ((qa & QA_BAD) == 0)
    (rx,), (ry,) = transform("EPSG:4326", crs, [ROZA[0]], [ROZA[1]])
    x, y = (np.asarray(v).reshape(qa.shape) for v in (xs, ys))
    circle = inside & (np.hypot(x - rx, y - ry) <= ROZA_RADIUS_M)
    if bad_fraction(qa, circle) > MAX_BAD_FRACTION:  # the window rule alone could let a cloud over the tank undercount water
        print(f"  {item['id']}: cloud or shadow over the Roza circle; trying the next scene", flush=True)
        return None
    near = good & circle
    p = item["properties"]
    return {"scene": item["id"], "date": p["datetime"][:10], "platform": p["platform"], "crs": str(crs),
            "windowPixels": int(inside.sum()), "badFraction": round(bad, 4), "nearRozaPixels": int(near.sum()),
            "waterNearRozaHa": round(float(water[near].sum()) * PIXEL_M2 / 10_000, 1),
            "vegetatedHa": round(float(veg[good].sum()) * PIXEL_M2 / 10_000, 1),
            "windowHa": round(float(inside.sum()) * PIXEL_M2 / 10_000, 1),
            # Threshold sensitivity for reviewers; only NDVI_MIN is published.
            "vegetatedHaAtNdvi": {str(t): round(float(((index(bands["nir08"], bands["red"]) >= t) & ~water)[good].sum()) * PIXEL_M2 / 10_000, 1)
                                  for t in (0.3, 0.4, 0.5)},
            "waterNearRozaHaAtMndwi": {str(t): round(float((index(bands["green"], bands["swir16"]) > t)[near].sum()) * PIXEL_M2 / 10_000, 1)
                                       for t in (-0.1, 0.0, 0.1)}}


def build_series(results: list[dict], accessed: str) -> dict:
    rules = (f"One Landsat Collection 2 Level-2 scene per year: WRS-2 path {PATH} row {ROW}, Tier 1, Landsat 5 TM or 8/9 OLI, "
             f"acquired {SEASON[0]} to {SEASON[1]} (month-day), the clearest with under {MAX_BAD_FRACTION:.0%} fill, cloud or shadow "
             f"in the window by its QA band (falling back to the neighbouring year when none is clear). Scenes: " + "; ".join(f"{r['date']} {r['scene']}" for r in results) + ". "
             f"Computed by ml/past_water_green.py on {accessed}.")
    source = {"title": "USGS Landsat Collection 2 Level-2 surface reflectance (public domain), via Microsoft Planetary Computer",
              "url": "https://planetarycomputer.microsoft.com/dataset/landsat-c2-l2", "tier": "primary", "accessed": accessed}
    common_limits = ("One date per year, so values reflect that year's monsoon and the acquisition day as much as lasting change. "
                     "30 m pixels; thresholds are conventional and not calibrated against ground observations; "
                     "Landsat 5 TM and Landsat 8/9 OLI differ slightly in band response.")
    water = {
        "id": "landsat-water-near-roza",
        "title": "Open water within 500 m of Sarkhej Roza, post-monsoon (Landsat, modelled)",
        "unit": "ha",
        "method": f"Pixels with MNDWI (green, SWIR-1) above {MNDWI_MIN} whose centre lies within {ROZA_RADIUS_M:.0f} m of the Roza "
                  f"({ROZA[1]} N, {ROZA[0]} E), times 900 m2. " + rules,
        "limits": "The 500 m circle contains the Sarkhej tank but is not a tank outline; other water in the circle (a second pond to the "
                  "north-west on these images) is counted too. Moving the MNDWI threshold from -0.1 to 0.1 changes each value by about 20% "
                  "without changing their order. "
                  "This is not an encroachment measurement and cannot date the loss of the tank's area. " + common_limits,
        "sameAreaAndDefinition": True, "source": source,
        "points": [{"label": f"{r['date']} ({r['platform'].replace('landsat-', 'Landsat ')})", "year": int(r["date"][:4]),
                    "value": r["waterNearRozaHa"], "approx": True} for r in results],
    }
    return water


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--years", type=int, nargs="+", default=list(DEFAULT_YEARS))
    ap.add_argument("--out-dir", required=True)
    args = ap.parse_args()
    bad = [y for y in args.years if not 1984 <= y <= date.today().year]
    if bad:
        print(f"refused years {bad}: Landsat 5 TM data start in 1984", file=sys.stderr)
        return 2
    token = sas_token()
    results, gaps = [], []
    for year in sorted(set(args.years)):
        res = None
        for y in (year, year - 1, year + 1):  # the target year first; a neighbouring year only if no scene in it is clear
            if res is None and 1984 <= y <= date.today().year:
                items = search(y)
                print(f"{year}: {len(items)} candidate scenes in {y}", flush=True)
                res = next((r for r in (measure_scene(i, token) for i in items) if r), None)
        if res is not None and any(r["date"][:4] == res["date"][:4] for r in results):
            res = None  # two targets resolved to the same year; keep the first
        if res is None:
            gaps.append(year)
            print(f"{year}: no scene met the rules; year left out", flush=True)
            continue
        print(f"{year}: {res['date']} {res['scene']}: water near Roza {res['waterNearRozaHa']} ha, vegetated {res['vegetatedHa']} ha "
              f"of {res['windowHa']} ha", flush=True)
        results.append(res)
    if len(results) < 2:
        print("fewer than two years met the rules; nothing written", file=sys.stderr)
        return 1
    accessed = date.today().isoformat()
    out = Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    series = build_series(results, accessed)
    (out / f"{series['id']}.json").write_text(json.dumps(series, indent=2) + "\n", encoding="utf-8")
    (out / "landsat-water-green.audit.json").write_text(json.dumps({"results": results, "yearsWithoutScene": gaps}, indent=2) + "\n", encoding="utf-8")
    print(f"wrote series to {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
