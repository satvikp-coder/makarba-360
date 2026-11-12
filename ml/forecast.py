"""Fetch public World Bank series for India plus Ahmedabad air-quality and weather data, and forecast them with Google TimesFM 3.0
(falling back to TimesFM 2.5 when the 3.0 code is not installed).

NATIONAL-LEVEL context only (not Makarba-specific, not a field finding). Output: apps/web/public/forecasts.json
Usage: python ml/forecast.py [--to 2050] [--naive]   (--naive = linear-trend fallback, no model download)

Every series is forecast to --to in one pass. TimesFM decodes the whole horizon at once, so the value for a given
year does not depend on how far ahead was requested: the web app's end-year slider just reads a prefix.
"""
import argparse, datetime, json, pathlib, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
import numpy as np

# code: (label, theme, unit, good direction: "up" | "down" | None)
IND = {
    # economic
    "NY.GDP.PCAP.CD": ("GDP per capita", "economic", "US$", "up"),
    "NY.GDP.MKTP.KD.ZG": ("GDP growth", "economic", "% per year", "up"),
    "FP.CPI.TOTL.ZG": ("Inflation (consumer prices)", "economic", "% per year", "down"),
    "SL.UEM.TOTL.ZS": ("Unemployment", "economic", "% of labour force", "down"),
    "SL.UEM.1524.ZS": ("Youth unemployment", "economic", "% of labour force 15-24", "down"),
    "BX.KLT.DINV.WD.GD.ZS": ("Foreign direct investment", "economic", "% of GDP", "up"),
    "NE.GDI.TOTL.ZS": ("Investment (gross capital formation)", "economic", "% of GDP", "up"),
    "NV.IND.MANF.ZS": ("Manufacturing share of GDP", "economic", "% of GDP", "up"),
    "NV.SRV.TOTL.ZS": ("Services share of GDP", "economic", "% of GDP", None),
    "SL.EMP.SELF.ZS": ("Self-employed (incl. street vending)", "economic", "% of employment", None),
    "FS.AST.PRVT.GD.ZS": ("Credit to households and firms", "economic", "% of GDP", "up"),
    "NE.CON.PRVT.PC.KD": ("Household spending per person", "economic", "constant 2015 US$", "up"),
    # development
    "SP.POP.TOTL": ("Population", "development", "people", None),
    "SP.URB.TOTL.IN.ZS": ("Urban population share", "development", "% of population", None),
    "SP.URB.GROW": ("Urban population growth", "development", "% per year", None),
    "EG.ELC.ACCS.ZS": ("Access to electricity", "development", "% of population", "up"),
    "IT.NET.USER.ZS": ("Internet users", "development", "% of population", "up"),
    "IT.CEL.SETS.P2": ("Mobile subscriptions", "development", "per 100 people", "up"),
    "EG.FEC.RNEW.ZS": ("Renewable energy share", "development", "% of final energy use", "up"),
    "EN.ATM.PM25.MC.M3": ("PM2.5 air pollution", "development", "µg/m³", "down"),
    "EG.USE.ELEC.KH.PC": ("Electricity use per person", "development", "kWh", None),
    "EN.POP.DNST": ("Population density", "development", "people per km²", None),
    "EN.URB.MCTY.TL.ZS": ("Living in million-plus cities", "development", "% of population", None),
    "SH.STA.BASS.ZS": ("Basic sanitation", "development", "% of population", "up"),
    "SH.H2O.BASW.ZS": ("Basic drinking water", "development", "% of population", "up"),
    "EG.CFT.ACCS.ZS": ("Clean cooking fuel", "development", "% of population", "up"),
    "EN.GHG.CO2.PC.CE.AR5": ("CO₂ emissions per person", "development", "t CO₂e", "down"),
    "EG.ELC.LOSS.ZS": ("Power lost in transmission", "development", "% of output", "down"),
    "IS.AIR.PSGR": ("Air passengers", "development", "trips per year", None),
    # social
    "SP.DYN.LE00.IN": ("Life expectancy", "social", "years", "up"),
    "SH.DYN.MORT": ("Under-5 mortality", "social", "per 1,000 births", "down"),
    "SP.DYN.TFRT.IN": ("Fertility rate", "social", "births per woman", None),
    "SP.POP.65UP.TO.ZS": ("Population aged 65+", "social", "% of population", None),
    "SE.SEC.ENRR": ("Secondary school enrolment", "social", "% gross", "up"),
    "SE.TER.ENRR": ("Tertiary enrolment", "social", "% gross", "up"),
    "SL.TLF.CACT.FE.ZS": ("Female labour participation", "social", "% of women 15+", "up"),
    "SH.XPD.CHEX.GD.ZS": ("Health spending", "social", "% of GDP", "up"),
    "SE.XPD.TOTL.GD.ZS": ("Education spending", "social", "% of GDP", "up"),
    "SP.POP.0014.TO.ZS": ("Children under 15", "social", "% of population", None),
    # political (Worldwide Governance Indicators, World Bank source 3)
    "GOV_WGI_PV.EST": ("Political stability", "political", "WGI score (-2.5 to 2.5)", "up"),
    "GOV_WGI_GE.EST": ("Government effectiveness", "political", "WGI score (-2.5 to 2.5)", "up"),
    "GOV_WGI_RL.EST": ("Rule of law", "political", "WGI score (-2.5 to 2.5)", "up"),
    "GOV_WGI_CC.EST": ("Control of corruption", "political", "WGI score (-2.5 to 2.5)", "up"),
    "GOV_WGI_VA.EST": ("Voice and accountability", "political", "WGI score (-2.5 to 2.5)", "up"),
    "GOV_WGI_RQ.EST": ("Regulatory quality", "political", "WGI score (-2.5 to 2.5)", "up"),
    "SG.GEN.PARL.ZS": ("Women in parliament", "political", "% of seats", "up"),
    "GC.TAX.TOTL.GD.ZS": ("Tax revenue", "political", "% of GDP", None),
}
MIN_POINTS = 15

# Yahoo Finance monthly closes (optional, --markets). Personal-use terms: written to a separate, git-ignored file.
MARKETS = {
    "^NSEI": ("NIFTY 50 index", "markets", "index points", "up"),
    "^CNXREALTY": ("NIFTY Realty (real-estate stocks)", "markets", "index points", "up"),
    "^CNXINFRA": ("NIFTY Infrastructure", "markets", "index points", "up"),
    "^NSEBANK": ("NIFTY Bank", "markets", "index points", "up"),
    "INR=X": ("US dollar in rupees", "markets", "INR per USD", "down"),
    "BZ=F": ("Brent crude oil", "markets", "US$ per barrel", "down"),
    "GC=F": ("Gold", "markets", "US$ per ounce", None),
}


def fetch_markets():
    import yfinance as yf
    close = yf.download(list(MARKETS), period="max", interval="1mo", progress=False, auto_adjust=True)["Close"]
    out = {}
    for t in MARKETS:
        col = close[t].dropna() if t in close else []
        if len(col) >= 36:  # yearly fractions keep the chart and the end-year slider on one axis
            out[t] = [(round(d.year + (d.month - 1) / 12, 3), float(v)) for d, v in col.items()]
    return out


def fetch(code):
    src = "&source=3" if code.startswith("GOV_WGI") else ""
    url = f"https://api.worldbank.org/v2/country/IND/indicator/{code}?format=json&per_page=200{src}"
    for attempt in range(6):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                rows = json.load(r)[1] or []
            return sorted((int(x["date"]), float(x["value"])) for x in rows if x["value"] is not None)
        except Exception:
            if attempt == 5:
                print("skipped (fetch failed):", code, file=sys.stderr)
                return []
            time.sleep(2 ** attempt)


def fill_gaps(pts):
    """Annual steps are assumed by the model, so missing years (WGI skipped 1997/99/2001) are linearly interpolated."""
    if not pts:
        return pts
    years = np.arange(pts[0][0], pts[-1][0] + 1)
    vals = np.interp(years, [y for y, _ in pts], [v for _, v in pts])
    return list(zip(years.tolist(), vals.tolist()))


MODEL_3 = "google/timesfm-3.0-pytorch"
MODEL_25 = "google/timesfm-2.5-200m-pytorch"


def forecast_timesfm3(series_list, horizon):
    """TimesFM 3.0 (weights: TimesFM Non-Commercial License v1.0; research, non-production use only)."""
    import torch
    from timesfm3 import ModelConfig, TimesFM3Evaluator
    device = "mps" if torch.backends.mps.is_available() else "cuda" if torch.cuda.is_available() else "cpu"
    f = TimesFM3Evaluator(ModelConfig(checkpoint_path=MODEL_3, per_core_batch_size=32, device=device))
    outs = list(f.predict_batch([np.asarray(x, dtype=np.float32) for x in series_list], horizon=horizon, return_quantiles=True, use_symmetric_averaging=False))
    point = np.stack([o.forecast for o in outs])
    q = np.stack([np.concatenate([o.forecast[:, None], o.quantiles], axis=1) for o in outs])  # (n, h, 10): mean + 0.1..0.9, same layout as 2.5
    return point, q


def forecast_timesfm(series_list, horizon):
    import torch, timesfm
    torch.set_float32_matmul_precision("high")
    m = timesfm.TimesFM_2p5_200M_torch.from_pretrained("google/timesfm-2.5-200m-pytorch")
    m.compile(timesfm.ForecastConfig(max_context=128, max_horizon=horizon, normalize_inputs=True,
              use_continuous_quantile_head=True, force_flip_invariance=True, infer_is_positive=False, fix_quantile_crossing=True))
    return m.forecast(horizon=horizon, inputs=[np.asarray(s, dtype=np.float32) for s in series_list])  # q: (n, h, 10)


def forecast_naive(series_list, horizon):
    pts, qs = [], []
    for s in series_list:
        s = np.asarray(s[-15:]); x = np.arange(len(s))
        b, a = np.polyfit(x, s, 1); sd = (s - (a + b * x)).std() or 1e-6
        f = a + b * np.arange(len(s), len(s) + horizon); h = np.arange(1, horizon + 1)
        pts.append(f); qs.append(np.stack([f] + [f + z * sd * np.sqrt(h) for z in np.linspace(-1.28, 1.28, 9)], -1))
    return np.array(pts), np.array(qs)


def clamp(series):
    """Percent-of-population series cannot leave 0..100 and counts cannot go negative; the model doesn't know that."""
    unit = series["unit"]
    lo, hi = (0.0, 100.0) if unit.startswith("% of") and "GDP" not in unit else (0.0, None) if unit in ("people", "years", "kWh", "µg/m³", "per 100 people", "per 1,000 births", "births per woman", "days per year", "mm per year", "mg/m³", "trips per year", "people per km²", "t CO₂e", "constant 2015 US$") else (None, None)
    for p in series["forecast"]:
        for k in ("value", "lo", "hi"):
            if lo is not None: p[k] = max(lo, p[k])
            if hi is not None: p[k] = min(hi, p[k])
    return series


# Kaggle (CC0): CPCB daily city air quality 2015-2020, Ahmedabad only, averaged per month. Needs ~/.kaggle credentials.
KAGGLE_DATASET = "rohanrao/air-quality-data-in-india"
CITY = {
    "PM2.5": ("Ahmedabad PM2.5 (monthly mean)", "city", "µg/m³", "down"),
    "PM10": ("Ahmedabad PM10 (monthly mean)", "city", "µg/m³", "down"),
    "NO2": ("Ahmedabad NO₂, traffic-related (monthly mean)", "city", "µg/m³", "down"),
    "AQI": ("Ahmedabad Air Quality Index (monthly mean)", "city", "AQI", "down"),
    "CO": ("Ahmedabad carbon monoxide (monthly mean)", "city", "mg/m³", "down"),
    "SO2": ("Ahmedabad SO₂, industrial (monthly mean)", "city", "µg/m³", "down"),
    "O3": ("Ahmedabad ground-level ozone (monthly mean)", "city", "µg/m³", "down"),
}

# Kaggle (MIT): daily weather 2000-2024 for major Indian cities (developerghost/climate-in-india-daily-weather-data-2000-2024).
WEATHER_DATASET = "developerghost/climate-in-india-daily-weather-data-2000-2024"
WEATHER = {
    "HOTDAYS": ("Ahmedabad days at or above 40 °C", "city", "days per year", "down"),
    "TMAX_SUMMER": ("Ahmedabad average summer high (Apr–Jun)", "city", "°C", "down"),
    "FEELS_MAX": ("Ahmedabad hottest 'feels like' temperature", "city", "°C", "down"),
    "RAIN": ("Ahmedabad yearly rainfall", "city", "mm per year", None),
}


def fetch_weather(cache_dir):
    """Annual heat and rain indicators for Ahmedabad from daily weather; incomplete years are dropped."""
    import pandas as pd
    from kaggle.api.kaggle_api_extended import KaggleApi
    path = pathlib.Path(cache_dir) / "india_2000_2024_daily_weather.csv"
    if not path.exists():
        api = KaggleApi(); api.authenticate()
        api.dataset_download_files(WEATHER_DATASET, path=cache_dir, unzip=True)
    d = pd.read_csv(path, parse_dates=["date"])
    d = d[d["city"] == "Ahmedabad"].set_index("date")
    full = d.groupby(d.index.year).size()
    years = [int(y) for y, n in full.items() if n >= 360]
    d = d[d.index.year.isin(years)]
    g = d.groupby(d.index.year)
    summer = d[d.index.month.isin([4, 5, 6])].groupby(d[d.index.month.isin([4, 5, 6])].index.year)
    series = {
        "HOTDAYS": (g["temperature_2m_max"].apply(lambda x: (x >= 40).sum())),
        "TMAX_SUMMER": summer["temperature_2m_max"].mean(),
        "FEELS_MAX": g["apparent_temperature_max"].max(),
        "RAIN": g["precipitation_sum"].sum(),
    }
    return {f"WEATHER_AHD_{k}": [(int(y), float(v)) for y, v in s.items()] for k, s in series.items()}


def fetch_kaggle(cache_dir):
    import pandas as pd
    from kaggle.api.kaggle_api_extended import KaggleApi
    path = pathlib.Path(cache_dir) / "city_day.csv"
    if not path.exists():
        api = KaggleApi(); api.authenticate()
        api.dataset_download_file(KAGGLE_DATASET, "city_day.csv", path=cache_dir)
        z = path.with_suffix(".csv.zip")
        if z.exists():
            import zipfile; zipfile.ZipFile(z).extractall(cache_dir)
    df = pd.read_csv(path, parse_dates=["Date"])
    df = df[df["City"] == "Ahmedabad"].set_index("Date")
    out = {}
    for col in CITY:
        m = df[col].resample("MS").mean().interpolate(limit_area="inside").dropna()  # gap months filled, ends trimmed
        if len(m) >= 24:
            out[f"KAGGLE_AHD_{col}"] = [(round(d.year + (d.month - 1) / 12, 3), float(v)) for d, v in m.items()]
    return out


def run(meta, data, a, model_name_out):
    """Forecast every series to the end of --to in one TimesFM batch; annual and monthly series share the call."""
    codes = list(data)
    step = {c: (1 if float(data[c][0][0]).is_integer() and all(float(y).is_integer() for y, _ in data[c]) else 1 / 12) for c in codes}
    steps = {c: int(round((a.to + 1 - step[c] - data[c][-1][0]) / step[c])) for c in codes}
    series = [[v for _, v in data[c]] for c in codes]
    model = "linear-trend-fallback"
    h = max(steps.values())
    if not a.naive:
        tries = [(MODEL_3, forecast_timesfm3), (MODEL_25, forecast_timesfm)] if a.model == "3" else [(MODEL_25, forecast_timesfm)]
        for name, fn in tries:
            try:
                point, q = fn(series, h); model = name; break
            except ImportError as e:
                print(f"{name} code not installed ({e}); trying the next model. For 3.0: pip install git+https://github.com/google-research/timesfm.git", file=sys.stderr)
            except Exception as e:
                print(f"{name} failed ({e}); trying the next model.", file=sys.stderr)
        else:
            print("No TimesFM model ran; using the linear-trend fallback.", file=sys.stderr); point, q = forecast_naive(series, h)
    else:
        point, q = forecast_naive(series, max(steps.values()))
    model_name_out.append(model)
    res = []
    for i, c in enumerate(codes):
        last = data[c][-1][0]; lab, theme, unit, good = meta[c]; st = step[c]
        yr = (lambda k: last + k + 1) if st == 1 else (lambda k: round(last + (k + 1) / 12, 3))
        res.append(clamp({"id": c, "label": lab, "theme": theme, "unit": unit, "good": good,
            "history": [{"year": y, "value": round(v, 4)} for y, v in data[c][-(40 if st == 1 else 240):]],
            "forecast": [{"year": yr(k), "value": round(float(point[i][k]), 4),
                          "lo": round(float(q[i][k][1]), 4), "hi": round(float(q[i][k][9]), 4)} for k in range(steps[c])]}))
    return res


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--to", type=int, default=2050); ap.add_argument("--naive", action="store_true")
    ap.add_argument("--markets", action="store_true", help="forecast Yahoo Finance monthly series into markets.json instead")
    ap.add_argument("--no-kaggle", action="store_true", help="skip the Kaggle Ahmedabad air-quality series")
    ap.add_argument("--cache", default="ml/.cache")
    ap.add_argument("--model", choices=["3", "2.5"], default="3", help="TimesFM 3.0 (non-commercial weights) or 2.5 (Apache-2.0)")
    ap.add_argument("--out", default="apps/web/public/forecasts.json"); a = ap.parse_args()
    model = []
    if a.markets:
        series = run(MARKETS, fetch_markets(), a, model)
        out = {"generated": datetime.date.today().isoformat(), "model": model[0], "maxYear": a.to, "region": "Indian and global markets",
               "source": "Yahoo Finance (personal use; not redistributed)",
               "disclaimer": "Market prices are not reliably predictable; these bands show the model's extrapolation only.", "series": series}
        path = pathlib.Path(a.out).with_name("markets.json")
        path.write_text(json.dumps(out)); print("wrote", path, len(series), "market series"); return
    with ThreadPoolExecutor(3) as ex:  # the World Bank API throttles bursts
        data = dict(zip(IND, ex.map(fetch, IND)))
    data = {c: fill_gaps(p) for c, p in data.items() if len(p) >= MIN_POINTS}
    meta = dict(IND); sources = ["World Bank Open Data and Worldwide Governance Indicators (CC BY 4.0)"]
    if not a.no_kaggle:
        try:
            pathlib.Path(a.cache).mkdir(parents=True, exist_ok=True)
            city = fetch_kaggle(a.cache)
            for c, pts in city.items(): data[c] = pts; meta[c] = CITY[c.removeprefix("KAGGLE_AHD_")]
            if city: sources.append("CPCB city air quality via Kaggle (rohanrao/air-quality-data-in-india, CC0)")
        except Exception as e:
            print("Kaggle skipped:", e, file=sys.stderr)
        try:
            w = fetch_weather(a.cache)
            for c, pts in w.items(): data[c] = pts; meta[c] = WEATHER[c.removeprefix("WEATHER_AHD_")]
            if w: sources.append(f"Ahmedabad daily weather 2000-2024 via Kaggle ({WEATHER_DATASET}, MIT)")
        except Exception as e:
            print("Weather skipped:", e, file=sys.stderr)
    series = run(meta, data, a, model)
    out = {"generated": datetime.date.today().isoformat(), "model": model[0], "maxYear": a.to, "region": "India (national) and Ahmedabad (air quality and weather)",
           "source": "; ".join(sources),
           "disclaimer": "Statistical extrapolation of national and city indicators. Not a Makarba finding and not a prediction of events.",
           "series": series}
    pathlib.Path(a.out).write_text(json.dumps(out, indent=1))
    print("wrote", a.out, model[0], len(series), "series; skipped:", sorted(set(IND) - set(data)))


if __name__ == "__main__":
    main()
