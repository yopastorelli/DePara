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
$configuredPort = if ($env:PORT) { [int]$env:PORT } else { 3000 }
if (Test-Path -LiteralPath $defaultConfigPath) {
    foreach ($line in Get-Content -LiteralPath $defaultConfigPath -ErrorAction SilentlyContinue) {
        if ($line -match '^\s*PORT\s*=\s*(\d+)\s*$' -and -not $env:PORT) {
            $configuredPort = [int]$matches[1]
        }
    }
}

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

$shutdownRequested = $false
$controlPath = Join-Path $runtimeRoot 'control\shutdown.json'
if (Test-Path -LiteralPath $controlPath) {
    try {
        $control = Get-Content -LiteralPath $controlPath -Raw | ConvertFrom-Json
        if ($control.token) {
            Invoke-WebRequest `
                -Method Post `
                -Uri "http://127.0.0.1:$configuredPort/internal/shutdown" `
                -Headers @{ 'X-DePara-Shutdown-Token' = [string]$control.token } `
                -UseBasicParsing `
                -TimeoutSec 5 | Out-Null
            $shutdownRequested = $true
            Write-Output 'Solicitação de encerramento gracioso enviada.'
        }
    } catch {
        Write-Warning "Não foi possível solicitar encerramento gracioso: $($_.Exception.Message)"
    }
}

if ($shutdownRequested) {
    $deadline = (Get-Date).AddSeconds(30)
    do {
        Start-Sleep -Milliseconds 250
        $remaining = @(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue | Where-Object {
            $commandLine = $_.CommandLine
            $commandLine -and ($entryCandidates | Where-Object { $commandLine -like "*$_*" })
        })
    } while ($remaining.Count -gt 0 -and (Get-Date) -lt $deadline)
} else {
    $remaining = $processes
}

if ($remaining.Count -gt 0) {
    Write-Warning 'O encerramento gracioso excedeu o limite; usando encerramento forçado como último recurso.'
    foreach ($process in $remaining) {
        Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
    }
    Start-Sleep -Milliseconds 500
    $remaining = @(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue | Where-Object {
        $commandLine = $_.CommandLine
        $commandLine -and ($entryCandidates | Where-Object { $commandLine -like "*$_*" })
    })
}

if ($remaining.Count -gt 0) {
    throw "Não foi possível encerrar todos os processos do DePara: $($remaining.ProcessId -join ',')"
}

Write-Output "DePara encerrado. PID(s)=$($processes.ProcessId -join ',')"
