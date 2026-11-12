@echo off
rem Makarba 360 launcher (Windows). Usage: run.bat [demo^|forecast^|api^|check^|db^|help]
setlocal
cd /d "%~dp0"
set CMD=%1
if "%CMD%"=="" set CMD=demo

where node >nul 2>&1 || (echo Missing node. See docs\operations\how-to-use.md & exit /b 1)
where pnpm >nul 2>&1 || (echo Missing pnpm. Run: corepack enable & exit /b 1)
if not exist node_modules call pnpm install || exit /b 1

if /i "%CMD%"=="demo" (
  rem Mock API in its own window (close it to stop), web app in this one. Ollama (if installed) powers the AI briefing.
  where ollama >nul 2>&1 && start "Ollama" /min ollama serve
  start "Makarba mock API" cmd /c pnpm dev:mock
  call pnpm --filter @makarba/web dev
  exit /b
)
if /i "%CMD%"=="forecast" (
  if not exist ml\.venv (py -3.11 -m venv ml\.venv || python -m venv ml\.venv) && ml\.venv\Scripts\pip install -q -r ml\requirements.txt
  ml\.venv\Scripts\python ml\forecast.py && ml\.venv\Scripts\python ml\forecast.py --markets
  exit /b
)
if /i "%CMD%"=="check" (
  call pnpm typecheck && call pnpm lint && call pnpm test
  exit /b
)
if /i "%CMD%"=="db" (
  call pnpm dev:services
  exit /b
)
if /i "%CMD%"=="api" (
  if not exist .env (copy .env.example .env >nul & echo Created .env from .env.example - edit secrets, then rerun. & exit /b 1)
  call pnpm dev:services || exit /b 1
  rem Load KEY=VALUE lines from .env (skips comments)
  for /f "usebackq eol=# tokens=1,* delims==" %%a in (".env") do set "%%a=%%b"
  call pnpm dev:api
  exit /b
)
echo Usage: run.bat [demo^|forecast^|api^|check^|db]
