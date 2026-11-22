#!/usr/bin/env python3
"""Built-up surface around Sarkhej Roza from the JRC Global Human Settlement Layer (GHS-BUILT-S R2023A).

Reproducible measurement pipeline for the Past tab. For each epoch it downloads the one 10-degree tile that covers the study area (verified from the file),
reads only the study window from the GeoTIFF, sums the built-up surface (square metres per cell) and writes a measurement series
that `pnpm --filter @makarba/gis-io past-layer measure <series.json>` validates and registers.

Product:  GHS-BUILT-S R2023A, 3 arc-second (about 90 m) WGS 84 grid, 5-yearly epochs. Licence CC BY 4.0 (copyright.txt on the server).
          Credit: European Commission, Joint Research Centre, GHSL. Epochs 2025 and 2030 are projections and are refused here.
Method:   the same fixed window and the same product definition in every epoch, so the points are comparable.
Limits:   a modelled estimate from satellite data (Landsat and Sentinel), not a survey; coarse (about 90 m cells) so small buildings and
          narrow roads are not resolved; the earliest epochs rest on sparser imagery and are less certain.

Usage (a fresh virtual environment is recommended):
    python -m venv .venv-past && .venv-past/bin/pip install -r ml/requirements-past.txt
    .venv-past/bin/python ml/past_builtup.py --out ml/out/ghsl-builtup.json [--epochs 1975 1990 2000 2010 2020] [--workdir EMPTY_DIR]
Downloads (about 60 MB per epoch) go to --workdir, which must be empty or absent; they are deleted after use unless --keep is given.
"""
from __future__ import annotations

import argparse
import json
import math
import shutil
import sys
import tempfile
import zipfile
from datetime import date
from pathlib import Path

import numpy as np
import requests
import tifffile
import zarr

BASE = "https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/GHSL/GHS_BUILT_S_GLOBE_R2023A"
# One 10-degree tile (row 7, column 26 of the GHSL grid) covers roughly lat 19-29N, lon 70-80E, which contains the whole study area.
# read_window() verifies this from the extent declared in the file rather than trusting the arithmetic.
TILE = "R7_C26"
STUDY_BOUNDS = (72.44, 22.93, 72.58, 23.05)  # west, south, east, north: keep equal to STUDY_BOUNDS in packages/gis-io/src/historical.ts
ROZA = (72.50539, 22.99342)
OBSERVED_EPOCHS = (1975, 1980, 1985, 1990, 1995, 2000, 2005, 2010, 2015, 2020)
DEFAULT_EPOCHS = (1975, 1990, 2000, 2010, 2020)


def tile_url(epoch: int) -> str:
    name = f"GHS_BUILT_S_E{epoch}_GLOBE_R2023A_4326_3ss"
    return f"{BASE}/{name}/V1-0/tiles/{name}_V1_0_{TILE}.zip"


def download(url: str, dest: Path) -> None:
    with requests.get(url, stream=True, timeout=60) as r:
        r.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in r.iter_content(1 << 20):
                f.write(chunk)


def read_window(tif: Path, bounds: tuple[float, float, float, float]) -> tuple[np.ndarray, dict]:
    """Reads only the pixels inside bounds. Returns (array, info) with the grid facts used, so the result can be audited."""
    with tifffile.TiffFile(tif) as t:
        page = t.pages[0]
        scale = page.tags["ModelPixelScaleTag"].value
        tie = page.tags["ModelTiepointTag"].value
        nodata_tag = page.tags.get(42113)
        nodata = float(nodata_tag.value) if nodata_tag is not None else None
        x0 = tie[3] - tie[0] * scale[0]
        y0 = tie[4] + tie[1] * scale[1]
        height, width = page.shape[0], page.shape[1]
        w, s, e, n = bounds
        # The GHSL WGS 84 grid starts near 89.1N and 180W, so a tile is not on whole degrees. Use the extent the file itself declares.
        if not (x0 <= w and e <= x0 + width * scale[0] and y0 - height * scale[1] <= s and n <= y0):
            raise SystemExit(f"the study window is not inside this tile (origin {x0}, {y0}, size {width}x{height}, pixel {scale[0]})")
        c0, c1 = int(math.floor((w - x0) / scale[0])), int(math.ceil((e - x0) / scale[0]))
        r0, r1 = int(math.floor((y0 - n) / scale[1])), int(math.ceil((y0 - s) / scale[1]))
        store = t.aszarr()
        arr = zarr.open(store, mode="r")
        arr = arr["0"] if hasattr(arr, "keys") else arr
        win = np.asarray(arr[r0:r1, c0:c1])
        info = {"dtype": str(page.dtype), "nodata": nodata, "pixelDeg": [scale[0], scale[1]], "rows": [r0, r1], "cols": [c0, c1],
                "windowShape": list(win.shape), "originLon": x0, "originLat": y0}
    return win, info


def cell_area_m2(lat: float, dlon_deg: float, dlat_deg: float) -> float:
    return (dlon_deg * 111319.49 * math.cos(math.radians(lat))) * (dlat_deg * 110574.0)


def built_up_ha(win: np.ndarray, info: dict) -> tuple[float, float]:
    """Sum of built-up surface in hectares and the window's total cell area in hectares. Validates values against the cell area."""
    a = win.astype(np.float64)
    if info["nodata"] is not None:
        a = np.where(a == info["nodata"], np.nan, a)
    valid = a[~np.isnan(a)]
    if valid.size == 0:
        raise SystemExit("window contains only nodata")
    if valid.min() < 0:
        raise SystemExit("negative built-up surface found: product semantics not as expected")
    r0 = info["rows"][0]
    # Per-row cell area (cells shrink east-west with latitude), then require every value to fit inside its cell.
    lats = info["originLat"] - (np.arange(win.shape[0]) + r0 + 0.5) * info["pixelDeg"][1]
    areas = np.array([cell_area_m2(la, info["pixelDeg"][0], info["pixelDeg"][1]) for la in lats])
    over = np.nanmax(a / areas[:, None])
    if over > 1.02:
        raise SystemExit(f"a cell reports more built-up surface than its area ({over:.2f}x): unit not square metres?")
    return float(np.nansum(a) / 10_000), float(areas.sum() * win.shape[1] / 10_000)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--epochs", type=int, nargs="+", default=list(DEFAULT_EPOCHS))
    ap.add_argument("--out", required=True)
    ap.add_argument("--workdir", default=None, help="empty or absent directory for the downloads")
    ap.add_argument("--keep", action="store_true", help="keep the downloaded tiles")
    args = ap.parse_args()
    bad = [e for e in args.epochs if e not in OBSERVED_EPOCHS]
    if bad:
        print(f"refused epochs {bad}: only 1975-2020 are observation-based; 2025 and 2030 are projections", file=sys.stderr)
        return 2
    work = Path(args.workdir) if args.workdir else Path(tempfile.mkdtemp(prefix="ghsl-"))
    if work.exists() and any(work.iterdir()):
        print(f"{work} is not empty; use a new directory (downloads are untrusted data)", file=sys.stderr)
        return 2
    work.mkdir(parents=True, exist_ok=True)

    points, audit = [], []
    for epoch in sorted(args.epochs):
        d = work / str(epoch)
        d.mkdir()
        z = d / "tile.zip"
        print(f"{epoch}: downloading {tile_url(epoch)}", flush=True)
        download(tile_url(epoch), z)
        with zipfile.ZipFile(z) as zf:
            tifs = [n for n in zf.namelist() if n.lower().endswith(".tif")]
            if len(tifs) != 1:
                raise SystemExit(f"{epoch}: expected one .tif in the archive, found {tifs}")
            member = zf.getinfo(tifs[0])
            if Path(member.filename).name != member.filename:
                raise SystemExit(f"{epoch}: refusing an archive member with a path: {member.filename}")
            zf.extract(member, d)
        win, info = read_window(d / tifs[0], STUDY_BOUNDS)
        ha, window_ha = built_up_ha(win, info)
        print(f"{epoch}: built-up {ha:,.1f} ha of {window_ha:,.0f} ha window ({100 * ha / window_ha:.1f}%)", flush=True)
        points.append({"label": f"GHSL {epoch}", "year": epoch, "value": round(ha, 1), "approx": True})
        audit.append({"epoch": epoch, "windowHa": round(window_ha, 1), **info})
        if not args.keep:
            shutil.rmtree(d)

    series = {
        "id": "ghsl-builtup-study-window",
        "title": "Built-up surface in the Sarkhej-Makarba study window (GHSL, modelled)",
        "unit": "ha",
        "method": (f"Sum of GHS-BUILT-S R2023A built-up surface (square metres per 3 arc-second cell, converted to hectares) inside the fixed window "
                   f"west {STUDY_BOUNDS[0]}, south {STUDY_BOUNDS[1]}, east {STUDY_BOUNDS[2]}, north {STUDY_BOUNDS[3]} (WGS 84), same window and product in every epoch. "
                   f"Computed by ml/past_builtup.py on {date.today().isoformat()}."),
        "limits": ("A modelled estimate from satellite imagery, not a survey. Cells are about 90 m, so small buildings and narrow roads are not resolved. "
                   "Earlier epochs rest on sparser imagery and are less certain. The window is a rectangle, not an administrative boundary, and covers more than Makarba."),
        "sameAreaAndDefinition": True,
        "source": {"title": "JRC Global Human Settlement Layer, GHS-BUILT-S R2023A (CC BY 4.0)", "url": f"{BASE}/", "tier": "primary", "accessed": date.today().isoformat()},
        "points": points,
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(series, indent=2) + "\n", encoding="utf-8")
    out.with_suffix(".audit.json").write_text(json.dumps(audit, indent=2) + "\n", encoding="utf-8")
    if not args.keep and not args.workdir:
        shutil.rmtree(work, ignore_errors=True)
    print(f"wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
