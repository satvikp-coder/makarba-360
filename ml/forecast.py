"""Fetch public World Bank series for India and forecast with Google TimesFM 2.5.

NATIONAL-LEVEL context only (not Makarba-specific, not a field finding). Output: apps/web/public/forecasts.json
Usage: python ml/forecast.py [--horizon 10] [--naive]   (--naive = linear-trend fallback, no model download)
"""
import time, argparse, json, sys, urllib.request, datetime, pathlib
import numpy as np

IND = {  # code: (label, theme, unit)
    "NY.GDP.PCAP.CD": ("GDP per capita", "economic", "US$"),
    "SL.UEM.TOTL.ZS": ("Unemployment", "economic", "% of labour force"),
    "SP.URB.TOTL.IN.ZS": ("Urban population share", "development", "%"),
    "EG.ELC.ACCS.ZS": ("Access to electricity", "development", "% of population"),
    "IT.NET.USER.ZS": ("Internet users", "development", "% of population"),
    "SE.SEC.ENRR": ("Secondary school enrolment", "social", "% gross"),
    "SP.DYN.LE00.IN": ("Life expectancy", "social", "years"),
    "SL.TLF.CACT.FE.ZS": ("Female labour participation", "social", "% of women 15+"),
    "PV.EST": ("Political stability index", "political", "WGI score (-2.5..2.5)"),
    "GE.EST": ("Government effectiveness index", "political", "WGI score (-2.5..2.5)"),
}

def fetch(code):
    url = f"https://api.worldbank.org/v2/country/IND/indicator/{code}?format=json&per_page=100"
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                rows = json.load(r)[1]
            break
        except Exception:
            if attempt == 3: return []  # dropped by the >=15 points filter
            time.sleep(2 ** attempt)
    pts = sorted((int(x["date"]), x["value"]) for x in rows if x["value"] is not None)
    return pts

def forecast_timesfm(series_list, horizon):
    import torch, timesfm
    torch.set_float32_matmul_precision("high")
    m = timesfm.TimesFM_2p5_200M_torch.from_pretrained("google/timesfm-2.5-200m-pytorch")
    m.compile(timesfm.ForecastConfig(max_context=64, max_horizon=horizon, normalize_inputs=True,
              use_continuous_quantile_head=True, force_flip_invariance=True, infer_is_positive=False, fix_quantile_crossing=True))
    point, q = m.forecast(horizon=horizon, inputs=[np.asarray(s, dtype=np.float32) for s in series_list])
    return point, q  # q: (n, horizon, 10) mean + deciles 0.1..0.9

def forecast_naive(series_list, horizon):
    pts, qs = [], []
    for s in series_list:
        s = np.asarray(s[-15:]); x = np.arange(len(s))
        b, a = np.polyfit(x, s, 1); res = s - (a + b * x); sd = res.std() or 1e-6
        f = a + b * np.arange(len(s), len(s) + horizon); h = np.arange(1, horizon + 1)
        pts.append(f); qs.append(np.stack([f] + [f + z * sd * np.sqrt(h) for z in np.linspace(-1.28, 1.28, 9)], -1))
    return np.array(pts), np.array(qs)

def clamp(series):
    """Percent-of-population series cannot leave 0..100; the model doesn't know that, so bound them."""
    if not series["unit"].startswith("%") or "gross" in series["unit"]:  # gross enrolment can legitimately exceed 100
        return series
    for p in series["forecast"]:
        for k in ("value", "lo", "hi"): p[k] = min(100.0, max(0.0, p[k]))
    return series

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--horizon", type=int, default=10); ap.add_argument("--naive", action="store_true")
    ap.add_argument("--out", default="apps/web/public/forecasts.json"); a = ap.parse_args()
    data = {c: fetch(c) for c in IND}
    data = {c: p for c, p in data.items() if len(p) >= 15}
    codes = list(data)
    series = [[v for _, v in data[c]] for c in codes]
    model = "linear-trend-fallback"
    if not a.naive:
        try: point, q = forecast_timesfm(series, a.horizon); model = "google/timesfm-2.5-200m-pytorch"
        except Exception as e: print("TimesFM failed, using fallback:", e, file=sys.stderr); point, q = forecast_naive(series, a.horizon)
    else: point, q = forecast_naive(series, a.horizon)
    out = {"generated": datetime.date.today().isoformat(), "model": model, "horizon": a.horizon, "region": "India (national)",
           "source": "World Bank Open Data (CC BY 4.0)",
           "disclaimer": "Statistical extrapolation of national indicators. Not a Makarba finding and not a prediction of events.",
           "series": []}
    for i, c in enumerate(codes):
        last = data[c][-1][0]; lab, theme, unit = IND[c]
        out["series"].append({"id": c, "label": lab, "theme": theme, "unit": unit,
            "history": [{"year": y, "value": round(float(v), 3)} for y, v in data[c][-40:]],
            "forecast": [{"year": last + k + 1, "value": round(float(point[i][k]), 3),
                          "lo": round(float(q[i][k][1]), 3), "hi": round(float(q[i][k][9]), 3)} for k in range(a.horizon)]})
    out["series"] = [clamp(x) for x in out["series"]]
    pathlib.Path(a.out).write_text(json.dumps(out, indent=1)); print("wrote", a.out, model, len(codes), "series")

if __name__ == "__main__": main()
