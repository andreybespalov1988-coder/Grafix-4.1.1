$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$SourceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$LogRoot = Join-Path $SourceRoot 'acceptance-final-logs'
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$Log = Join-Path $LogRoot "windows-p01-final-$Stamp.log"
$ExpectedPackage = '0.9.1'

New-Item -ItemType Directory -Force -Path $LogRoot | Out-Null
Start-Transcript -Path $Log -Force | Out-Null

function Out([string]$Message) {
    # Start-Transcript owns the log file exclusively on Windows PowerShell 5.1.
    # Do not reopen it with Add-Content; transcript captures all console output.
    Write-Host $Message
}

function Section([string]$Name) {
    Write-Host "`n===== $Name ====="
}

function Fail([string]$Message) {
    Out "FAIL: $Message"
    throw $Message
}

function Invoke-Native([string]$FileName, [string[]]$Arguments) {
    $cmd = Get-Command $FileName -ErrorAction Stop
    $resolved = $cmd.Source
    if ($FileName -eq 'npm' -and (Test-Path 'C:\Program Files\nodejs\npm.cmd')) {
        $resolved = 'C:\Program Files\nodejs\npm.cmd'
    }
    $argText = $Arguments -join ' '
    Out "RUN: $resolved $argText"
    Out "CWD: $SourceRoot"

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $resolved
    $psi.WorkingDirectory = $SourceRoot
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true
    $psi.Arguments = (($Arguments | ForEach-Object {
        $v = [string]$_
        if ($v -match '[\s"]') { '"' + ($v -replace '\\', '\\' -replace '"', '\"') + '"' } else { $v }
    }) -join ' ')

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
    if (-not (Test-Path 'package.json')) { Fail 'package.json not found.' }
    $pkg = Get-Content -Raw -LiteralPath 'package.json' | ConvertFrom-Json
    $declared = [string]$pkg.dependencies.'or-tools-wasm'
    if ($declared -ne $ExpectedPackage) { Fail "or-tools-wasm declaration is '$declared', expected '$ExpectedPackage'." }
    Out "or-tools-wasm: $declared"

    Section 'NODE / NPM'
    if ((Invoke-Native 'node' @('--version')) -ne 0) { Fail 'node --version failed.' }
    if ((Invoke-Native 'npm' @('--version')) -ne 0) { Fail 'npm --version failed.' }
    if ((Invoke-Native 'npm' @('config','get','registry')) -ne 0) { Fail 'npm registry check failed.' }

    Section 'NETWORK'
    Test-NetConnection registry.npmjs.org -Port 443 | Out-String | ForEach-Object { Out $_.TrimEnd() }
    Resolve-DnsName registry.npmjs.org | Out-String | ForEach-Object { Out $_.TrimEnd() }
    if ((Invoke-Native 'npm' @('ping')) -ne 0) { Fail 'npm ping failed.' }

    Section 'DEPENDENCIES'
    if ((Invoke-Native 'npm' @('install','--no-audit','--no-fund')) -ne 0) { Fail 'npm install failed.' }
    if ((Invoke-Native 'npm' @('ls','or-tools-wasm','--depth=0')) -ne 0) { Fail 'npm ls or-tools-wasm failed.' }
    if (-not (Test-Path 'node_modules\or-tools-wasm')) { Fail 'or-tools-wasm package directory missing.' }

    Section 'CP-SAT API SMOKE'
    $ec = Invoke-Native 'npm' @('run','test:solver-api')
    if ($ec -eq 2) { throw 'BLOCKED: CP-SAT dependency/runtime unavailable.' }
    if ($ec -ne 0) { Fail 'CP-SAT API smoke test failed.' }

    Section 'SOLVER FOUNDATION'
    $ec = Invoke-Native 'npm' @('run','test:solver-foundation')
    if ($ec -eq 2) { throw 'BLOCKED: solver foundation reports missing/unavailable CP-SAT runtime.' }
    if ($ec -ne 0) { Fail 'Solver foundation failed.' }

    Section 'FULL REGRESSION'
    if ((Invoke-Native 'npm' @('run','test:all')) -ne 0) { Fail 'Existing regression suite failed.' }

    Section 'SOLVER BENCHMARK'
    if ((Invoke-Native 'node' @('solver_benchmark.js')) -ne 0) { Fail 'Solver benchmark failed.' }

    Section 'ELECTRON SOLVER WORKER'
    if ((Invoke-Native 'npm' @('run','test:electron-solver')) -ne 0) { Fail 'Electron solver worker test failed.' }

    Section 'WINDOWS PACKAGING'
    if ((Invoke-Native 'npm' @('run','dist:win')) -ne 0) { Fail 'Windows packaging failed.' }
    if (-not (Test-Path 'release')) { Fail 'release directory missing after packaging.' }
    $releaseFiles = @(Get-ChildItem -LiteralPath 'release' -File)
    if ($releaseFiles.Count -eq 0) { Fail 'No release files produced.' }
    $releaseFiles | Select-Object Name,Length,LastWriteTime | Format-Table -AutoSize | Out-String | ForEach-Object { Out $_.TrimEnd() }
    foreach ($f in $releaseFiles) {
        $h = Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256
        Out "$($f.Name) SHA256=$($h.Hash)"
    }

    Section 'MANIFEST'
    if (Test-Path 'package-lock.json') {
        $lockHash = (Get-FileHash 'package-lock.json' -Algorithm SHA256).Hash
        Out "package-lock.json SHA256=$lockHash"
    } else {
        Out 'package-lock.json: NOT PRESENT'
    }

    Out 'P0.1 WINDOWS ACCEPTANCE: PASS'
    Out "Log: $Log"
}
catch {
    Out "P0.1 WINDOWS ACCEPTANCE: STOPPED ($($_.Exception.Message))"
    Out "Log: $Log"
    exit 1
}
finally {
    Pop-Location
    Stop-Transcript | Out-Null
}
