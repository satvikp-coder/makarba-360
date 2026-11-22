@echo off
rem Makarba 360 launcher (Windows). Usage: run.bat [demo^|preview^|forecast^|check^|api^|db^|help]
setlocal EnableDelayedExpansion
cd /d "%~dp0"
set CMD=%1
if "%CMD%"=="" set CMD=demo

echo.
echo   * Makarba 360  - a participatory urban atlas of Makarba, Ahmedabad
echo.
if /i "%CMD%"=="help" goto :help

where node >nul 2>&1 || (echo   x Node.js 22+ is needed: https://nodejs.org & exit /b 1)
for /f "delims=" %%v in ('node -v') do echo   + Node %%v
where pnpm >nul 2>&1 || (echo   x pnpm is needed. Run: corepack enable & exit /b 1)
echo   + pnpm found
if not exist node_modules (echo   . Installing dependencies, first run only... & call pnpm install --silent || exit /b 1)
echo   + Dependencies installed
if not defined WEB_PORT set WEB_PORT=5173
if not defined MOCK_API_PORT set MOCK_API_PORT=4010
set API_PORT=%MOCK_API_PORT%

if /i "%CMD%"=="demo" (
  rem Anything already listening on the two ports is stopped first, so a stale server never answers instead of the new one.
  call :claim %WEB_PORT%
  call :claim %API_PORT%
  rem The local API runs in its own minimised window and is stopped again when the web app stops; the web app runs here.
  start "Makarba 360 - local API" /min cmd /c pnpm dev:mock
  echo   . Starting the local API and the web app...
  echo.
  echo     Open   http://localhost:%WEB_PORT%
  echo     API    http://localhost:%API_PORT%/health
  echo.
  if not defined NO_OPEN start "" /b cmd /c "timeout /t 6 >nul & start http://localhost:%WEB_PORT%"
  call pnpm --filter @makarba/web dev --port %WEB_PORT% --strictPort
  call :claim %API_PORT% >nul
  exit /b
)
if /i "%CMD%"=="preview" (
  if not defined PORT set PORT=10000
  call :claim !PORT!
  echo   . Building every package...
  call pnpm -s build || exit /b 1
  echo   + Built. Serving the production build exactly as on Render:
  echo.
  echo     Open   http://localhost:!PORT!
  echo.
  if not defined NO_OPEN start "" /b cmd /c "timeout /t 4 >nul & start http://localhost:!PORT!"
  pushd apps\api
  set NODE_ENV=development
  set API_PORT=!PORT!
  set MOCK_API_HOST=127.0.0.1
  set WEB_DIST=..\web\dist
  call pnpm -s dev:mock
  popd
  exit /b
)
if /i "%CMD%"=="forecast" (
  if not exist ml\.venv (py -3.11 -m venv ml\.venv || python -m venv ml\.venv) && ml\.venv\Scripts\pip install -q -r ml\requirements.txt
  ml\.venv\Scripts\python ml\forecast.py && ml\.venv\Scripts\python ml\forecast.py --markets
  exit /b
)
if /i "%CMD%"=="check" (
  call pnpm typecheck && call pnpm lint && call pnpm test && echo   + All checks passed
  exit /b
)
if /i "%CMD%"=="db" (
  call pnpm dev:services
  exit /b
)
if /i "%CMD%"=="api" (
  if not exist .env (copy .env.example .env >nul & echo   x Created .env from .env.example - edit the secrets, then run again. & exit /b 1)
  call pnpm dev:services || exit /b 1
  rem Load KEY=VALUE lines from .env (skips comments)
  for /f "usebackq eol=# tokens=1,* delims==" %%a in (".env") do set "%%a=%%b"
  call pnpm dev:api
  exit /b
)

:help
echo   run.bat [command]
echo.
echo     demo       (default) the app with hot reload: local API + web app, opens the browser
echo     preview    the production build served exactly as on Render (one port)
echo     forecast   regenerate the TimesFM forecasts (Python 3.11)
echo     check      types, lint and every unit test
echo     api / db   the real API / its PostGIS database (Docker and .env)
echo.
echo   Ports: WEB_PORT (5173), MOCK_API_PORT (4010), PORT for preview (10000). Anything already listening on them
echo   is stopped first, so a stale server never answers instead of the new one. NO_OPEN=1 skips the browser.
echo.
exit /b

rem ---- :claim PORT - stop whatever is listening on PORT ----
:claim
set FOUND=
for /f "tokens=5" %%p in ('netstat -ano -p tcp ^| findstr /r /c:":%1 .*LISTENING"') do (
  if not "%%p"=="0" (
    echo   . Port %1 is held by process %%p: stopping it
    taskkill /PID %%p /T /F >nul 2>&1
    set FOUND=1
  )
)
if defined FOUND timeout /t 1 >nul
echo   + Port %1 is free
exit /b
