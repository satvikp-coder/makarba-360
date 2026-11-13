# How to use Makarba 360 (local)

All place data is **synthetic**: nothing here is a verified field result, and no real participant data may be loaded locally. The forecasts use public national and Ahmedabad data and are labelled that way everywhere.

## 1. Prerequisites

| Tool | Version | Needed for |
|---|---|---|
| Node.js | 22+ | everything |
| pnpm | 10.x (`corepack enable`) | everything |
| Python | 3.11 recommended | `forecast` mode only |
| macOS 26+ with Apple Intelligence on, and Xcode command-line tools (`swiftc`) | Apple Foundation Models for AI insights: used first whenever available (optional) |
| Ollama | any recent version, plus a model (`ollama pull gemma3n`) | on-device AI insights when Apple Intelligence isn't available (optional) |
| Groq API key | – | cloud AI briefing (optional) |
| Docker Desktop | recent | `api` / `db` modes only |

## 2. Launchers

| Platform | Command |
|---|---|
| macOS / Linux | `./run.sh [mode]` |
| Windows | `run.bat [mode]` |

| Mode | What it does |
|---|---|
| `demo` (default) | Starts the local API, the web app (Vite, usually http://localhost:5173), the Apple Foundation Models bridge on macOS (built once from `tools/applefm/server.swift`) and Ollama if installed. |
| `forecast` | Builds `ml/.venv` and regenerates the forecasts with TimesFM (see [ml/README.md](../../ml/README.md)). |
| `check` | Runs typecheck, lint and all unit tests. |
| `db` / `api` | Runs the PostGIS container, or the real API with a `.env` file. |

**Groq:** create `apps/web/.env.local` (git-ignored) containing `GROQ_API_KEY=…`, then restart `demo`. The dev server adds the key to requests, so it is never sent to the browser.

## 3. The app

**Start-up:** particles gather into the name while the 3D city loads, then fly onto the map's own roads (centre outward) as the map fades in. Skipped with reduced motion.

**Layout:** the 3D map fills the whole screen and never reloads between pages; everything else floats over it.
- **Top bar:** **Overview**, **Explore**, **Outlook**; **Library** (Then & Now, Community Voices, Urban Insights, Research, Sources, Accessibility); **Display** settings; **Shortcuts**.
- **Map controls** (right edge): zoom, a compass (click for north), tilt, reset view, full screen.
- **View toolbar** (top right): **360° camera**, **Tour**, **Highlights** (future scene), 3D buildings, light (dawn, day, dusk, night), pause motion, replay.
- **Time dock** (bottom): **Today / Future**, **Play**, the year scrubber and the data lenses (**Places, Heat, Air, Growth, Mobility**). Choosing a year animates the city to it one year at a time, forwards or back (2040 runs 2027 → 2040; then 2030 runs back 2040 → 2030).
- **Lens legend** (right): the number behind the lens, its trend, and who it affects most.
- **AI dock** (bottom right): an orb, the year's AI highlights (who is affected and a right-to-the-city question), each with a button that flies the map to where it happens.
- **Footer:** © 2026 Varun Karthic and Satvik Patel, and **About the data**.

**Map accuracy:** Sarkhej Roza, its tank, the S.G. Highway (NH147), the Sarkhej road (NH8A) and the canal follow OpenStreetMap (`data/geo/`). Streets, buildings and the places are a sketch; the places are illustrative and labelled so.

- **Overview:** a column of cards: the title, the outlook for 2034 with the AI headline, featured places, the Library and landmark notes.
- **Explore:** one card with search, category and layer filters over the place list (‹ hides it). Selecting a place flies to it, lights its label and traces its footprint: the building it stands on, its area, or its route, and for Sarkhej Roza and the lake their real OpenStreetMap outlines. The place card shows a photo, **Open profile**, ‹ › to step through places, and related landmarks (labelled as context, not facts about the place).
  - **Tour:** the landmark stops, then the places that don't already stand at one (no place appears twice). Use Previous / Next or ← / →; the ⓘ button shows a stop's source.
  - **360° camera** (C), on by default: after a few seconds with no input, including at each tour stop, the camera starts a slow turn around what is in view. Touch, scroll, drag or any key stops it; it resumes when you stop. It starts off on software-rendered (Low detail) maps and with reduced motion.
  - **Future scene** (F): the highway corridor grows, old plots are rebuilt (orange), rooftops get solar (blue), haze and heat follow Ahmedabad's forecasts, traffic thickens. The panel explains every change through people: **who gains**, **who bears the cost**, and the **right to the city** question it raises. **Highlights** (H) moves the camera through them in turn.
- **Outlook:** a wide panel beside the map. Theme tiles, one chart per indicator (80% range, units, **Why it matters** and **Data** dropdowns), **AI insights** with the full briefing, and **Model & data**.
- **AI insights:** every forecast year's highlights and briefing are pre-generated on device with Apple's Foundation Model (`data/ai/insights.json`), so they appear at once. Years without one are generated live (Apple Intelligence first, then Ollama; Groq only if you choose it), with live progress and Cancel; **Regenerate** always asks a model afresh. Everything is labelled **AI-generated** with the model.
- **Reading pages** (Library): one centred card over a dimmed map.

### Keyboard shortcuts (press ? in the app)

| Where | Keys |
|---|---|
| Anywhere | `1` Overview · `2` Explore · `3` Outlook · `,` display settings · `?` shortcuts |
| Explore | `/` search · `[` `]` previous / next place · `F` Today / Future · `P` play · `T` tour · `←` `→` tour stop or highlight · `H` highlights · `C` 360° camera on/off · `L` cycle light · `B` 3D buildings · `M` motion · `R` reset view · `+` `−` zoom · `Q` `E` rotate · `W` `S` tilt · `Esc` stop |
| Map focused | arrow keys pan |

Shortcuts are ignored while you type in a field and when Ctrl, ⌘ or Alt is held.

### Display and accessibility (press , in the app)

- **High contrast:** solid surfaces, black text and strong focus rings.
- **Colour-blind safe palette:** Okabe–Ito colours for places, map changes and good/bad tones.
- **Text size:** up to 150%.
- **Reduce motion:** this overrides the device setting.
- **Readable text:** wider spacing and a plainer font.
- **Underline links.**

Settings are remembered in this browser.

## 4. Troubleshooting

- **AI insights say Apple Intelligence isn't reachable:** you need macOS 26+ with Apple Intelligence on. `./run.sh` builds and starts the bridge; to start it by hand, run `swiftc -O tools/applefm/server.swift -o tools/applefm/.build/applefm-server && tools/applefm/.build/applefm-server`.
- **AI briefing says "No local model found" (Ollama):** start Ollama (`ollama serve`) and pull a model.
- **Groq not configured:** add the key to `apps/web/.env.local` and restart.
- **Forecasts are unavailable:** run `./run.sh forecast`. Use `--naive` for an offline fallback.
- **Port 4010 is busy:** stop the old mock process or set `MOCK_API_PORT`.
- **The 3D map does not appear:** WebGL is unavailable, so a 2D sketch and the list take its place.
- **Reduced motion:** with the device setting or the site's **Reduce motion** option on, there is no start-up film, flights become cuts, years jump instead of animating, vehicles stand still, and the 360° camera and Highlights camera are off.
- **AI insights never start:** pre-generated years appear anyway; live generation doesn't run automatically in automated browsers or with Save-Data on. Open the AI dock and press Generate.
- **Refresh the pre-generated AI text** (after new forecasts): with the Apple bridge running, `cd apps/web && npx vitest run -c tools/vitest.pregen.config.ts` (about 30–40 s per year).
