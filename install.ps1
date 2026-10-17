param(
    [switch]$Production,
    [switch]$CreateShortcut,
    [switch]$Start
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

Write-Host 'Instalando DePara para Windows...' -ForegroundColor Cyan

$nodeVersion = (& node --version 2>$null).Trim()
if ($LASTEXITCODE -ne 0 -or -not $nodeVersion) {
    throw 'Node.js não encontrado. Instale Node.js 18.15.0 ou superior.'
}

$nodeParts = ($nodeVersion -replace '^v', '').Split('.')
$nodeMajor = [int]$nodeParts[0]
$nodeMinor = [int]$nodeParts[1]
if ($nodeMajor -lt 18 -or ($nodeMajor -eq 18 -and $nodeMinor -lt 15)) {
    throw "Node.js $nodeVersion encontrado; o mínimo é Node.js 18.15.0."
}

$npmVersion = (& npm --version 2>$null).Trim()
if ($LASTEXITCODE -ne 0 -or -not $npmVersion) {
    throw 'npm não encontrado.'
}

$npmMajor = [int]($npmVersion.Split('.')[0])
if ($npmMajor -lt 9) {
    throw "npm $npmVersion encontrado; o mínimo é npm 9."
}

$gitVersion = (& git --version 2>$null).Trim()
if ($LASTEXITCODE -ne 0 -or -not $gitVersion) {
    throw 'Git não encontrado. O instalador usa Git para preparar o release imutável do runtime.'
}

if (-not (Get-Command tar -ErrorAction SilentlyContinue)) {
    throw 'tar não encontrado. Instale o Git for Windows ou disponibilize tar no PATH.'
}

$runtimeRoot = if ($env:DEPARA_RUNTIME_ROOT) {
    $env:DEPARA_RUNTIME_ROOT
} else {
    Join-Path $HOME '.depara'
}

$configPath = if ($env:DEPARA_CONFIG_ENV_PATH) {
    $env:DEPARA_CONFIG_ENV_PATH
} else {
    Join-Path $runtimeRoot 'config.env'
}

$runtimeDirectories = @(
    $runtimeRoot,
    (Join-Path $runtimeRoot 'data'),
    (Join-Path $runtimeRoot 'logs'),
    (Join-Path $runtimeRoot 'backups'),
    (Join-Path $runtimeRoot 'temp'),
    (Join-Path $runtimeRoot 'releases'),
    (Join-Path $runtimeRoot 'current')
)

foreach ($directory in $runtimeDirectories) {
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
}

$npmArguments = @('ci')
if ($Production) {
    $npmArguments += '--omit=dev'
}

Write-Host "Instalando dependências com npm $($npmArguments -join ' ')..." -ForegroundColor Yellow
& npm @npmArguments
if ($LASTEXITCODE -ne 0) {
    throw 'Falha ao instalar as dependências.'
}

if (-not (Test-Path -LiteralPath $configPath)) {
    $configDirectory = Split-Path -Parent $configPath
    New-Item -ItemType Directory -Path $configDirectory -Force | Out-Null
    @(
        'HOST=127.0.0.1',
        'PORT=3000',
        'NODE_ENV=production',
        'MAX_PAYLOAD=8mb',
        'LOG_LEVEL=warn',
        'LOG_TO_CONSOLE=false',
        'DEPARA_HTTP_LOGGING=false',
        'DEPARA_REQUEST_METADATA_LOGGING=false',
        'DEPARA_RESOURCE_PROFILE=codex-coexistence',
        'MAX_CONCURRENT_OPERATIONS=1',
        'MAX_RECURSION_DEPTH=10',
        'DEPARA_IMAGE_PAGE_SIZE=250',
        'DEPARA_LOW_MEMORY_PAGE_SIZE=100',
        'DEPARA_MEMORY_WARN_MB=1024',
        'DEPARA_MEMORY_CRITICAL_MB=512',
        'DEPARA_MAX_RSS_MB=192',
        'DEPARA_MAX_CATALOGS=2',
        'DEPARA_SLIDESHOW_PRELOAD=false',
        "DEPARA_RUNTIME_ROOT=$runtimeRoot"
    ) | Set-Content -LiteralPath $configPath -Encoding utf8
}

Write-Host 'Preparando release imutável do runtime...' -ForegroundColor Yellow
& node (Join-Path $PSScriptRoot 'bootstrap-runtime-release.js')
if ($LASTEXITCODE -ne 0) {
    throw 'Falha ao preparar o release imutável do runtime.'
}

if ($CreateShortcut) {
    Write-Host 'Criando atalho do Windows...' -ForegroundColor Yellow
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'scripts\install-shortcut.ps1')
    if ($LASTEXITCODE -ne 0) {
        throw 'Falha ao criar o atalho do Windows.'
    }
}

if ($Start) {
    Write-Host 'Iniciando o DePara...' -ForegroundColor Yellow
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'scripts\start-windows-coexistence.ps1')
    if ($LASTEXITCODE -ne 0) {
        throw 'Falha ao iniciar o DePara.'
    }
    Start-Sleep -Seconds 2
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'scripts\doctor-windows.ps1') -RequireRunning
    if ($LASTEXITCODE -ne 0) {
        throw 'O DePara não passou no diagnóstico pós-inicialização.'
    }
}

Write-Host ''
Write-Host 'Instalação concluída.' -ForegroundColor Green
Write-Host "Runtime: $runtimeRoot"
Write-Host "Configuração: $configPath"
Write-Host 'Inicialização: npm run start:windows'
if ($CreateShortcut) {
    Write-Host 'Atalho: criado na Área de Trabalho'
}
