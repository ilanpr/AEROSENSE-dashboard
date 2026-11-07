param([string]$Server = '100.84.156.202', [string]$User = 'aiot4')
$ErrorActionPreference = 'Stop'
$registration = Join-Path $PSScriptRoot '.device-registration.json'
$script = Join-Path $PSScriptRoot 'setup/register_robot.py'
if (!(Test-Path -LiteralPath $registration)) { throw 'Device registration file is missing.' }
$device = Get-Content -LiteralPath $registration -Raw | ConvertFrom-Json
$encoded = [Convert]::ToBase64String([IO.File]::ReadAllBytes($script))
$remote = "python3 -c 'import base64;exec(base64.b64decode(" + '"' + $encoded + '"' + "))'"
Get-Content -LiteralPath $registration -Raw | & ssh -T "$User@$Server" $remote
if ($LASTEXITCODE -ne 0) { throw 'Registration did not complete. Local credentials were not activated.' }
$envPath = Join-Path $PSScriptRoot '.env.local'
$lines = if (Test-Path -LiteralPath $envPath) { @(Get-Content -LiteralPath $envPath) } else { @() }
$lines = @($lines | Where-Object { $_ -notmatch '^(AEROSENSE_API_URL|AEROBOT_DEVICE_ID|AEROBOT_DEVICE_KEY)=' })
$lines += 'AEROSENSE_API_URL=https://aerosense.me/api'
$lines += "AEROBOT_DEVICE_ID=$($device.robot_id)"
$lines += "AEROBOT_DEVICE_KEY=$($device.key)"
Set-Content -LiteralPath $envPath -Value $lines -Encoding utf8
Write-Host 'Robot registered. Restart start.mjs to enable the device connection.'
