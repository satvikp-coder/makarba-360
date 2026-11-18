# How to use Makarba 360 (local)

All place data is **synthetic**: nothing here is a verified field result, and no real participant data may be loaded locally. The forecasts use public national and Ahmedabad data and are labelled that way everywhere.

## 1. Prerequisites

| Tool | Version | Needed for |
|---|---|---|
| Node.js | 22+ | everything |
| pnpm | 10.x (`corepack enable`) | everything |
| Python | 3.11 recommended | `forecast` mode only |
| macOS 26+ with Apple Intelligence on, and Xcode command-line tools (`swiftc`) | – | `insights` mode only |
| Docker Desktop | recent | `api` / `db` modes only |

## 2. Launchers

| Platform | Command |
|---|---|
| macOS / Linux | `./run.sh [mode]` |
| Windows | `run.bat [mode]` |

| Mode | What it does |
|---|---|
| `demo` (default) | Checks Node, pnpm and the ports, starts the local API and the web app, waits until both answer, then opens http://localhost:5173. Opening the mock API root redirects to the web app. Set `WEB_PORT` or `MOCK_API_PORT` to change the ports and `NO_OPEN=1` to skip the browser. |
| `preview` | Builds everything and serves the production build from the mock API on one port (`PORT`, default 10000), exactly as the Render service does. |
| `forecast` | Builds `ml/.venv` and regenerates the forecasts with TimesFM (see [ml/README.md](../../ml/README.md)). |
| `insights` | Rewrites `data/ai/insights.json` for the current forecasts with Apple's on-device model (builds and starts the bridge in `tools/applefm`). Years already in the file for the same forecasts are kept; delete the file to redo all. Takes a few minutes per year. |
| `check` | Runs typecheck, lint and all unit tests. |
| `db` / `api` | Runs the PostGIS container, or the real API with a `.env` file. |

## 3. The app

**Start-up:** particles gather into the name while the 3D city loads, then fly onto the map's own roads (centre outward) as the map fades in. Skipped with reduced motion.

**Layout:** the 3D map fills the whole screen and never reloads between pages; everything else floats over it.
- **Look and feel:** everything floats over the map on a mild liquid-glass material (a frosted blur; Chromium also refracts the map slightly through it). Low map detail, reduced transparency and high contrast switch to solid surfaces. Icons are one family (Lucide outlines).
- **Top bar:** **Overview**, **Explore**, **Outlook**, **Display** settings and **Shortcuts**. Reading pages are linked from the Overview; the footer links to **Photo credits**.
- **Observed places:** three places come from the team's own observation in and beside the Sarkhej Roza premises: the courtyard around the Baradari (children play, people sit), the edge where people wait for the food offered in the premises, and a fruit seller on Sarkhej Roza Road (plus code XGV5+62). They are undated and name no one; the map models the Baradari pavilion, the seller's cart and the floor mats.
- **Map controls** (right edge): zoom, a compass (click for north), tilt, reset view, full screen.
- **View toolbar** (top right): **360° camera**, **Tour**, **Highlights** (future scene), 3D buildings, light (dawn, day, dusk, night), pause motion, replay.
- **Time dock** (bottom): **Today / Future**, **Play**, the year scrubber and the data lenses (**Places, Heat, Air, Growth, Mobility**). Choosing a year animates the city to it one year at a time, forwards or back (2040 runs 2027 → 2040; then 2030 runs back 2040 → 2030).
- **Lens legend** (right): the number behind the lens, its trend, and who it affects most.
- **AI dock** (bottom right): browse the year's AI highlights with Previous and Next. Selecting a highlight opens its labelled details in the future-scene side panel and moves the map to its illustrative anchor. The map's Highlights control resumes the automatic tour.
- **Footer:** © 2026 Varun Karthic and Satvik Patel, and **About the data**.

**Map accuracy:** Sarkhej Roza, its tank, the S.G. Highway (NH147), the Sarkhej road (NH8A) and the canal follow OpenStreetMap (`data/geo/`). Streets, buildings and the places are a sketch; the places are illustrative and labelled so.

- **Overview:** a column of cards: the title, the outlook for 2034 with the AI headline, featured places, the Library and landmark notes.
  The outlook cards follow the selected timeline year in Future mode; opening Outlook carries that year forward.
- **Explore:** one card with search, category and layer filters over the place list (‹ hides it). Selecting a place flies to it, lights its label and traces its footprint: the building it stands on, its area, or its route, and for Sarkhej Roza and the lake their real OpenStreetMap outlines. The place card shows a photo, **Open profile**, ‹ › to step through places, and related landmarks (labelled as context, not facts about the place).
  - **Tour:** the landmark stops, then the places that don't already stand at one (no place appears twice). Use Previous / Next or ← / →; the current stop and source appear in the side panel. The panel can be collapsed and reopened without stopping the tour.
  - **360° camera** (C), on by default: after a few seconds with no input, including at each tour stop, the camera starts a slow turn around what is in view. Touch, scroll, drag or any key stops it; it resumes when you stop. It starts off on software-rendered (Low detail) maps and with reduced motion.
  - **Future scene** (F): the highway corridor grows, old plots are rebuilt (orange), rooftops get solar (blue), haze and heat follow Ahmedabad's forecasts, traffic thickens. The panel explains every change through people: **who gains**, **who bears the cost**, and the **right to the city** question it raises. **Highlights** (H) moves the camera through them in turn.
- **Outlook:** a wide panel beside the map. Theme tiles, one chart per indicator (80% range, units, **Why it matters** and **Data** dropdowns), and **Model & data**.
- **AI insights** (the dock on the map): each year's highlights, one at a time beside its map anchor, and a short briefing. They come from `data/ai/insights.json` (no model runs in the browser) and are labelled **AI-generated**.
- **Reading pages:** one centred card over a dimmed map.

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

- **Forecasts are unavailable:** run `./run.sh forecast`. Use `--naive` for an offline fallback.
- **Port 4010 is busy:** stop the old mock process or set `MOCK_API_PORT`.
- **The 3D map does not appear:** WebGL is unavailable, so a 2D sketch and the list take its place.
- **Reduced motion:** with the device setting or the site's **Reduce motion** option on, there is no start-up film, flights become cuts, years jump instead of animating, vehicles stand still, and the 360° camera and Highlights camera are off.
- **No AI insights dock on the map:** `data/ai/insights.json` was made from different forecasts. Run `./run.sh insights` (the unit tests flag this too).
