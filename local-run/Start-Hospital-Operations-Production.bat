@echo off
setlocal
cd /d "%~dp0.."

if not exist ".env.local" (
  echo Missing .env.local. Complete LOCAL_SERVER_SETUP.md first.
  pause
  exit /b 1
)

if not exist "node_modules" (
  call corepack enable
  call pnpm install --frozen-lockfile
  if errorlevel 1 goto :error
)

set "NODE_ENV=production"
set "NODE_OPTIONS=--env-file=.env.local"
call pnpm build
if errorlevel 1 goto :error
echo Starting the production local server. Open the browser address shown below.
node dist/index.js

:error
echo.
echo Hospital Operations could not start. Review LOCAL_SERVER_SETUP.md for the required setup.
pause
endlocal
