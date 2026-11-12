# Forecasting pipeline (v2-tsf)

`forecast.py` downloads public **World Bank Open Data** series for India (CC BY 4.0; economic, development, social and political-governance indicators), forecasts 10 years with **Google TimesFM 2.5** (zero-shot, 200M, PyTorch) and writes `apps/web/public/forecasts.json`, shown at `/forecasts` ("Outlook").

```
python3.11 -m venv .venv && .venv/bin/pip install timesfm torch numpy pytest
.venv/bin/python ml/forecast.py            # needs internet + ~1 GB model download from Hugging Face
.venv/bin/python ml/forecast.py --naive    # linear-trend fallback, no download
.venv/bin/python -m pytest ml
```

**Limits.** National India series, not Makarba (no Makarba time series exists in this repo; none is invented). Annual data of 15-65 points, so forecasts are trend extrapolations with wide bands, not predictions of events or policy. Kaggle datasets were not used: they require personal API credentials and per-dataset licence review (AGENTS.md rule 4); add them as extra fetchers once the owner supplies/approves them. Output is labelled with model name and disclaimer in the UI.
