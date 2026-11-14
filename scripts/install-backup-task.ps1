# Daftarkan backup Firestore harian ke Windows Task Scheduler.
#
# Contoh:
#   powershell -ExecutionPolicy Bypass -File scripts\install-backup-task.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\install-backup-task.ps1 -Time 23:30 -Keep 30
#   powershell -ExecutionPolicy Bypass -File scripts\install-backup-task.ps1 -Uninstall
[CmdletBinding()]
param(
  [string]$TaskName = 'Propertika AI Backup',
  [string]$Time = '02:00',
  [int]$Keep = 14,
  [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

if ($Uninstall) {
  $existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  if (-not $existing) {
    Write-Host "Task '$TaskName' tidak ditemukan."
    exit 0
  }
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Host "Task '$TaskName' dihapus."
  exit 0
}

$runner = Join-Path $PSScriptRoot 'run-backup.cmd'
if (-not (Test-Path $runner)) {
  throw "Tidak menemukan $runner"
}
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
  throw 'npm.cmd tidak ditemukan di PATH. Pastikan Node.js terpasang dan terminal dijalankan ulang.'
}

$argument = '/c ""{0}" {1}"' -f $runner, $Keep
$action = New-ScheduledTaskAction -Execute $env:ComSpec -Argument $argument -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -Daily -At $Time
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Hours 1)

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description 'Backup Firestore Propertika AI ke folder backups/ (harian).' `
  -Force | Out-Null

Write-Host "Task '$TaskName' terdaftar: setiap hari pukul $Time, menyimpan $Keep backup terbaru."
Write-Host "Uji sekarang : Start-ScheduledTask -TaskName '$TaskName'"
Write-Host "Lihat log    : Get-Content backups\backup.log -Tail 20"
Write-Host "Hapus task   : powershell -ExecutionPolicy Bypass -File scripts\install-backup-task.ps1 -Uninstall"
