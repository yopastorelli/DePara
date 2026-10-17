[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$defaultRuntimeRoot = if ($env:DEPARA_RUNTIME_ROOT) {
    $env:DEPARA_RUNTIME_ROOT
} else {
    Join-Path $HOME '.depara'
}
$defaultConfigPath = if ($env:DEPARA_CONFIG_ENV_PATH) {
    $env:DEPARA_CONFIG_ENV_PATH
} else {
    Join-Path $defaultRuntimeRoot 'config.env'
}

if (Test-Path -LiteralPath $defaultConfigPath) {
    foreach ($line in Get-Content -LiteralPath $defaultConfigPath -ErrorAction SilentlyContinue) {
        if ($line -match '^\s*DEPARA_RUNTIME_ROOT\s*=\s*(.+?)\s*$' -and -not $env:DEPARA_RUNTIME_ROOT) {
            $env:DEPARA_RUNTIME_ROOT = $matches[1].Trim()
        }
    }
}

$runtimeRoot = if ($env:DEPARA_RUNTIME_ROOT) { $env:DEPARA_RUNTIME_ROOT } else { $defaultRuntimeRoot }
$currentEntry = Join-Path $runtimeRoot 'current\src\main.js'
$sourceEntry = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\src\main.js')).Path
$entryCandidates = @($currentEntry, $sourceEntry) | Select-Object -Unique

$processes = @(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue | Where-Object {
    $commandLine = $_.CommandLine
    $commandLine -and ($entryCandidates | Where-Object { $commandLine -like "*$_*" })
})

if ($processes.Count -eq 0) {
    Write-Output 'DePara não está em execução.'
    exit 0
}

foreach ($process in $processes) {
    Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
}

Start-Sleep -Milliseconds 500
$remaining = @(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue | Where-Object {
    $commandLine = $_.CommandLine
    $commandLine -and ($entryCandidates | Where-Object { $commandLine -like "*$_*" })
})

if ($remaining.Count -gt 0) {
    throw "Não foi possível encerrar todos os processos do DePara: $($remaining.ProcessId -join ',')"
}

Write-Output "DePara encerrado. PID(s)=$($processes.ProcessId -join ',')"
