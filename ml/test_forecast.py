import sys, pathlib, numpy as np
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from forecast import forecast_naive, clamp, run, IND

def test_naive_follows_linear_trend_and_band_orders():
    p, q = forecast_naive([list(range(20))], 5)
    assert np.allclose(p[0], [20, 21, 22, 23, 24], atol=1e-6)
    assert (q[0][:, 1] <= q[0][:, 9]).all()

def test_indicators_have_all_themes():
    assert {v[1] for v in IND.values()} == {"economic", "development", "social", "political"}

def test_clamp_bounds_percent_series_only():
    pt = lambda v: {"year": 1, "value": v, "lo": v - 5, "hi": v + 30}
    assert clamp({"unit": "% of population", "forecast": [pt(99)]})["forecast"][0] == {"year": 1, "value": 99, "lo": 94, "hi": 100.0}
    assert clamp({"unit": "US$", "forecast": [pt(99)]})["forecast"][0]["hi"] == 129
    assert clamp({"unit": "% gross", "forecast": [pt(99)]})["forecast"][0]["hi"] == 129

def test_run_mixes_annual_and_monthly_series_to_the_same_end_year():
    class A: to = 2030; naive = True
    meta = {"y": ("Y", "economic", "US$", "up"), "m": ("M", "city", "AQI", "down")}
    data = {"y": [(2000 + i, float(i)) for i in range(20)], "m": [(round(2020 + i / 12, 3), float(i)) for i in range(30)]}
    out = {s["id"]: s for s in run(meta, data, A, [])}
    assert out["y"]["forecast"][-1]["year"] == 2030 and len(out["y"]["forecast"]) == 11
    assert out["m"]["forecast"][-1]["year"] == round(2030 + 11 / 12, 3)
