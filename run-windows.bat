@echo off
where node >nul 2>nul || (echo Node.js is required for developer launch. For end users use the installer.&exit /b 1)
call npm start
