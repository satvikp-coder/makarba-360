# How to use Makarba 360 (local)

Everything here runs on **synthetic data only**. Nothing in this repository is a verified field result, and no real participant data may be loaded locally.

## 1. Prerequisites
| Tool | Version | Needed for |
|---|---|---|
| Node.js | 22+ | everything |
| pnpm | 10.x (`corepack enable`) | everything |
| Docker Desktop | recent | only `api` / `db` modes (PostGIS) |
| Python 3 | 3.10+ | optional governance/contract scripts in `scripts/` |

## 2. Launchers
| Platform | Command |
|---|---|
| macOS / Linux | `./run.sh [mode]` (first time: `chmod +x run.sh`) |
| Windows | `run.bat [mode]` (double-click or run from cmd/PowerShell) |

Both run `pnpm install` automatically if `node_modules` is missing.

| Mode | What it does |
|---|---|
| `demo` (default) | Starts the synthetic public mock API (`http://127.0.0.1:4010/api/v1/public`) and the public web app (Vite, usually `http://localhost:5173`). No database, identity provider or secrets. |
| `check` | Typecheck, lint and all tests. |
| `db` | Starts the development PostGIS container (bound to 127.0.0.1). |
| `api` | Creates `.env` from `.env.example` on first run (then stops so you can set values), starts the DB, loads `.env`, and runs the real API. |

Stop `demo`: Ctrl+C (macOS/Linux, stops both) or Ctrl+C plus closing the "Makarba mock API" window (Windows).

## 3. Using the demo
- Open the web URL printed by Vite. Public visitors can only browse approved places, evidence, stories and aggregates; there is no survey submission.
- Try API states: append `?scenario=empty`, `suppressed` or `error` to mock API URLs, e.g. `http://127.0.0.1:4010/api/v1/public/...?scenario=suppressed`.
- Check contract conformance against the running mock: `python scripts/check_public_contracts.py --fixtures --base-url http://127.0.0.1:4010`.
- Secret scan: `python scripts/check_secret_exposure.py`.

- **Outlook** (`/forecasts`): TimesFM forecasts of national India indicators, filterable by theme, with 80% bands and data tables. Regenerate via [ml/README.md](../../ml/README.md).
- **3D view** button on the map tilts it to a 60 degree perspective.

## 4. Troubleshooting
- *Port 4010 busy*: stop the old mock process or set `API_PORT` in the environment.
- *`api` mode refuses to start*: the message names the missing or too-short `.env` variable; the production capability matrix must also be stakeholder-approved (#6).
- *Docker not running*: `demo` and `check` still work; DB-backed API tests are skipped without a database.
- *Phone GPS testing*: needs HTTPS on a trusted origin; LAN HTTP is not a secure context.

## 5. Not available yet
Field PWA, admin app and real identity provider are not implemented/connected; see [open work](../project/open-issues-status.md).
