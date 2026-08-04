[CmdletBinding()]
param(
    [switch]$SkipStart
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Assert-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    $isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

    if (-not $isAdmin) {
        throw 'Execute este script em um PowerShell elevado como Administrador.'
    }
}

Assert-Administrator

$runtimeRoot = Join-Path $env:ProgramData 'DePara'
$serviceExe = Join-Path $PSScriptRoot 'DeParaService.exe'
$serviceConfig = Join-Path $PSScriptRoot 'DeParaService.xml'
$nodeExe = Join-Path $PSScriptRoot 'runtime\node.exe'
$appEntry = Join-Path $PSScriptRoot 'app\scripts\start-windows.js'

foreach ($requiredPath in @($serviceExe, $serviceConfig, $nodeExe, $appEntry)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
        throw "Artefato obrigatório ausente: $requiredPath"
    }
}

$directories = @(
    $runtimeRoot,
    (Join-Path $runtimeRoot 'data'),
    (Join-Path $runtimeRoot 'logs'),
    (Join-Path $runtimeRoot 'backups'),
    (Join-Path $runtimeRoot 'temp'),
    (Join-Path $runtimeRoot 'releases'),
    (Join-Path $runtimeRoot 'current')
)

foreach ($directory in $directories) {
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
}

$configPath = Join-Path $runtimeRoot 'config.env'
if (-not (Test-Path -LiteralPath $configPath)) {
    @(
        'HOST=127.0.0.1',
        'PORT=3001',
        'NODE_ENV=production',
        "DEPARA_RUNTIME_ROOT=$runtimeRoot",
        "DEPARA_CONFIG_ENV_PATH=$configPath",
        'DEPARA_PLATFORM_TARGET=windows',
        'DEPARA_WINDOWS_SERVICE=true',
        'DEPARA_DISABLE_UPDATE_SCHEDULER=true',
        'DEPARA_ALLOW_SYSTEMD_FALLBACK=false',
        'LOG_LEVEL=warn',
        'LOG_TO_CONSOLE=false'
    ) | Set-Content -LiteralPath $configPath -Encoding UTF8
}

& $serviceExe install
if ($LASTEXITCODE -ne 0) {
    throw "Falha ao instalar o serviço DePara. Código: $LASTEXITCODE"
}

if (-not $SkipStart) {
    & $serviceExe start
    if ($LASTEXITCODE -ne 0) {
        throw "Serviço instalado, mas não iniciou. Código: $LASTEXITCODE"
    }
}

Write-Host "Serviço DePara instalado. Runtime persistente: $runtimeRoot"
Write-Host 'Valide com: Invoke-RestMethod http://127.0.0.1:3001/health'
