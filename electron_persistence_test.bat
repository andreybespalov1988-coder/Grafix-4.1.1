@echo off
setlocal
cd /d "%~dp0"
if not exist "node_modules\.bin\electron.cmd" (
  echo Electron runtime not found. Run npm install first.
  exit /b 2
)
set "TESTROOT=%TEMP%\schedule-studio-electron-e2e-%RANDOM%%RANDOM%"
mkdir "%TESTROOT%" >nul 2>nul
set "SCHEDULE_STUDIO_USER_DATA=%TESTROOT%"
set "SCHEDULE_STUDIO_E2E=1"
set "SCHEDULE_STUDIO_E2E_RESULT=%TESTROOT%\write.json"
call "node_modules\.bin\electron.cmd" main.js --persist-write
if errorlevel 1 exit /b 3
set "SCHEDULE_STUDIO_E2E_RESULT=%TESTROOT%\read.json"
call "node_modules\.bin\electron.cmd" main.js --persist-read
if errorlevel 1 exit /b 4
node -e "const fs=require('fs');const x=JSON.parse(fs.readFileSync(process.env.TESTROOT+'\\read.json','utf8'));if(!x.ok||x.data.organization.name!=='E2E Organization 2026'||x.data.activeBranchId!==987654||x.data.lessons[0].title!=='E2E Lesson'){console.error('E2E persistence verification failed:',x);process.exit(1)}console.log('Electron E2E persistence test passed.');"
set "RC=%ERRORLEVEL%"
rmdir /s /q "%TESTROOT%" >nul 2>nul
exit /b %RC%
