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

Assert-Administrator

$serviceName = 'DePara'
$runtimeRoot = Join-Path $env:ProgramData 'DePara'
$serviceExe = Join-Path $PSScriptRoot 'DeParaService.exe'
$existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue

if ($null -ne $existingService) {
    if (Test-Path -LiteralPath $serviceExe) {
        if ($existingService.Status -ne 'Stopped') {
            & $serviceExe stop
            if ($LASTEXITCODE -ne 0) {
                throw "Falha ao parar o serviço DePara. Código: $LASTEXITCODE"
            }
        }

        & $serviceExe uninstall
        if ($LASTEXITCODE -ne 0) {
            throw "Falha ao remover o serviço DePara. Código: $LASTEXITCODE"
        }
    } else {
        if ($existingService.Status -ne 'Stopped') {
            Stop-Service -Name $serviceName -Force
        }

        & sc.exe delete $serviceName | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Executável WinSW ausente e sc.exe não removeu o serviço. Código: $LASTEXITCODE"
        }
    }

    Wait-ServiceAbsent -Name $serviceName
} else {
    Write-Host 'O serviço DePara já não está instalado.'
}

if ($PurgeData) {
    if (Test-Path -LiteralPath $runtimeRoot) {
        Remove-Item -LiteralPath $runtimeRoot -Recurse -Force
    }
    Write-Host "Serviço e dados removidos: $runtimeRoot"
} else {
    Write-Host "Serviço removido. Dados preservados em: $runtimeRoot"
}
