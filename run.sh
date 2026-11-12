#!/usr/bin/env bash
# Makarba 360 launcher (macOS/Linux). Usage: ./run.sh [demo|forecast|api|check|db|help]
set -euo pipefail
cd "$(dirname "$0")"
cmd="${1:-demo}"

need() { command -v "$1" >/dev/null || { echo "Missing '$1'. Install it first (see docs/operations/how-to-use.md)." >&2; exit 1; }; }
need node; need pnpm
[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 22 ] || { echo "Node >= 22 required." >&2; exit 1; }
[ -d node_modules ] || pnpm install

case "$cmd" in
  demo) # synthetic mock API (4010) + web app (Vite); Ctrl+C stops both. Start Ollama for the AI briefing.
    command -v ollama >/dev/null && ! curl -s -m 1 127.0.0.1:11434 >/dev/null && { ollama serve >/dev/null 2>&1 & }
    pnpm dev:mock & api=$!
    trap 'kill $api 2>/dev/null' EXIT INT TERM
    pnpm --filter @makarba/web dev ;;
  api)   # real API; needs Docker DB + .env (copy .env.example)
    need docker
    [ -f .env ] || { cp .env.example .env; echo "Created .env from .env.example - edit secrets, then rerun."; exit 1; }
    pnpm dev:services
    set -a; . ./.env; set +a
    pnpm dev:api ;;
  forecast) # TimesFM forecasts (World Bank + Kaggle Ahmedabad air quality; Yahoo markets into a git-ignored file)
    py=$(command -v python3.11 || command -v python3.12 || command -v python3)
    [ -d ml/.venv ] || { "$py" -m venv ml/.venv && ml/.venv/bin/pip install -q -r ml/requirements.txt; }
    ml/.venv/bin/python ml/forecast.py "${@:2}" && ml/.venv/bin/python ml/forecast.py --markets "${@:2}" ;;
  check) pnpm typecheck && pnpm lint && pnpm test ;;
  db)    need docker; pnpm dev:services ;;
  *)     sed -n '2p' "$0"; exit 0 ;;
esac
