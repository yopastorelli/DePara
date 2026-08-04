[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$NodeArchivePath,
    [Parameter(Mandatory = $true)][string]$NodeArchiveSha256,
    [Parameter(Mandatory = $true)][string]$WinSWPath,
    [Parameter(Mandatory = $true)][string]$WinSWSha256,
    [string]$OutputDirectory = (Join-Path $PSScriptRoot 'dist')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Assert-FileHash {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$ExpectedSha256
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Arquivo ausente: $Path"
    }

    $actual = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
    $expected = $ExpectedSha256.Trim().ToLowerInvariant()
    if ($actual -ne $expected) {
        throw "SHA-256 inválido para $Path. Esperado: $expected; obtido: $actual"
    }
}

function Copy-AppContent {
    param(
        [Parameter(Mandatory = $true)][string]$RepoRoot,
        [Parameter(Mandatory = $true)][string]$AppRoot
    )

    New-Item -ItemType Directory -Path $AppRoot -Force | Out-Null

    foreach ($fileName in @('package.json', 'package-lock.json', 'LICENSE')) {
        $source = Join-Path $RepoRoot $fileName
        if (Test-Path -LiteralPath $source -PathType Leaf) {
            Copy-Item -LiteralPath $source -Destination (Join-Path $AppRoot $fileName) -Force
        }
    }

    foreach ($directoryName in @('src', 'scripts')) {
        $source = Join-Path $RepoRoot $directoryName
        if (-not (Test-Path -LiteralPath $source -PathType Container)) {
            throw "Diretório da aplicação ausente: $source"
        }
        Copy-Item -LiteralPath $source -Destination (Join-Path $AppRoot $directoryName) -Recurse -Force
    }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$nodeArchive = (Resolve-Path $NodeArchivePath).Path
$winSWExecutable = (Resolve-Path $WinSWPath).Path
$outputRoot = [IO.Path]::GetFullPath($OutputDirectory)
$stagingRoot = Join-Path $outputRoot 'windows-dist'
$runtimeRoot = Join-Path $stagingRoot 'runtime'
$appRoot = Join-Path $stagingRoot 'app'
$archiveOutput = Join-Path $outputRoot 'DePara-windows-service.zip'
$tempExtract = Join-Path $outputRoot '.node-extract'

Assert-FileHash -Path $nodeArchive -ExpectedSha256 $NodeArchiveSha256
Assert-FileHash -Path $winSWExecutable -ExpectedSha256 $WinSWSha256

Remove-Item -LiteralPath $stagingRoot -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $tempExtract -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $archiveOutput -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
New-Item -ItemType Directory -Path $tempExtract -Force | Out-Null

Expand-Archive -LiteralPath $nodeArchive -DestinationPath $tempExtract -Force
$nodeDistribution = Get-ChildItem -LiteralPath $tempExtract -Directory | Select-Object -First 1
if ($null -eq $nodeDistribution -or -not (Test-Path -LiteralPath (Join-Path $nodeDistribution.FullName 'node.exe'))) {
    throw 'O ZIP do Node não contém uma distribuição Windows válida.'
}

Copy-Item -Path (Join-Path $nodeDistribution.FullName '*') -Destination $runtimeRoot -Recurse -Force
$bundledNode = Join-Path $runtimeRoot 'node.exe'
$bundledNpm = Join-Path $runtimeRoot 'npm.cmd'

$nodeVersion = (& $bundledNode --version).Trim()
if ($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v(?<major>\d+)\.') {
    throw "Runtime Node inválido: $nodeVersion"
}
if ([int]$Matches.major -notin @(22, 24)) {
    throw "Runtime Node não certificado: $nodeVersion. Use Node 22 ou 24 LTS."
}
if (-not (Test-Path -LiteralPath $bundledNpm -PathType Leaf)) {
    throw 'npm.cmd ausente na distribuição Node.'
}

Copy-AppContent -RepoRoot $repoRoot -AppRoot $appRoot

$previousPath = $env:PATH
try {
    $env:PATH = "$runtimeRoot;$previousPath"
    Push-Location $appRoot
    try {
        & $bundledNpm ci --omit=dev
        if ($LASTEXITCODE -ne 0) {
            throw "npm ci --omit=dev falhou. Código: $LASTEXITCODE"
        }
    } finally {
        Pop-Location
    }
} finally {
    $env:PATH = $previousPath
}

Copy-Item -LiteralPath $winSWExecutable -Destination (Join-Path $stagingRoot 'DeParaService.exe') -Force
foreach ($packagingFile in @(
    'DeParaService.xml',
    'install-service.ps1',
    'uninstall-service.ps1',
    'certify-service.ps1',
    'config.env.example'
)) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $packagingFile) -Destination (Join-Path $stagingRoot $packagingFile) -Force
}

$manifestEntries = Get-ChildItem -LiteralPath $stagingRoot -File -Recurse |
    Sort-Object FullName |
    ForEach-Object {
        [pscustomobject]@{
            path = [IO.Path]::GetRelativePath($stagingRoot, $_.FullName)
            sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
            size = $_.Length
        }
    }

[pscustomobject]@{
    product = 'DePara'
    packageType = 'windows-service'
    nodeVersion = $nodeVersion
    sourceCommit = (& git -C $repoRoot rev-parse HEAD).Trim()
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    files = $manifestEntries
} | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $stagingRoot 'manifest.json') -Encoding utf8

Compress-Archive -Path (Join-Path $stagingRoot '*') -DestinationPath $archiveOutput -CompressionLevel Optimal
Remove-Item -LiteralPath $tempExtract -Recurse -Force

Write-Host "Pacote criado: $archiveOutput"
Write-Host "Node empacotado: $nodeVersion"
Write-Host 'O pacote permanece não assinado até a etapa externa de code signing.'
