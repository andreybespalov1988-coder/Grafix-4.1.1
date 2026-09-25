@echo off
setlocal
cd /d "%~dp0.."
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0GRAFIX-4.1-P0.1-WINDOWS-ACCEPTANCE-FINAL.ps1"
set "RC=%ERRORLEVEL%"
echo.
echo GRAFIX 4.1 P0.1 Windows acceptance exit code: %RC%
pause
exit /b %RC%
