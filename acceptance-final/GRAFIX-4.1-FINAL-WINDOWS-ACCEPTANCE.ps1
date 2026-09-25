$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$SourceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$RuntimeRoot = Join-Path $SourceRoot 'acceptance-final-runtime'
$LogRoot = Join-Path $SourceRoot 'acceptance-final-logs'
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$Log = Join-Path $LogRoot "windows-final-$Stamp.log"
$ExpectedSolver = '0.9.1'
$ExpectedVersion = '4.1.0'
$script:FinalStatus = 'NOT TESTED'

New-Item -ItemType Directory -Force -Path $LogRoot | Out-Null
New-Item -ItemType Directory -Force -Path $RuntimeRoot | Out-Null
Start-Transcript -Path $Log -Force | Out-Null

function Out([string]$Message) { Write-Host $Message }
function Section([string]$Name) { Write-Host "`n===== $Name =====" }
function Fail([string]$Message) { throw "FAIL: $Message" }
function Block([string]$Message) { throw "BLOCKED: $Message" }

function Invoke-Native([string]$FileName, [string[]]$Arguments, [string]$WorkingDirectory = $SourceRoot) {
    $cmd = Get-Command $FileName -ErrorAction Stop
    $resolved = $cmd.Source
    if ($FileName -eq 'npm' -and (Test-Path 'C:\Program Files\nodejs\npm.cmd')) { $resolved = 'C:\Program Files\nodejs\npm.cmd' }
    if ($FileName -eq 'npx' -and (Test-Path 'C:\Program Files\nodejs\npx.cmd')) { $resolved = 'C:\Program Files\nodejs\npx.cmd' }
    $argText = $Arguments -join ' '
    Out "RUN: $resolved $argText"
    Out "CWD: $WorkingDirectory"
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $resolved
    $psi.WorkingDirectory = $WorkingDirectory
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true
    $escaped = $Arguments | ForEach-Object {
        $v = [string]$_
        if ($v -match '[\s"]') { '"' + ($v -replace '\\', '\\' -replace '"', '\"') + '"' } else { $v }
    }
    $psi.Arguments = $escaped -join ' '
    $p = New-Object System.Diagnostics.Process
    $p.StartInfo = $psi
    if (-not $p.Start()) { throw "Could not start: $resolved" }
    $stdout = $p.StandardOutput.ReadToEnd()
    $stderr = $p.StandardError.ReadToEnd()
    $p.WaitForExit()
    if ($stdout) { Out $stdout.TrimEnd() }
    if ($stderr) { Out $stderr.TrimEnd() }
    $exit = [int]$p.ExitCode
    $p.Dispose()
    Out "EXIT CODE: $exit"
    return $exit
}

function Invoke-ProcessWithEnvironment([string]$Exe, [string[]]$Arguments, [hashtable]$Environment, [string]$WorkingDirectory, [int]$TimeoutMs = 180000) {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $Exe
    $psi.WorkingDirectory = $WorkingDirectory
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true
    $argText = $Arguments | ForEach-Object {
        $v = [string]$_
        if ($v -match '[\s"]') { '"' + ($v -replace '\\', '\\' -replace '"', '\"') + '"' } else { $v }
    }
    $psi.Arguments = $argText -join ' '
    foreach ($entry in $Environment.GetEnumerator()) { $psi.EnvironmentVariables[$entry.Key] = [string]$entry.Value }
    $p = New-Object System.Diagnostics.Process
    $p.StartInfo = $psi
    if (-not $p.Start()) { throw "Could not start packaged application: $Exe" }
    if (-not $p.WaitForExit($TimeoutMs)) {
        try { $p.Kill() } catch (_) {}
        throw "Packaged application did not exit within $TimeoutMs ms."
    }
    $stdout = $p.StandardOutput.ReadToEnd()
    $stderr = $p.StandardError.ReadToEnd()
    $exit = [int]$p.ExitCode
    if ($stdout) { Out $stdout.TrimEnd() }
    if ($stderr) { Out $stderr.TrimEnd() }
    $p.Dispose()
    return $exit
}

function Invoke-PackagedUI([string]$Exe, [string]$Phase, [string]$UserData) {
    New-Item -ItemType Directory -Force -Path $UserData | Out-Null
    $result = Join-Path $UserData 'ui-acceptance-result.json'
    if (Test-Path $result) { Remove-Item -Force $result }
    $env = @{
        GRAFIX_UI_ACCEPTANCE = '1'
        GRAFIX_UI_ACCEPTANCE_DATA = $UserData
        GRAFIX_UI_ACCEPTANCE_RESULT = $result
    }
    $exit = Invoke-ProcessWithEnvironment $Exe @("--ui-$Phase") $env (Split-Path -Parent $Exe)
    if ($exit -ne 0) { Fail "Packaged UI $Phase exited with $exit." }
    if (-not (Test-Path $result)) { Fail "Packaged UI $Phase did not create result evidence." }
    try { $json = Get-Content -Raw -LiteralPath $result | ConvertFrom-Json } catch { Fail "Could not parse UI result: $($_.Exception.Message)" }
    if (-not $json.ok) { Fail "Packaged UI $Phase reports failure: $($json.error)" }
    return $json
}

function FindPackagedExe([string]$InstallDir) {
    $candidates = @(Get-ChildItem -LiteralPath $InstallDir -Filter '*.exe' -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -notmatch 'unins|Setup|Update' })
    if ($candidates.Count -eq 0) { throw "Installed Grafix executable not found under $InstallDir" }
    return $candidates[0].FullName
}

try {
    Push-Location $SourceRoot

    Section 'ENVIRONMENT'
    $os = Get-CimInstance Win32_OperatingSystem
    $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
    $cs = Get-CimInstance Win32_ComputerSystem
    Out "OS: $($os.Caption)"
    Out "Build: $($os.BuildNumber)"
    Out "Architecture: $($os.OSArchitecture)"
    Out "CPU: $($cpu.Name)"
    Out "RAM_GB: $([math]::Round($cs.TotalPhysicalMemory/1GB,2))"
    Out "PowerShell: $($PSVersionTable.PSVersion)"

    Section 'PACKAGE METADATA'
    $pkg = Get-Content -Raw -LiteralPath 'package.json' | ConvertFrom-Json
    if ([string]$pkg.version -ne $ExpectedVersion) { Fail "Expected package version $ExpectedVersion but found $($pkg.version)." }
    if ([string]$pkg.dependencies.'or-tools-wasm' -ne $ExpectedSolver) { Fail 'or-tools-wasm version mismatch.' }
    Out "Grafix version: $($pkg.version)"
    Out "or-tools-wasm: $($pkg.dependencies.'or-tools-wasm')"

    Section 'NODE / NPM / NETWORK'
    if ((Invoke-Native 'node' @('--version')) -ne 0) { Fail 'node --version failed.' }
    if ((Invoke-Native 'npm' @('--version')) -ne 0) { Fail 'npm --version failed.' }
    if ((Invoke-Native 'npm' @('config','get','registry')) -ne 0) { Fail 'npm registry check failed.' }
    if ((Invoke-Native 'npm' @('ping')) -ne 0) { Fail 'npm ping failed.' }
    Test-NetConnection registry.npmjs.org -Port 443 | Out-String | ForEach-Object { Out $_.TrimEnd() }

    Section 'DEPENDENCIES'
    if ((Invoke-Native 'npm' @('install','--no-audit','--no-fund')) -ne 0) { Fail 'npm install failed.' }
    if ((Invoke-Native 'npm' @('ls','or-tools-wasm','--depth=0')) -ne 0) { Fail 'or-tools-wasm dependency missing.' }

    Section 'STATIC / CORE / SOLVER REGRESSION'
    foreach ($script in @(
        @('node',@('scripts_check.js')),
        @('npm',@('run','test:solver-api')),
        @('npm',@('run','test:solver-foundation')),
        @('npm',@('run','test:all')),
        @('npm',@('run','test:performance')),
        @('npm',@('run','test:electron-solver')),
        @('npm',@('run','test:electron-ui'))
    )) {
        if ((Invoke-Native $script[0] $script[1]) -ne 0) { Fail "$($script[0]) $($script[1] -join ' ') failed." }
    }

    Section 'WINDOWS PACKAGING'
    if ((Invoke-Native 'npm' @('run','dist:win')) -ne 0) { Fail 'Windows packaging failed.' }
    $setup = Join-Path $SourceRoot 'release\Grafix-4.1-Setup.exe'
    $portable = Join-Path $SourceRoot 'release\Grafix-4.1-Portable.exe'
    if (-not (Test-Path $setup)) { Fail "Missing final Setup artifact: $setup" }
    if (-not (Test-Path $portable)) { Fail "Missing final Portable artifact: $portable" }
    foreach ($f in @($setup,$portable)) {
        $h=Get-FileHash -LiteralPath $f -Algorithm SHA256
        $info=Get-Item $f
        Out "$($info.Name) SIZE=$($info.Length) SHA256=$($h.Hash)"
    }

    Section 'CLEAN INSTALL / PACKAGED UI'
    $installDir = Join-Path $RuntimeRoot 'installed'
    $userData = Join-Path $RuntimeRoot 'data-4.1.0'
    if (Test-Path $installDir) { Remove-Item -Recurse -Force $installDir }
    if (Test-Path $userData) { Remove-Item -Recurse -Force $userData }
    $installExit = Invoke-ProcessWithEnvironment $setup @('/S',"/D=$installDir") @{} $SourceRoot 180000
    if ($installExit -ne 0) { Fail "Setup installer exited with $installExit." }
    $installedExe = FindPackagedExe $installDir
    Out "Installed EXE: $installedExe"
    $write = Invoke-PackagedUI $installedExe 'write' $userData
    $read = Invoke-PackagedUI $installedExe 'read' $userData
    if ($write.version -ne '4.1.0' -or $read.version -ne '4.1.0') { Fail 'Installed packaged app version evidence mismatch.' }
    if (-not $write.summary.navViews -or -not $read.summary.navViews) { Fail 'Packaged UI navigation evidence failed.' }
    if (-not $write.summary.backup -or -not $write.summary.restore) { Fail 'Packaged backup/restore evidence failed.' }
    if (-not $write.summary.exports) { Fail 'Packaged export evidence failed.' }
    if (-not $write.summary.history.tested -or -not $write.summary.history.undo -or -not $write.summary.history.redo) { Fail 'Packaged undo/redo evidence failed.' }
    if ($read.data.organization.name -ne 'Grafix 4.1 UI E2E') { Fail 'Packaged data persistence evidence failed.' }
    foreach ($f in $write.summary.exportFiles) {
        $path = Join-Path $userData $f
        if (-not (Test-Path $path)) { Fail "Expected export evidence file missing: $f" }
        $size=(Get-Item $path).Length
        if ($size -le 0) { Fail "Export evidence file is empty: $f" }
        Out "UI export evidence: $f SIZE=$size"
    }
    $desktopLinks = @(Get-ChildItem (Join-Path $env:USERPROFILE 'Desktop') -Filter '*.lnk' -File -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -ge (Get-Date).AddMinutes(-5) -and $_.Name -match 'Графикс|Grafix' })
    $menu = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
    $menuLinks = @(Get-ChildItem $menu -Recurse -Filter '*.lnk' -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'Графикс|Grafix' -and $_.LastWriteTime -ge (Get-Date).AddMinutes(-5) })
    if ($desktopLinks.Count -lt 1) { Fail 'Desktop shortcut was not created.' }
    if ($menuLinks.Count -lt 1) { Fail 'Start Menu shortcut was not created.' }
    Out "Desktop shortcuts: $($desktopLinks.Name -join ', ')"
    Out "Start Menu shortcuts: $($menuLinks.Name -join ', ')"

    Section 'PORTABLE'
    $portableData = Join-Path $RuntimeRoot 'data-portable'
    if (Test-Path $portableData) { Remove-Item -Recurse -Force $portableData }
    $pwrite = Invoke-PackagedUI $portable 'write' $portableData
    $pread = Invoke-PackagedUI $portable 'read' $portableData
    if ($pwrite.version -ne '4.1.0' -or $pread.version -ne '4.1.0') { Fail 'Portable version evidence mismatch.' }
    if ($pread.data.organization.name -ne 'Grafix 4.1 UI E2E') { Fail 'Portable persistence evidence failed.' }

    Section 'UPDATE 4.1.0 -> 4.1.1'
    $pkgBackup = Join-Path $RuntimeRoot 'package.json.before-update'
    $lockBackup = Join-Path $RuntimeRoot 'package-lock.json.before-update'
    Copy-Item 'package.json' $pkgBackup -Force
    if (Test-Path 'package-lock.json') { Copy-Item 'package-lock.json' $lockBackup -Force }
    try {
        $nodeUpdate = @"
const fs=require('fs');
for(const f of ['package.json','package-lock.json']){if(!fs.existsSync(f))continue;const p=JSON.parse(fs.readFileSync(f,'utf8'));p.version='4.1.1';if(f==='package-lock.json'&&p.packages&&p.packages[''])p.packages[''].version='4.1.1';fs.writeFileSync(f,JSON.stringify(p,null,2)+'\n');}
"@
        $tmpNode = Join-Path $RuntimeRoot 'set-version-411.js'
        Set-Content -LiteralPath $tmpNode -Value $nodeUpdate -Encoding UTF8
        if ((Invoke-Native 'node' @($tmpNode)) -ne 0) { Fail 'Could not prepare update version.' }
        $updateOut = Join-Path $SourceRoot 'release-update'
        if (Test-Path $updateOut) { Remove-Item -Recurse -Force $updateOut }
        if ((Invoke-Native 'npx' @('electron-builder','--win','nsis','--config.directories.output=release-update')) -ne 0) { Fail 'Update packaging failed.' }
        $updateSetup = Join-Path $updateOut 'Grafix-4.1-Setup.exe'
        if (-not (Test-Path $updateSetup)) { Fail 'Update Setup artifact missing.' }
        $updateHash=Get-FileHash -LiteralPath $updateSetup -Algorithm SHA256
        Out "Update Setup SHA256=$($updateHash.Hash)"
        $updateExit = Invoke-ProcessWithEnvironment $updateSetup @('/S',"/D=$installDir") @{} $SourceRoot 180000
        if ($updateExit -ne 0) { Fail "Update installer exited with $updateExit." }
        $updatedExe = FindPackagedExe $installDir
        $updatedRead = Invoke-PackagedUI $updatedExe 'read' $userData
        if ($updatedRead.version -ne '4.1.1') { Fail "Installed update did not report 4.1.1; got $($updatedRead.version)." }
        if ($updatedRead.data.organization.name -ne 'Grafix 4.1 UI E2E') { Fail 'User data did not survive update.' }
    }
    finally {
        Copy-Item $pkgBackup 'package.json' -Force
        if (Test-Path $lockBackup) { Copy-Item $lockBackup 'package-lock.json' -Force }
        if (Test-Path $RuntimeRoot\set-version-411.js) { Remove-Item $RuntimeRoot\set-version-411.js -Force }
    }

    Section 'UNINSTALL / REINSTALL'
    $uninstaller = @(Get-ChildItem -LiteralPath $installDir -Recurse -Filter 'Uninstall*.exe' -File -ErrorAction SilentlyContinue | Select-Object -First 1)
    if ($uninstaller.Count -eq 0) { Fail 'Uninstaller not found.' }
    $uExit = Invoke-ProcessWithEnvironment $uninstaller[0].FullName @('/S') @{} $SourceRoot 180000
    if ($uExit -ne 0) { Fail "Uninstaller exited with $uExit." }
    Start-Sleep -Seconds 3
    if (Test-Path $installedExe) { Fail 'Installed executable still exists after uninstall.' }
    Out 'Uninstall: PASS'

    if (Test-Path $installDir) { Remove-Item -Recurse -Force $installDir -ErrorAction SilentlyContinue }
    $reinstallData = Join-Path $RuntimeRoot 'data-reinstall'
    if (Test-Path $reinstallData) { Remove-Item -Recurse -Force $reinstallData }
    $reinstallExit = Invoke-ProcessWithEnvironment $setup @('/S',"/D=$installDir") @{} $SourceRoot 180000
    if ($reinstallExit -ne 0) { Fail "Reinstall installer exited with $reinstallExit." }
    $reinstalledExe = FindPackagedExe $installDir
    $reinstallWrite = Invoke-PackagedUI $reinstalledExe 'write' $reinstallData
    if ($reinstallWrite.version -ne '4.1.0') { Fail 'Reinstall version mismatch.' }
    if (-not $reinstallWrite.summary.navViews) { Fail 'Reinstall UI did not launch successfully.' }

    Section 'FINAL HASHES'
    $finalArtifacts = @($setup,$portable)
    foreach ($f in $finalArtifacts) {
        $h=Get-FileHash -LiteralPath $f -Algorithm SHA256
        Out "ARTIFACT: $([IO.Path]::GetFileName($f)) SIZE=$((Get-Item $f).Length) SHA256=$($h.Hash)"
    }

    $script:FinalStatus = 'PASS'
    Out 'GRAFIX 4.1 FINAL WINDOWS ACCEPTANCE: PASS'
    Out "Log: $Log"
}
catch {
    $msg = $_.Exception.Message
    if ($msg -like 'BLOCKED:*') { $script:FinalStatus = 'BLOCKED' } else { $script:FinalStatus = 'FAIL' }
    Out "GRAFIX 4.1 FINAL WINDOWS ACCEPTANCE: $($script:FinalStatus) ($msg)"
    Out "Log: $Log"
    exit $(if($script:FinalStatus -eq 'BLOCKED'){2}else{1})
}
finally {
    Pop-Location
    Stop-Transcript | Out-Null
}
