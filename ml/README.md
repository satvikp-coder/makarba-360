# Forecasting pipeline

`forecast.py` fetches public data, forecasts every series with **Google TimesFM 2.5** (200M, PyTorch, zero-shot) to 2050, and writes `apps/web/public/forecasts.json`. The web app reads it on the Overview, Outlook and Explore → Future scenario screens.

```
./run.sh forecast            # macOS/Linux: creates ml/.venv, installs ml/requirements.txt, runs both steps below
run.bat forecast             # Windows

# or by hand (Python 3.11 recommended)
ml/.venv/bin/python ml/forecast.py              # World Bank + Kaggle -> forecasts.json (committed)
ml/.venv/bin/python ml/forecast.py --markets    # Yahoo Finance -> markets.json (git-ignored)
ml/.venv/bin/python ml/forecast.py --naive      # linear-trend fallback, no model download
ml/.venv/bin/python -m pytest ml
```

First run downloads the TimesFM checkpoint (~1 GB) from Hugging Face.

## Data

| Source | Series | Frequency | Licence | Stored |
|---|---|---|---|---|
| World Bank Open Data (India) | 26 economic, development and social indicators (GDP, inflation, unemployment, FDI, urbanisation, PM2.5, internet, life expectancy, enrolment, …) | annual | CC BY 4.0 | `forecasts.json` |
| Worldwide Governance Indicators (World Bank source 3) | 6 political indicators (stability, effectiveness, rule of law, corruption control, voice, regulatory quality) | annual | CC BY 4.0 | `forecasts.json` |
| Kaggle `rohanrao/air-quality-data-in-india` (CPCB) | Ahmedabad PM2.5, NO₂, AQI (PM10 is dropped when it has under 24 months) | daily → monthly mean | CC0 | `forecasts.json` |
| Yahoo Finance via `yfinance` | NIFTY 50, NIFTY Realty, NIFTY Infra, NIFTY Bank, USD/INR, Brent, gold | monthly | personal use only | `markets.json`, git-ignored, never committed |

Kaggle needs `~/.kaggle/credentials.json` (or `kaggle.json`). `abhisheksjha/time-series-air-quality-data-of-india-2010-2023` has more recent Gujarat stations, but it is CC BY-NC-SA. It is not used because the repository has no licence chosen yet; add it once the owner decides.

## Method

- Missing years or months are linearly interpolated. Series with fewer than 15 points (24 for monthly) are dropped.
- One TimesFM batch covers annual and monthly series together. The context is up to 128 points, there is a quantile head (the 10th–90th percentile band is shown), and normalisation and flip invariance are on.
- The whole horizon to `--to` (default 2050) is decoded in one pass. The web app's end-year slider (default 2034) reads a prefix, which is identical to re-running with a shorter horizon.
- Percentage-of-population series are clamped to 0–100, and counts are kept at 0 or above.

## Limits

Most series are national. The Ahmedabad air-quality record ends in mid-2020, during the COVID lockdown, so it starts from a low point. Nothing here is a Makarba measurement, and statistical extrapolation cannot foresee policy changes or shocks. The UI states this on every forecast screen.
