[CmdletBinding()]
param(
    [string]$ShortcutName = 'DePara.lnk'
)

$ErrorActionPreference = 'Stop'

$desktop = [Environment]::GetFolderPath('Desktop')
if (-not $desktop) {
    $desktop = Join-Path $HOME 'Desktop'
}

$shortcutPath = Join-Path $desktop $ShortcutName
$target = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
$launcher = Join-Path $PSScriptRoot 'open-depara.ps1'

if (-not (Test-Path -LiteralPath $launcher)) {
    throw "Lançador não encontrado: $launcher"
}

$shell = New-Object -ComObject WScript.Shell
try {
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $target
    $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$launcher`""
    $shortcut.WorkingDirectory = Split-Path -Parent $PSScriptRoot
    $shortcut.Description = 'Inicia e abre o DePara local'
    $shortcut.IconLocation = "$target,0"
    $shortcut.WindowStyle = 7
    $shortcut.Save()
    Write-Output "Atalho criado: $shortcutPath"
} finally {
    if ($shortcut) {
        [void][Runtime.InteropServices.Marshal]::ReleaseComObject($shortcut)
    }
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($shell)
}
