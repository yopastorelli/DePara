[CmdletBinding()]
param(
    [switch]$PurgeData
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
if (-not (Test-Path -LiteralPath $serviceExe)) {
    throw "Executável do serviço ausente: $serviceExe"
}

& $serviceExe stop
if ($LASTEXITCODE -ne 0) {
    Write-Warning "O serviço pode já estar parado. Código: $LASTEXITCODE"
}

& $serviceExe uninstall
if ($LASTEXITCODE -ne 0) {
    throw "Falha ao remover o serviço DePara. Código: $LASTEXITCODE"
}

if ($PurgeData) {
    if (Test-Path -LiteralPath $runtimeRoot) {
        Remove-Item -LiteralPath $runtimeRoot -Recurse -Force
    }
    Write-Host "Serviço e dados removidos: $runtimeRoot"
} else {
    Write-Host "Serviço removido. Dados preservados em: $runtimeRoot"
}
