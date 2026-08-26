@echo off
setlocal
cd /d "%~dp0.."

if not exist ".env.local" (
  echo Missing .env.local.
  echo Copy .env.local.example to .env.local and complete the local database and sign-in settings first.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing application packages. This can take several minutes on the first run.
  call corepack enable
  call pnpm install --frozen-lockfile
  if errorlevel 1 goto :error
)

set "NODE_ENV=development"
set "NODE_OPTIONS=--env-file=.env.local"
echo Starting Hospital Operations locally. Open the browser address shown below.
call pnpm exec tsx watch server/_core/index.ts

:error
echo.
echo Hospital Operations could not start. Review LOCAL_SERVER_SETUP.md for the required setup.
pause
endlocal
