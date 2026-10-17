[CmdletBinding()]
param(
    [string]$ShortcutName = 'DePara.lnk'
)

$ErrorActionPreference = 'Stop'

$desktop = [Environment]::GetFolderPath('Desktop')
if (-not $desktop) {
    $desktop = Join-Path $HOME 'Desktop'
}

$startMenu = [Environment]::GetFolderPath('StartMenu')
if (-not $startMenu) {
    $startMenu = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu'
}

$startMenuPrograms = Join-Path $startMenu 'Programs'
$shortcutPaths = @(
    (Join-Path $desktop $ShortcutName),
    (Join-Path $startMenuPrograms $ShortcutName)
) | Select-Object -Unique
$target = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
$launcher = Join-Path $PSScriptRoot 'open-depara.ps1'
$icon = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\src\public\favicon\favicon.ico')).Path

if (-not (Test-Path -LiteralPath $launcher)) {
    throw "Lançador não encontrado: $launcher"
}

if (-not (Test-Path -LiteralPath $icon)) {
    throw "Ícone não encontrado: $icon"
}

New-Item -ItemType Directory -Path $startMenuPrograms -Force | Out-Null

$shell = New-Object -ComObject WScript.Shell
try {
    foreach ($shortcutPath in $shortcutPaths) {
        $shortcut = $null
        try {
            $shortcut = $shell.CreateShortcut($shortcutPath)
            $shortcut.TargetPath = $target
            $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$launcher`""
            $shortcut.WorkingDirectory = Split-Path -Parent $PSScriptRoot
            $shortcut.Description = 'Inicia e abre o DePara local no navegador padrão'
            $shortcut.IconLocation = "$icon,0"
            $shortcut.WindowStyle = 7
            $shortcut.Save()
            Write-Output "Atalho criado: $shortcutPath"
        } finally {
            if ($shortcut) {
                [void][Runtime.InteropServices.Marshal]::ReleaseComObject($shortcut)
            }
        }
    }
} finally {
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($shell)
}
