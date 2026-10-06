# SPDX-License-Identifier: AGPL-3.0-or-later
& (Join-Path $PSScriptRoot 'netrcol\scripts\local.ps1') -Action Stop
exit $LASTEXITCODE
