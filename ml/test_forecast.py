import sys, pathlib, numpy as np
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from forecast import forecast_naive, IND

def test_naive_follows_linear_trend_and_band_orders():
    p, q = forecast_naive([list(range(20))], 5)
    assert np.allclose(p[0], [20, 21, 22, 23, 24], atol=1e-6)
    assert (q[0][:, 1] <= q[0][:, 9]).all()

def test_indicators_have_all_themes():
    assert {v[1] for v in IND.values()} == {"economic", "development", "social", "political"}
