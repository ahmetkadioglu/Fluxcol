# SPDX-License-Identifier: AGPL-3.0-or-later
[CmdletBinding()]
param([switch]$NoBrowser, [switch]$Build)
& (Join-Path $PSScriptRoot 'netrcol\scripts\local.ps1') -Action Start -NoBrowser:$NoBrowser -Build:$Build
exit $LASTEXITCODE
