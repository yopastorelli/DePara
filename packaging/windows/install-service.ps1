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

function Get-ConfigValue {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$DefaultValue
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return $DefaultValue
    }

    $escapedName = [Regex]::Escape($Name)
    $line = Get-Content -LiteralPath $Path |
        Where-Object { $_ -match "^\s*$escapedName\s*=" } |
        Select-Object -Last 1

    if ($null -eq $line) {
        return $DefaultValue
    }

    return ($line -split '=', 2)[1].Trim()
}

function Wait-ServiceAbsent {
    param([string]$Name)

    for ($attempt = 1; $attempt -le 30; $attempt += 1) {
        if ($null -eq (Get-Service -Name $Name -ErrorAction SilentlyContinue)) {
            return
        }
        Start-Sleep -Milliseconds 500
    }

    throw "O serviço $Name não foi removido dentro do tempo esperado."
}

function Wait-HealthyEndpoint {
    param(
        [string]$Url,
        [string]$LogDirectory
    )

    for ($attempt = 1; $attempt -le 30; $attempt += 1) {
        try {
            $health = Invoke-RestMethod -Uri $Url -TimeoutSec 2
            if ($health.status -eq 'OK') {
                return $health
            }
        } catch {
            Start-Sleep -Seconds 1
        }
    }

    if (Test-Path -LiteralPath $LogDirectory) {
        Get-ChildItem -LiteralPath $LogDirectory -File -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 3 |
            ForEach-Object {
                Write-Warning "Últimas linhas de $($_.FullName):"
                Get-Content -LiteralPath $_.FullName -Tail 80 -ErrorAction SilentlyContinue
            }
    }

    throw "O serviço foi iniciado, mas não ficou saudável em $Url."
}

Assert-Administrator

$serviceName = 'DePara'
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

$nodeVersion = (& $nodeExe --version).Trim()
if ($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v(?<major>\d+)\.') {
    throw "Runtime Node empacotado inválido: $nodeVersion"
}

$nodeMajor = [int]$Matches.major
if ($nodeMajor -notin @(22, 24)) {
    throw "Runtime Node não certificado: $nodeVersion. Use Node 22 ou 24 LTS."
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
    ) | Set-Content -LiteralPath $configPath -Encoding utf8
}

$configuredHost = Get-ConfigValue -Path $configPath -Name 'HOST' -DefaultValue '127.0.0.1'
if ($configuredHost -ne '127.0.0.1') {
    throw "HOST inseguro em config.env: $configuredHost. O instalador aceita apenas 127.0.0.1."
}

$configuredPortText = Get-ConfigValue -Path $configPath -Name 'PORT' -DefaultValue '3001'
$configuredPort = 0
if (-not [int]::TryParse($configuredPortText, [ref]$configuredPort) -or $configuredPort -lt 1 -or $configuredPort -gt 65535) {
    throw "PORT inválida em config.env: $configuredPortText"
}

$existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($null -ne $existingService) {
    if ($existingService.Status -ne 'Stopped') {
        & $serviceExe stop
        if ($LASTEXITCODE -ne 0) {
            throw "Falha ao parar o serviço existente. Código: $LASTEXITCODE"
        }
    }

    & $serviceExe uninstall
    if ($LASTEXITCODE -ne 0) {
        throw "Falha ao remover o registro anterior do serviço. Código: $LASTEXITCODE"
    }
    Wait-ServiceAbsent -Name $serviceName
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

    $healthUrl = "http://127.0.0.1:$configuredPort/health"
    Wait-HealthyEndpoint -Url $healthUrl -LogDirectory (Join-Path $runtimeRoot 'logs') | Out-Null
    Write-Host "Health validado: $healthUrl"
}

Write-Host "Serviço DePara instalado com Node $nodeVersion. Runtime persistente: $runtimeRoot"
