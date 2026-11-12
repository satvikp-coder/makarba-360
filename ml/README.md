# Forecasting pipeline

`forecast.py` fetches public data, forecasts every series to 2050, and writes `apps/web/public/forecasts.json`. The web app reads that file on the Overview, Outlook and Explore → Future scenario screens.

The default model is **Google TimesFM 3.0** (`google/timesfm-3.0-pytorch`), loaded through the `timesfm3` module that ships with the PyPI package `timesfm==3.0.2`. **TimesFM 2.5** (`google/timesfm-2.5-200m-pytorch`) is the fallback.

> **Licence:** TimesFM 3.0 weights are under the *TimesFM Non-Commercial License v1.0*: research and non-production use only. Commercial or production use is allowed only through Google Cloud (for example BigQuery ML). This project is non-commercial university research. For anything else, run with `--model 2.5`, whose weights are Apache-2.0.

```
./run.sh forecast            # macOS/Linux: creates ml/.venv, installs ml/requirements.txt, runs both steps below
run.bat forecast             # Windows

# or by hand (Python 3.11 recommended)
ml/.venv/bin/python ml/forecast.py              # World Bank + Kaggle -> forecasts.json (committed)
ml/.venv/bin/python ml/forecast.py --model 2.5  # use TimesFM 2.5 (Apache-2.0 weights) instead of 3.0
ml/.venv/bin/python ml/forecast.py --markets    # Yahoo Finance -> markets.json (git-ignored)
ml/.venv/bin/python ml/forecast.py --naive      # linear-trend fallback, no model download
ml/.venv/bin/python -m pytest ml
```

The first run downloads the model checkpoint from Hugging Face. On Apple silicon it runs on the GPU (MPS) when available.

If a model can't be loaded, the pipeline tries the next one (3.0, then 2.5, then a linear trend) and says so in the log. The model actually used is recorded in `forecasts.json` and shown in the app's *Model & data* tab.

## Data (57 series in the current file)

| Source | Series | Frequency | Licence | Stored |
|---|---|---|---|---|
| World Bank Open Data (India) | 39 economic, development and social indicators. Economic: GDP, inflation, jobs, informal work, credit, household spending. Development: urbanisation, density, sanitation, water, clean cooking, CO₂, power losses, air travel, energy, internet. Social: health, education, ageing. | annual | CC BY 4.0 | `forecasts.json` |
| Worldwide Governance Indicators (6) and World Bank (2) | 8 political indicators: stability, effectiveness, rule of law, corruption control, voice, regulatory quality, women in parliament, tax revenue | annual | CC BY 4.0 | `forecasts.json` |
| Kaggle `rohanrao/air-quality-data-in-india` (CPCB) | Ahmedabad PM2.5, NO₂, AQI, CO, SO₂, O₃. PM10 is dropped when it has fewer than 24 months. | daily → monthly mean | CC0 | `forecasts.json` |
| Kaggle `developerghost/climate-in-india-daily-weather-data-2000-2024` | Ahmedabad days at or above 40 °C, average summer high, hottest "feels like" temperature, yearly rainfall | daily → annual | MIT | `forecasts.json` |
| Yahoo Finance via `yfinance` | NIFTY 50, NIFTY Realty, NIFTY Infra, NIFTY Bank, USD/INR, Brent, gold | monthly | personal use only | `markets.json`, git-ignored, never committed |

Kaggle needs `~/.kaggle/credentials.json` (or `kaggle.json`). Two candidates were deliberately left out, both CC BY-NC-SA: `abhisheksjha/time-series-air-quality-data-of-india-2010-2023` (more recent Gujarat stations) and `bhautikvekariya21/air-quality-dataset-indian-cities-2022-2025`. The repository has no licence chosen yet; add them once the owner decides.

The World Bank API throttles bursts, so it is called three requests at a time with up to six retries.

## Method

- Missing years or months are linearly interpolated. Series with fewer than 15 points (24 for monthly) are dropped. Weather years with fewer than 360 days are dropped.
- One TimesFM batch covers annual and monthly series together. It returns a point forecast and nine quantiles; the 10th–90th percentile band is shown.
- The whole horizon to `--to` (default 2050) is decoded in one pass. The web app's end-year slider (default 2034) reads a prefix, which is identical to re-running with a shorter horizon.
- Percentage-of-population series are clamped to 0–100, and counts and physical quantities are kept at 0 or above.

## Limits

- **Coverage:** most series are national. The Ahmedabad air-quality record ends in mid-2020, during the COVID lockdown, so it starts from a low point.
- **Weather data:** the weather series come from a reanalysis-based dataset, not station readings.
- **Scope:** nothing here is a Makarba measurement. Statistical extrapolation cannot foresee policy changes or shocks. The app states this on every forecast screen.
