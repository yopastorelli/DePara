param([Parameter(Mandatory = $true)][string]$LiteralPath)
$ErrorActionPreference = 'Stop'
$item = Get-Item -LiteralPath $LiteralPath -Force
Add-Type -Namespace DePara.Sync -Name VolumeInfo -MemberDefinition @'
[System.Runtime.InteropServices.DllImport("kernel32.dll", CharSet = System.Runtime.InteropServices.CharSet.Unicode, SetLastError = true)]
public static extern bool GetVolumePathName(string fileName, System.Text.StringBuilder volumePathName, uint bufferLength);
[System.Runtime.InteropServices.DllImport("kernel32.dll", CharSet = System.Runtime.InteropServices.CharSet.Unicode, SetLastError = true)]
public static extern bool GetVolumeNameForVolumeMountPoint(string volumeMountPoint, System.Text.StringBuilder volumeName, uint bufferLength);
[System.Runtime.InteropServices.DllImport("kernel32.dll", CharSet = System.Runtime.InteropServices.CharSet.Unicode, SetLastError = true)]
public static extern bool GetVolumeInformation(string rootPathName, System.Text.StringBuilder volumeName, uint volumeNameSize, out uint serialNumber, out uint maximumComponentLength, out uint flags, System.Text.StringBuilder filesystemName, uint filesystemNameSize);
'@
$volumePath = New-Object System.Text.StringBuilder 1024
$volumeName = New-Object System.Text.StringBuilder 1024
$filesystem = New-Object System.Text.StringBuilder 256
$labelBuffer = New-Object System.Text.StringBuilder 256
[uint32]$serialNumber = 0
[uint32]$maximumComponentLength = 0
[uint32]$filesystemFlags = 0
if (-not [DePara.Sync.VolumeInfo]::GetVolumePathName($item.FullName, $volumePath, 1024)) { throw 'Raiz do volume indisponível' }
if (-not [DePara.Sync.VolumeInfo]::GetVolumeNameForVolumeMountPoint($volumePath.ToString(), $volumeName, 1024)) { throw 'Identidade do volume indisponível' }
if (-not [DePara.Sync.VolumeInfo]::GetVolumeInformation($volumePath.ToString(), $labelBuffer, 256, [ref]$serialNumber, [ref]$maximumComponentLength, [ref]$filesystemFlags, $filesystem, 256)) { throw 'Filesystem indisponível' }
@{ id = $volumeName.ToString(); filesystem = $filesystem.ToString() } | ConvertTo-Json -Compress
