#!/usr/bin/env bash
# Makarba 360 launcher (macOS/Linux). Usage: ./run.sh [demo|preview|forecast|insights|check|api|db|help]
set -euo pipefail
cd "$(dirname "$0")"
cmd="${1:-demo}"

# ---- look ------------------------------------------------------------------------------------------------------------------
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  B=$'\e[1m'; D=$'\e[2m'; R=$'\e[0m'; ACC=$'\e[38;5;173m'; TEAL=$'\e[38;5;30m'; OK=$'\e[38;5;71m'; ERR=$'\e[38;5;167m'
else B= D= R= ACC= TEAL= OK= ERR=; fi
banner() { printf '\n  %s◆ Makarba 360°%s  %s%s%s\n  %sA participatory urban atlas of Makarba, Ahmedabad%s\n\n' "$ACC$B" "$R" "$D" "$1" "$R" "$D" "$R"; }
step() { printf '  %s✓%s %s\n' "$OK" "$R" "$1"; }
info() { printf '  %s•%s %s\n' "$TEAL" "$R" "$1"; }
fail() { printf '  %s✕ %s%s\n' "$ERR" "$1" "$R" >&2; exit 1; }
ready_panel() {   # $1 title, then "label|url" pairs
  local title="$1"; shift
  printf '\n  %s╭──────────────────────────────────────────────────╮%s\n' "$TEAL" "$R"
  printf '  %s│%s  %s%-47s%s %s│%s\n' "$TEAL" "$R" "$B" "$title" "$R" "$TEAL" "$R"
  for row in "$@"; do printf '  %s│%s  %-12s %s%-34s%s %s│%s\n' "$TEAL" "$R" "${row%%|*}" "$ACC" "${row#*|}" "$R" "$TEAL" "$R"; done
  printf '  %s│%s  %s%-47s%s %s│%s\n' "$TEAL" "$R" "$D" "Ctrl+C stops everything" "$R" "$TEAL" "$R"
  printf '  %s╰──────────────────────────────────────────────────╯%s\n\n' "$TEAL" "$R"
}
wait_for() {   # url, label: up to 60 s
  for _ in $(seq 1 120); do curl -s -m 1 -o /dev/null "$1" && { step "$2 is up"; return 0; }; sleep .5; done
  fail "$2 did not start (check the output above)"
}
open_browser() { [ -n "${NO_OPEN:-}" ] && return; { command -v open >/dev/null && open "$1"; } || { command -v xdg-open >/dev/null && xdg-open "$1"; } || true; }
port_free() { ! (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }
listeners() { # PIDs listening on a TCP port
  if command -v lsof >/dev/null; then lsof -nP -t -iTCP:"$1" -sTCP:LISTEN 2>/dev/null || true
  elif command -v fuser >/dev/null; then fuser "$1/tcp" 2>/dev/null || true; fi
}
claim_port() { # $1 port: stop whatever is listening there (asks politely, then insists), so a stale server never answers instead
  local pids pid name
  pids=$(listeners "$1")
  if [ -z "$pids" ]; then port_free "$1" || fail "Port $1 is busy and the process could not be identified"; step "Port $1 is free"; return; fi
  for pid in $pids; do
    name=$(ps -o comm= -p "$pid" 2>/dev/null | xargs basename 2>/dev/null || echo "process")
    info "Port $1 is held by $name (pid $pid): stopping it"
    kill "$pid" 2>/dev/null || true
  done
  for _ in $(seq 1 20); do port_free "$1" && { step "Port $1 is free"; return; }; sleep .25; done
  for pid in $(listeners "$1"); do kill -9 "$pid" 2>/dev/null || true; done
  sleep .5; port_free "$1" || fail "Could not free port $1 (try: lsof -iTCP:$1)"
  step "Port $1 is free"
}
supervise() { # $@ child PIDs: return as soon as any of them exits, so a crashed half never leaves the other running alone
  while :; do for pid in "$@"; do kill -0 "$pid" 2>/dev/null || return; done; sleep 1; done
}

# ---- preflight -------------------------------------------------------------------------------------------------------------
preflight() {
  command -v node >/dev/null || fail "Node.js 22+ is needed: https://nodejs.org (see docs/operations/how-to-use.md)"
  [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 22 ] || fail "Node.js 22+ is needed (found $(node -v))"
  step "Node $(node -v)"
  command -v pnpm >/dev/null || fail "pnpm is needed: run  corepack enable"
  step "pnpm $(pnpm -v)"
  if [ ! -d node_modules ]; then info "Installing dependencies (first run only)…"; pnpm install --silent; fi
  step "Dependencies installed"
}

case "$cmd" in
  demo) # synthetic mock API + web app (Vite, hot reload)
    banner "development"
    preflight
    export WEB_PORT="${WEB_PORT:-5173}" API_PORT="${MOCK_API_PORT:-4010}" MOCK_API_PORT="${MOCK_API_PORT:-4010}"
    claim_port "$WEB_PORT"; claim_port "$API_PORT"
    info "Starting the local API and the web app…"
    log="${TMPDIR:-/tmp}"; log="${log%/}/makarba-360-dev.log"; : > "$log"
    pnpm dev:mock >>"$log" 2>&1 & api=$!
    pnpm --filter @makarba/web dev --port "$WEB_PORT" --strictPort >>"$log" 2>&1 & web=$!
    # on exit stop both servers and anything they started (pnpm runs node as a child), by port as well as by PID
    stop_all() { kill $api $web 2>/dev/null; for p in $(listeners "$WEB_PORT") $(listeners "$API_PORT"); do kill "$p" 2>/dev/null; done; printf '\n  %sStopped.%s\n\n' "$D" "$R"; }
    trap stop_all EXIT; trap 'exit 130' INT TERM
    wait_for "http://127.0.0.1:$API_PORT/health" "Local API"
    wait_for "http://127.0.0.1:$WEB_PORT/" "Web app"
    ready_panel "Ready" "Open|http://localhost:$WEB_PORT" "API|http://localhost:$API_PORT/health"
    info "Server logs: $log"
    open_browser "http://localhost:$WEB_PORT"
    supervise $api $web
    printf '  %s✕ A server stopped unexpectedly; see %s%s\n' "$ERR" "$log" "$R" >&2; exit 1 ;;
  preview) # the production build served exactly as on Render: one server, one port
    banner "production preview"
    preflight
    port="${PORT:-10000}"
    claim_port "$port"
    info "Building every package…"; pnpm -s build >/dev/null; step "Built"
    (cd apps/api && NODE_ENV=development API_PORT="$port" MOCK_API_HOST=127.0.0.1 WEB_DIST=../web/dist pnpm -s dev:mock) & srv=$!
    stop_all() { kill $srv 2>/dev/null; for p in $(listeners "$port"); do kill "$p" 2>/dev/null; done; printf '\n  %sStopped.%s\n\n' "$D" "$R"; }
    trap stop_all EXIT; trap 'exit 130' INT TERM
    wait_for "http://127.0.0.1:$port/health" "Server"
    ready_panel "Production preview" "Open|http://localhost:$port"
    open_browser "http://localhost:$port"
    supervise $srv
    fail "The server stopped unexpectedly (see the output above)" ;;
  forecast) # TimesFM forecasts (World Bank + Kaggle Ahmedabad air quality; Yahoo markets into a git-ignored file)
    banner "forecasts"
    py=$(command -v python3.11 || command -v python3.12 || command -v python3) || fail "Python 3.11 is needed"
    [ -d ml/.venv ] || { info "Creating ml/.venv…"; "$py" -m venv ml/.venv && ml/.venv/bin/pip install -q -r ml/requirements.txt; }
    ml/.venv/bin/python ml/forecast.py "${@:2}" && ml/.venv/bin/python ml/forecast.py --markets "${@:2}"
    step "Forecasts written to data/forecasts.json. Run  ./run.sh insights  next." ;;
  insights) # rewrites data/ai/insights.json with Apple's on-device model (macOS 26+, Apple Intelligence on); run after `forecast`
    banner "AI insights"
    [ "$(uname)" = Darwin ] && command -v swiftc >/dev/null || fail "Needs macOS 26+ with Xcode command-line tools"
    if ! curl -s -m 1 127.0.0.1:11535/health >/dev/null; then
      [ tools/applefm/.build/applefm-server -nt tools/applefm/server.swift ] || { info "Building the on-device model bridge…"; mkdir -p tools/applefm/.build && swiftc -O tools/applefm/server.swift -o tools/applefm/.build/applefm-server; }
      tools/applefm/.build/applefm-server 11535 >/dev/null 2>&1 & bridge=$!; trap 'kill $bridge 2>/dev/null' EXIT; trap 'exit 130' INT TERM; sleep 2
    fi
    step "Model bridge is up"
    info "Writing missing years (a few minutes each)…"
    pnpm --filter @makarba/web exec vitest run -c tools/vitest.pregen.config.ts ;;
  check)
    banner "checks"
    preflight
    pnpm typecheck && step "Types" && pnpm lint && step "Lint" && pnpm test && step "Tests" ;;
  api)   # real API; needs Docker DB + .env (copy .env.example)
    banner "real API"
    command -v docker >/dev/null || fail "Docker is needed for the real API"
    [ -f .env ] || { cp .env.example .env; fail "Created .env from .env.example: edit the secrets, then run again."; }
    pnpm dev:services
    set -a; . ./.env; set +a
    pnpm dev:api ;;
  db)    command -v docker >/dev/null || fail "Docker is needed"; pnpm dev:services ;;
  *)
    banner "launcher"
    cat <<EOF
  ${B}./run.sh${R} ${TEAL}[command]${R}

    ${TEAL}demo${R}       ${D}(default)${R} the app with hot reload: local API + web app, opens the browser
    ${TEAL}preview${R}    the production build served exactly as on Render (one port)
    ${TEAL}forecast${R}   regenerate the TimesFM forecasts (Python 3.11)
    ${TEAL}insights${R}   rewrite the stored AI insights for the current forecasts (macOS 26+)
    ${TEAL}check${R}      types, lint and every unit test
    ${TEAL}api${R} / ${TEAL}db${R}   the real API / its PostGIS database (Docker and .env)

  ${D}Ports: WEB_PORT (5173), MOCK_API_PORT (4010), PORT for preview (10000). Anything already listening on them is stopped
  first, so a stale server never answers in place of the new one. NO_OPEN=1 skips the browser.${R}

EOF
    ;;
esac
