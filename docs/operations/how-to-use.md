# How to use Makarba 360 (local)

All place data is **synthetic**: nothing here is a verified field result, and no real participant data may be loaded locally. The forecasts use public national and Ahmedabad data and are labelled that way everywhere.

## 1. Prerequisites

| Tool | Version | Needed for |
|---|---|---|
| Node.js | 22+ | everything |
| pnpm | 10.x (`corepack enable`) | everything |
| Python | 3.11 recommended | `forecast` mode only |
| Ollama | any recent version, plus a model (`ollama pull gemma3n`) | on-device AI briefing (optional) |
| Groq API key | – | cloud AI briefing (optional) |
| Docker Desktop | recent | `api` / `db` modes only |

## 2. Launchers

| Platform | Command |
|---|---|
| macOS / Linux | `./run.sh [mode]` |
| Windows | `run.bat [mode]` |

| Mode | What it does |
|---|---|
| `demo` (default) | Starts the synthetic mock API, the web app (Vite, usually http://localhost:5173) and Ollama if it is installed. |
| `forecast` | Builds `ml/.venv` and regenerates the forecasts with TimesFM (see [ml/README.md](../../ml/README.md)). |
| `check` | Runs typecheck, lint and all unit tests. |
| `db` / `api` | Runs the PostGIS container, or the real API with a `.env` file. |

**Groq:** create `apps/web/.env.local` (git-ignored) containing `GROQ_API_KEY=…`, then restart `demo`. The dev server adds the key to requests, so it is never sent to the browser.

## 3. The dashboard

The side rail holds every section; collapse it to icons with the round button at its edge. On phones the rail becomes a swipeable row of tabs. Hover or focus any icon to see a tooltip.

- **Overview:** the particle hero, four headline forecasts for 2034 and short introductions to each section.
- **Explore:** the 3D map of Makarba.
  - **Today** (default): the current sketch city. Use **Auto focus** for a cinematic camera that flies to each landmark and place, slowly orbits it and shows its information card. Use ‹ › to skip, or drag the map to take over. **Tour** is the step-by-step story tour (Previous / Next stop). Click a place on the map or in the list to fly there and open its details. The icons switch 3D buildings, Day / Dusk / Night lighting, pause motion and replay the fly-in.
  - **Future scenario:** choose an end year (2027–2050, default 2034). The city animates to an illustrative version of that year: a taller highway corridor and redeveloped plots (orange) from GDP, denser neighbourhoods from urbanisation, rooftop solar (blue) from the renewable share, haze from Ahmedabad PM2.5, and faster traffic. Each change is listed with the forecast behind it.
  - The **‹** handle at the map's left edge hides the side panel for a full-width map.
- **Outlook:** choose the end year with the slider.
  - **Theme tiles** count how many indicators are improving or worsening. Click a tile to filter.
  - **Signals** shows a chart per indicator with the 80% range, before → after values with units, and tags (hover them for an explanation). "Why it matters · data" holds the interpretation and the table.
  - **AI briefing** writes "what could this mean for Makarba" with Ollama (on-device) or Groq (cloud). The output is always marked **AI-generated** with the model and time.
  - **Model & data** gives the technical details.
- **Then & Now, Community Voices, Urban Insights, Research:** unchanged content, inside the same shell.

## 4. Troubleshooting

- **AI briefing says "No local model found":** start Ollama (`ollama serve`) and pull a model.
- **Groq not configured:** add the key to `apps/web/.env.local` and restart.
- **Forecasts are unavailable:** run `./run.sh forecast`. Use `--naive` for an offline fallback.
- **Port 4010 is busy:** stop the old mock process or set `MOCK_API_PORT`.
- **The 3D map does not appear:** WebGL is unavailable, so a 2D sketch and the list take its place.
- **Reduced motion:** with the OS setting on, flights become cuts, particles are drawn already settled, and Auto focus steps every 9 s instead of moving continuously.
