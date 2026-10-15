[CmdletBinding()]
param(
    [int]$Port = 0
)

$ErrorActionPreference = 'Stop'

$runtimeRoot = Join-Path $HOME '.depara'
$currentEntry = Join-Path $runtimeRoot 'current\src\main.js'
$sourceEntry = Join-Path $PSScriptRoot '..\src\main.js'
$entryPoint = if (Test-Path -LiteralPath $currentEntry) { $currentEntry } else { (Resolve-Path -LiteralPath $sourceEntry).Path }
$node = (Get-Command node -ErrorAction Stop).Path

$env:NODE_ENV = 'production'
$env:DEPARA_RESOURCE_PROFILE = 'codex-coexistence'
$env:MAX_CONCURRENT_OPERATIONS = '1'
$env:MAX_RECURSION_DEPTH = '10'
$env:DEPARA_IMAGE_PAGE_SIZE = '250'
$env:DEPARA_LOW_MEMORY_PAGE_SIZE = '100'
$env:DEPARA_MEMORY_WARN_MB = '1024'
$env:DEPARA_MEMORY_CRITICAL_MB = '512'
$env:DEPARA_MAX_RSS_MB = '192'
$env:DEPARA_CATALOG_TTL_MINUTES = '30'
$env:DEPARA_MAX_CATALOGS = '2'
$env:DEPARA_SLIDESHOW_PRELOAD = 'false'
$env:DEPARA_HTTP_LOGGING = 'false'
$env:LOG_LEVEL = 'warn'
$env:LOG_TO_CONSOLE = 'false'
$env:MAX_PAYLOAD = '8mb'
$env:NODE_OPTIONS = '--max-old-space-size=128'
$env:DEPARA_DISABLE_UPDATE_SCHEDULER = 'true'
$env:DEPARA_DISABLE_UPDATE_SIDE_EFFECTS = 'true'

if ($Port -gt 0) {
    $env:PORT = [string]$Port
}

$process = Start-Process `
    -FilePath $node `
    -ArgumentList @($entryPoint) `
    -WorkingDirectory (Split-Path -Parent $entryPoint) `
    -WindowStyle Hidden `
    -PassThru

try {
    $process.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::BelowNormal
} catch {
    Write-Warning "Não foi possível aplicar prioridade BelowNormal ao processo $($process.Id)."
}

Write-Output "DePara iniciado de forma independente. PID=$($process.Id); prioridade=BelowNormal; entrada=$entryPoint"
