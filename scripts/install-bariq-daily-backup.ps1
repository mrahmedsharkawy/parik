param(
  [string]$Destination = 'D:\BariqBackups',
  [ValidatePattern('^([01]\d|2[0-3]):[0-5]\d$')]
  [string]$DailyTime = '02:00',
  [ValidateRange(7, 365)]
  [int]$RetentionDays = 45
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$backupScript = Join-Path $PSScriptRoot 'bariq-full-dr-backup.ps1'
if (-not (Test-Path -LiteralPath $backupScript)) { throw 'Backup script is missing.' }

$resolvedDestination = [System.IO.Path]::GetFullPath($Destination)
$resolvedProject = [System.IO.Path]::GetFullPath($projectRoot)
if ($resolvedDestination.StartsWith($resolvedProject, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw 'The scheduled backup destination must be outside the Git project.'
}
New-Item -ItemType Directory -Path $resolvedDestination -Force | Out-Null

$logDirectory = Join-Path $resolvedDestination 'logs'
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
$logPath = Join-Path $logDirectory 'daily-backup.log'
$command = "& '$($backupScript.Replace("'", "''"))' -Destination '$($resolvedDestination.Replace("'", "''"))' -RetentionDays $RetentionDays *>> '$($logPath.Replace("'", "''"))'"
$encodedCommand = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))
$arguments = "-NoProfile -ExecutionPolicy Bypass -EncodedCommand $encodedCommand"
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arguments -WorkingDirectory $projectRoot
$at = [DateTime]::Today.Add([TimeSpan]::Parse($DailyTime))
$trigger = New-ScheduledTaskTrigger -Daily -At $at
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 6)
$principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName 'Bariq Gifts Daily Full Backup' -Description 'Daily PostgreSQL and Supabase Storage disaster-recovery backup for Bariq Gifts.' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null

Write-Host 'Scheduled task installed successfully.'
Write-Host "Time: $DailyTime (local device time)"
Write-Host "Destination: $resolvedDestination"
Write-Host "Retention: $RetentionDays days"
Write-Host 'The task uses StartWhenAvailable, so Windows retries after the device is turned on.'
