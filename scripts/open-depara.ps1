[CmdletBinding()]
param(
    [string]$Url = '',
    [int]$Port = 0
)

$ErrorActionPreference = 'Stop'

$defaultRuntimeRoot = if ($env:DEPARA_RUNTIME_ROOT) {
    $env:DEPARA_RUNTIME_ROOT
} else {
    Join-Path $HOME '.depara'
}
$configPath = if ($env:DEPARA_CONFIG_ENV_PATH) {
    $env:DEPARA_CONFIG_ENV_PATH
} else {
    Join-Path $defaultRuntimeRoot 'config.env'
}
$configuredPort = $Port

if (Test-Path -LiteralPath $configPath) {
    foreach ($line in Get-Content -LiteralPath $configPath -ErrorAction SilentlyContinue) {
        if ($line -match '^\s*PORT\s*=\s*(\d+)\s*$' -and $configuredPort -eq 0) {
            $configuredPort = [int]$matches[1]
        }
    }
}

$portToUse = if ($configuredPort -gt 0) { $configuredPort } else { 3000 }
$healthUrl = "http://127.0.0.1:$portToUse/health"
$targetUrl = if ($Url) { $Url } else { "http://127.0.0.1:$portToUse/ui" }
$launcher = Join-Path $PSScriptRoot 'start-windows-coexistence.ps1'

function Test-DeParaReady {
    try {
        $health = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 2
        return $health.status -eq 'OK'
    } catch {
        return $false
    }
}

$ready = Test-DeParaReady

if (-not $ready) {
    Start-Process `
        -FilePath (Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe') `
        -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $launcher) `
        -WindowStyle Hidden

    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Milliseconds 500
        if (Test-DeParaReady) {
            $ready = $true
            break
        }
    }
}

if (-not $ready) {
    throw 'O DePara não respondeu ao health check em até 15 segundos.'
}

Start-Process -FilePath $targetUrl
