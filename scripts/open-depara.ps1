[CmdletBinding()]
param(
    [string]$Url = 'http://127.0.0.1:3000/ui'
)

$ErrorActionPreference = 'Stop'

$healthUrl = 'http://127.0.0.1:3000/health'
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

Start-Process -FilePath $Url
