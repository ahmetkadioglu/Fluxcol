# SPDX-License-Identifier: AGPL-3.0-or-later
# Installs the local Linux-container prerequisites. Never restarts Windows.
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$netrcolRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$netrcolStateDir = Join-Path $netrcolRoot '.fluxer\local-bootstrap'
New-Item -ItemType Directory -Path $netrcolStateDir -Force | Out-Null
$netrcolStatusPath = Join-Path $netrcolStateDir 'runtime-install.json'
$netrcolState = [ordered]@{ status = 'starting'; step = 'elevation'; restart_required = $false; error = $null }

function Save-NetrcolInstallState {
    $netrcolState | ConvertTo-Json | Set-Content -LiteralPath $netrcolStatusPath -Encoding UTF8
}

Save-NetrcolInstallState
try {
    $netrcolPrincipal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
    if (-not $netrcolPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Run this installer from an elevated PowerShell window.'
    }
    Start-Transcript -Path (Join-Path $netrcolStateDir 'runtime-install.log') -Append | Out-Null
    $netrcolState.status = 'running'
    $netrcolState.step = 'virtual-machine-platform'
    Save-NetrcolInstallState
    $netrcolFeature = Get-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform
    if ($netrcolFeature.State -eq 'EnablePending') {
        $netrcolState.restart_required = $true
    } elseif ($netrcolFeature.State -ne 'Enabled') {
        $netrcolFeatureResult = Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -All -NoRestart
        $netrcolState.restart_required = [bool]$netrcolFeatureResult.RestartNeeded
    }
    foreach ($netrcolPackage in @('Microsoft.WSL', 'Docker.DockerDesktop')) {
        $netrcolState.step = $netrcolPackage
        Save-NetrcolInstallState
        & winget install --id $netrcolPackage --exact --source winget --accept-source-agreements --accept-package-agreements --silent --disable-interactivity
        if ($LASTEXITCODE -eq 3010) {
            $netrcolState.restart_required = $true
        } elseif ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne -1978335189) {
            # 0x8A15002B: the installed package already has the latest available version.
            throw "Package installation failed: $netrcolPackage (exit $LASTEXITCODE). See runtime-install.log."
        }
    }
    $netrcolState.status = 'complete'
    $netrcolState.step = 'done'
    Save-NetrcolInstallState
    Stop-Transcript | Out-Null
} catch {
    $netrcolState.status = 'failed'
    $netrcolState.error = $_.Exception.Message
    Save-NetrcolInstallState
    try { Stop-Transcript | Out-Null } catch {}
    Write-Error $netrcolState.error
    exit 1
}
