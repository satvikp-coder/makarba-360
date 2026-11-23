import sys, pathlib, numpy as np
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from past_water_green import reflectance, classify, bad_fraction, build_series, QA_BAD

def sr(v):  # reflectance -> Collection 2 digital number
    return np.array([round((v + 0.2) / 2.75e-5)])

def test_reflectance_scale_and_fill():
    out = reflectance(np.array([0, 7273, 43636]))
    assert np.isnan(out[0]) and abs(out[1]) < 1e-3 and abs(out[2] - 1.0) < 1e-3

def test_water_and_vegetation_never_overlap():
    g, r, n, s = (reflectance(sr(v)) for v in (0.10, 0.05, 0.40, 0.30))  # leafy: NDVI 0.78, MNDWI < 0
    water, veg = classify(g, r, n, s)
    assert veg[0] and not water[0]
    g, r, n, s = (reflectance(sr(v)) for v in (0.10, 0.05, 0.30, 0.02))  # green-ish but wet: MNDWI > 0 wins
    water, veg = classify(g, r, n, s)
    assert water[0] and not veg[0]
    g, r, n, s = (reflectance(sr(v)) for v in (0.20, 0.25, 0.30, 0.35))  # bare soil: neither
    water, veg = classify(g, r, n, s)
    assert not water[0] and not veg[0]

def test_bad_fraction_counts_only_inside_and_only_bad_bits():
    qa = np.array([[1 << 3, 1 << 4], [1 << 7, 1 << 6]])  # cloud, shadow, water bit, clear bit: water/clear are not bad
    assert bad_fraction(qa, np.array([[True, False], [True, True]])) == 1 / 3
    assert QA_BAD & (1 << 7) == 0

def test_series_carries_true_dates_and_passes_registry_rules():
    res = [{"scene": "A", "date": "1990-11-11", "platform": "landsat-5", "waterNearRozaHa": 6.7},
           {"scene": "B", "date": "2024-11-08", "platform": "landsat-8", "waterNearRozaHa": 8.9}]
    s = build_series(res, "2026-11-23")
    assert [p["year"] for p in s["points"]] == [1990, 2024]
    assert s["points"][1]["label"] == "8 Nov · L8"
    assert s["sameAreaAndDefinition"] is True and s["source"]["url"].startswith("https://")
    assert "A" in s["method"] and "B" in s["method"]
