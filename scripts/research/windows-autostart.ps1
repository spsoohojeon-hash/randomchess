param([switch]$Remove)
$ErrorActionPreference = 'Stop'
$taskName = 'RandomChess-Research'
if ($Remove) {
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host 'Research auto-start removed. Saved games and models are unchanged.'
    exit
}
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$node = (Get-Command node.exe -ErrorAction Stop).Source
$homeDir = if ($env:RESEARCH_HOME) { $env:RESEARCH_HOME } else { Join-Path $env:USERPROFILE '.randomchess-research' }
if ($env:RESEARCH_HOME -or $env:RESEARCH_CONFIG) {
    throw 'Auto-start currently uses the default research folder. Remove RESEARCH_HOME and RESEARCH_CONFIG overrides before setup.'
}
if (!(Test-Path (Join-Path $homeDir 'config.json'))) { throw 'Run pnpm research:setup first.' }
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
# Protect local tokens, games and models with a Windows ACL (chmod is insufficient on Windows).
& icacls.exe $homeDir /inheritance:r /grant:r "*$($identity.User.Value):(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' /T /Q
if ($LASTEXITCODE -ne 0) { throw 'Could not restrict research folder permissions.' }
$action = New-ScheduledTaskAction -Execute $node -Argument ('"' + (Join-Path $root 'scripts/research/collector.mjs') + '"') -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $identity.Name
$principal = New-ScheduledTaskPrincipal -UserId $identity.Name -LogonType Interactive -RunLevel Limited
# Zero execution time limit prevents the default multi-day task cutoff.
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew -StartWhenAvailable -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Write-Host 'Research starts after Windows sign-in. Locking the screen is OK; signing out or sleeping stops collection.'
Write-Host 'Open your private /research page and press Start collection.'
