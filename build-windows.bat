@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is required. Install Node.js 20+ and retry.&exit /b 1)
call npm install --no-audit --no-fund
if errorlevel 1 exit /b 1
call npm run verify
if errorlevel 1 exit /b 1
if exist release rmdir /s /q release
call npm run dist:win
if errorlevel 1 exit /b 1
echo Build complete. See the release folder.
