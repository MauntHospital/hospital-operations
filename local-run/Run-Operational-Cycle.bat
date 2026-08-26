@echo off
setlocal
cd /d "%~dp0.."

if not exist ".env.local" (
  echo Missing .env.local. Complete LOCAL_SERVER_SETUP.md first.
  exit /b 1
)

set "LOCAL_ENV_FILE=.env.local"
call pnpm exec tsx scripts/run-operational-cycle.mts
endlocal
