[CmdletBinding()]
param(
    [int]$Port = 0,
    [switch]$RequireRunning
)

$ErrorActionPreference = 'Stop'

$defaultRuntimeRoot = if ($env:DEPARA_RUNTIME_ROOT) {
    $env:DEPARA_RUNTIME_ROOT
} else {
    Join-Path $HOME '.depara'
}
$configPath = if ($env:DEPARA_CONFIG_ENV_PATH) { $env:DEPARA_CONFIG_ENV_PATH } else { Join-Path $defaultRuntimeRoot 'config.env' }
$configuredPort = $Port

if (Test-Path -LiteralPath $configPath) {
    foreach ($line in Get-Content -LiteralPath $configPath -ErrorAction SilentlyContinue) {
        if ($line -match '^\s*DEPARA_RUNTIME_ROOT\s*=\s*(.+?)\s*$' -and -not $env:DEPARA_RUNTIME_ROOT) {
            $env:DEPARA_RUNTIME_ROOT = $matches[1].Trim()
        }
        if ($line -match '^\s*PORT\s*=\s*(\d+)\s*$' -and $configuredPort -eq 0) {
            $configuredPort = [int]$matches[1]
        }
    }
}

$runtimeRoot = if ($env:DEPARA_RUNTIME_ROOT) { $env:DEPARA_RUNTIME_ROOT } else { $defaultRuntimeRoot }
$portToCheck = if ($configuredPort -gt 0) { $configuredPort } else { 3000 }
$releaseMetaPath = Join-Path $runtimeRoot 'current\release.json'
$checks = New-Object System.Collections.Generic.List[object]

function Add-Check {
    param(
        [string]$Name,
        [bool]$Passed,
        [string]$Detail
    )

    $checks.Add([pscustomobject]@{
        Check = $Name
        Status = if ($Passed) { 'PASS' } else { 'FAIL' }
        Detail = $Detail
    })
}

$node = Get-Command node -ErrorAction SilentlyContinue
$npm = Get-Command npm -ErrorAction SilentlyContinue
$git = Get-Command git -ErrorAction SilentlyContinue
Add-Check 'node' ($null -ne $node) $(if ($node) { (& node --version).Trim() } else { 'não encontrado' })
Add-Check 'npm' ($null -ne $npm) $(if ($npm) { (& npm --version).Trim() } else { 'não encontrado' })
Add-Check 'git' ($null -ne $git) $(if ($git) { (& git --version).Trim() } else { 'não encontrado' })
Add-Check 'config' (Test-Path -LiteralPath $configPath) $configPath
Add-Check 'release ativo' (Test-Path -LiteralPath $releaseMetaPath) $releaseMetaPath

$processes = @(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -and $_.CommandLine -like "*$runtimeRoot\current\src\main.js*"
})
Add-Check 'processo único' ($processes.Count -le 1) "PID(s): $($processes.ProcessId -join ',')"

$health = $null
try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$portToCheck/health" -TimeoutSec 3
    Add-Check 'health' ($health.status -eq 'OK') "status=$($health.status); versão=$($health.version)"
} catch {
    Add-Check 'health' (-not $RequireRunning) $_.Exception.Message
}

$failed = @($checks | Where-Object { $_.Status -eq 'FAIL' })
$checks | Format-Table -AutoSize

if ($failed.Count -gt 0) {
    Write-Error "Diagnóstico falhou em $($failed.Count) verificação(ões)."
    exit 1
}

Write-Output 'Diagnóstico do DePara Windows: PASS'
