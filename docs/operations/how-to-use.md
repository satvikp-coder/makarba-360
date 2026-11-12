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
  - **Today** (default): the current city, with domes and colonnade at Sarkhej Roza, ghat steps, trees, rooftop tanks, lane markings, and lamps that glow at dusk and night.
    - **Tour** visits every landmark and then every place, stop by stop. Use Previous / Next. Place stops have **Open details**, and the ⓘ icon shows a landmark's source.
    - **360° camera** circles the current spot once. Drag the map to take over.
    - Click a place on the map or in the list to fly there and see its details.
    - The other icons toggle 3D buildings, switch Day / Dusk / Night lighting, pause motion and replay the fly-in.
  - **Future scenario:** choose an end year (2027–2050, default 2034), or press **Play** to watch the city change year by year. A large year badge and a legend sit on the map.
    - **Highlights** (on by default) moves the camera to each numbered change in turn. The matching callout and card light up. Drag the map to stop it, or use the toolbar button.
    - The changes: the highway corridor grows, old plots are rebuilt (orange), rooftops gain solar panels (blue), haze follows Ahmedabad PM2.5, and traffic picks up. Each card says which forecast drives it.
  - The **‹** handle at the map's left edge hides the side panel for a full-width map.
- **Outlook:** choose the end year with the slider.
  - **Theme tiles** count how many indicators are improving or worsening. Click a tile to filter.
  - **Signals** shows a chart per indicator with the 80% range, before → after values with units, and tags (hover them for an explanation). "Why it matters · data" holds the interpretation and the table.
  - **AI briefing** writes "what could this mean for Makarba" with Ollama (on-device) or Groq (cloud). The output is always marked **AI-generated** with the model and time.
  - **Model & data** gives the technical details.
- **Then & Now, Community Voices, Urban Insights, Research, place pages:** the same content in one reading layout (card sections, quiet tables, story cards with a coloured edge per kind of statement).

## 4. Troubleshooting

- **AI briefing says "No local model found":** start Ollama (`ollama serve`) and pull a model.
- **Groq not configured:** add the key to `apps/web/.env.local` and restart.
- **Forecasts are unavailable:** run `./run.sh forecast`. Use `--naive` for an offline fallback.
- **Port 4010 is busy:** stop the old mock process or set `MOCK_API_PORT`.
- **The 3D map does not appear:** WebGL is unavailable, so a 2D sketch and the list take its place.
- **Reduced motion:** with the OS setting on, flights become cuts, particles are drawn already settled, and the 360° camera and Highlights are off.
