import sys, pathlib, numpy as np
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from forecast import forecast_naive, clamp, IND

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
