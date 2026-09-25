@echo off
setlocal
cd /d "%~dp0.."
if not exist "acceptance-final\GRAFIX-4.1-FINAL-WINDOWS-ACCEPTANCE.ps1" (
  echo Acceptance script not found.
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "acceptance-final\GRAFIX-4.1-FINAL-WINDOWS-ACCEPTANCE.ps1"
set "EC=%ERRORLEVEL%"
echo.
echo Grafix 4.1 Final Windows acceptance exit code: %EC%
pause
exit /b %EC%
