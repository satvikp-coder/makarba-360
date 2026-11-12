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

The side rail has three destinations: **Overview**, **Explore** and **Outlook**. Its foot holds:
- **AI insights**, with an orb that moves while a model is thinking.
- **Display** (accessibility settings).
- **Shortcuts**.
- One small **Demo data** notice, linking to the explanation of the dataset.

Collapse the rail to icons with the round button at its edge. On phones it becomes a row of tabs. Then & Now, Community Voices, Urban Insights and Research are reached from the Overview cards and the footer. Hover or focus any icon for a tooltip.

- **Overview:**
  - **Hero:** the particle "360°".
  - **Outlook for 2034:** four headline forecasts, plus the AI headline and top highlights once they are ready.
  - **Featured places:** cards with photos.
  - **Library:** cards for the reading pages.
  - **Landmark notes:** each with its sources.
- **Explore:** the 3D map of Makarba.
  - **Today** (default): the current city.
    - **City detail:** stepped domes, colonnade and gateway at Sarkhej Roza, Begada's palace, ghat steps, trees, rooftop rooms and water tanks, market stalls with awnings, bus shelters, parked autos, zebra crossings and lane markings.
    - **Traffic:** moving vehicles (cars, autos, bikes, buses and trucks) drive on the left. Their headlights and the street lamps glow at dawn, dusk and night, and there are stars at night.
    - **Tour** visits every landmark, then every place. Use Previous / Next or ← / →. Place stops have **Open details**; the ⓘ button shows a landmark's source.
    - **360° camera** turns the view once around the current spot. Drag or scroll the map to take over.
    - **Places panel:** photo cards with a category icon. Select one to fly there and open its card (photo, category, Open profile, ‹ › to step through places, Sourced notes for landmarks). Use the search box, or the category chips and layer filters.
  - **Future scenario** (press F): choose an end year (2027–2050, default 2034), or press **Play** (P) to watch the city grow year by year. A large year badge and a legend sit on the map.
    - **What changes:** the highway corridor grows, old plots are rebuilt (orange), rooftops get solar panels (blue), haze drifts over the ward following Ahmedabad PM2.5, heat shimmer follows Ahmedabad's hot days, and traffic gets denser and slower.
    - **Highlights are generative UI:** when a model is available, it chooses the most important things to show, their icons, tone and where on the map they belong. The panel and map callouts render whatever it returns, labelled **AI-generated**. The numbers beside each highlight come from the forecast file, never from the model. Without a model, the rule-based changes are shown.
    - **Highlights camera** (H, on by default) visits each highlight in turn and lights up its callout and card. Drag the map, press Esc, or use the toolbar button to stop it.
  - **Map controls** (top right): zoom, a compass that turns with the map (click for north), tilt, reset view and full screen, plus a scale bar. The toolbar adds 360° camera, Tour, Highlights, 3D buildings, the Dawn / Day / Dusk / Night presets, pause motion and replay fly-in.
  - The **‹** handle at the map's left edge hides the side panel for a full-width map.
- **Outlook:** choose the end year with the slider.
  - **Theme tiles** count how many indicators in each theme are improving or worsening. Click a tile to filter.
  - **Signals** shows one chart per indicator with the 80% range, before → after values with units, and tags (hover them for an explanation). "Why it matters · data" holds the interpretation and the table.
  - **AI insights:** highlights plus a written briefing on what the trends could mean for Makarba.
    - **Background start:** generation begins quietly when the site opens (default year) and when you change the year, then is cached per year. You see an orb while it thinks.
    - **Providers:** on-device Ollama, or Groq. Groq is used only when you choose it.
    - **Labelling:** everything is marked **AI-generated**, with the model and time.
  - **Model & data:** TimesFM 3.0 and its licence, the data sources, preparation, the 3D mappings and the limits.
- **Then & Now, Community Voices, Urban Insights, Research, place pages:** the same calm reading layout. Place pages open with a photo, credited; most are representative Ahmedabad scenes, and the Sarkhej Roza ones are the real place.

### Keyboard shortcuts (press ? in the app)

| Where | Keys |
|---|---|
| Anywhere | `1` Overview · `2` Explore · `3` Outlook · `,` display settings · `?` shortcuts |
| Explore | `/` search · `[` `]` previous / next place · `F` Today / Future · `P` play · `T` tour · `←` `→` tour stop or highlight · `H` highlights · `C` 360° camera · `L` cycle light · `B` 3D buildings · `M` motion · `R` reset view · `+` `−` zoom · `Q` `E` rotate · `W` `S` tilt · `Esc` stop |
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

- **AI briefing says "No local model found":** start Ollama (`ollama serve`) and pull a model.
- **Groq not configured:** add the key to `apps/web/.env.local` and restart.
- **Forecasts are unavailable:** run `./run.sh forecast`. Use `--naive` for an offline fallback.
- **Port 4010 is busy:** stop the old mock process or set `MOCK_API_PORT`.
- **The 3D map does not appear:** WebGL is unavailable, so a 2D sketch and the list take its place.
- **Reduced motion:** with the device setting or the site's **Reduce motion** option on, flights become cuts, particles are drawn already settled, vehicles stand still, and the 360° camera and Highlights camera are off.
- **AI insights never start:** they don't run automatically in automated browsers or with Save-Data on. Open the AI insights tab and press Generate.
