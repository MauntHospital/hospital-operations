@echo off
setlocal
cd /d "%~dp0.."

if not exist ".env.local" (
  echo Missing .env.local. Copy .env.local.example first.
  pause
  exit /b 1
)

set "NODE_OPTIONS=--env-file=.env.local"
echo Applying the current database schema to the local database configured in .env.local.
call pnpm db:push
if errorlevel 1 goto :error
echo Local database schema is ready.
pause
endlocal
exit /b 0

:error
echo.
echo Database initialization failed. Check DATABASE_URL and MySQL availability.
pause
endlocal
exit /b 1
