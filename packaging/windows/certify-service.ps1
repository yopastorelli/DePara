[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-ConfigValue {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$DefaultValue
    )

    $escapedName = [Regex]::Escape($Name)
    $line = Get-Content -LiteralPath $Path |
        Where-Object { $_ -match "^\s*$escapedName\s*=" } |
        Select-Object -Last 1

    if ($null -eq $line) {
        return $DefaultValue
    }

    return ($line -split '=', 2)[1].Trim()
}

$serviceName = 'DePara'
$runtimeRoot = Join-Path $env:ProgramData 'DePara'
$configPath = Join-Path $runtimeRoot 'config.env'

$operatingSystem = Get-CimInstance Win32_OperatingSystem
if ($operatingSystem.OSArchitecture -notmatch '64') {
    throw "Arquitetura Windows não suportada: $($operatingSystem.OSArchitecture)"
}

$service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($null -eq $service) {
    throw 'Serviço DePara não está instalado.'
}
if ($service.Status -ne 'Running') {
    throw "Serviço DePara não está em execução: $($service.Status)"
}

$serviceDetails = Get-CimInstance Win32_Service -Filter "Name='$serviceName'"
if ($null -eq $serviceDetails -or $serviceDetails.PathName -notmatch 'DeParaService\.exe') {
    throw "Registro do serviço não aponta para DeParaService.exe: $($serviceDetails.PathName)"
}

if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
    throw "config.env ausente: $configPath"
}

foreach ($requiredDirectory in @('data', 'logs', 'backups', 'temp', 'releases', 'current')) {
    $directoryPath = Join-Path $runtimeRoot $requiredDirectory
    if (-not (Test-Path -LiteralPath $directoryPath -PathType Container)) {
        throw "Diretório de runtime ausente: $directoryPath"
    }
}

$hostValue = Get-ConfigValue -Path $configPath -Name 'HOST' -DefaultValue '127.0.0.1'
$portText = Get-ConfigValue -Path $configPath -Name 'PORT' -DefaultValue '3001'
$portValue = 0

if ($hostValue -ne '127.0.0.1') {
    throw "HOST inseguro: $hostValue"
}
if (-not [int]::TryParse($portText, [ref]$portValue) -or $portValue -lt 1 -or $portValue -gt 65535) {
    throw "PORT inválida: $portText"
}

$baseUrl = "http://127.0.0.1:$portValue"
$health = Invoke-RestMethod -Uri "$baseUrl/health" -TimeoutSec 5
$status = Invoke-RestMethod -Uri "$baseUrl/api/status" -TimeoutSec 5

if ($health.status -ne 'OK') {
    throw "Health inesperado: $($health | ConvertTo-Json -Compress)"
}
if ($status.status -ne 'OPERATIONAL') {
    throw "Status inesperado: $($status | ConvertTo-Json -Compress)"
}

[pscustomobject]@{
    certification = 'WINDOWS_SERVICE_PASS'
    caption = $operatingSystem.Caption
    version = $operatingSystem.Version
    architecture = $operatingSystem.OSArchitecture
    serviceStatus = $service.Status.ToString()
    servicePath = $serviceDetails.PathName
    runtimeRoot = $runtimeRoot
    configPath = $configPath
    url = $baseUrl
    certifiedAt = (Get-Date).ToUniversalTime().ToString('o')
} | ConvertTo-Json -Depth 4
