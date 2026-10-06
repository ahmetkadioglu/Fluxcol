# SPDX-License-Identifier: AGPL-3.0-or-later
[CmdletBinding()]
param(
    [ValidateSet('Start', 'Stop', 'Status', 'Logs', 'Check', 'Prepare')]
    [string]$Action = 'Start',
    [switch]$NoBrowser,
    [switch]$Build
)

$ErrorActionPreference = 'Stop'
$netrcolRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$netrcolEnvPath = Join-Path $netrcolRoot '.fluxer\local\.env'
$netrcolOrigin = 'http://localhost:8088'

function Invoke-NetrcolCompose([string[]]$ComposeArgs) {
    & $netrcolDocker @netrcolComposeBase @ComposeArgs
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose failed (exit $LASTEXITCODE)." }
}

function Get-NetrcolEngine {
    # Docker can stall while WSL is unavailable. Bound each probe independently.
    $netrcolProbe = [Diagnostics.Process]::new()
    try {
        $netrcolProbe.StartInfo.FileName = $netrcolDocker
        $netrcolProbe.StartInfo.Arguments = 'info --format {{.OSType}}'
        $netrcolProbe.StartInfo.UseShellExecute = $false
        $netrcolProbe.StartInfo.CreateNoWindow = $true
        $netrcolProbe.StartInfo.RedirectStandardOutput = $true
        $netrcolProbe.StartInfo.RedirectStandardError = $true
        [void]$netrcolProbe.Start()
        $netrcolOutput = $netrcolProbe.StandardOutput.ReadToEndAsync()
        $netrcolError = $netrcolProbe.StandardError.ReadToEndAsync()
        if (-not $netrcolProbe.WaitForExit(5000)) {
            $netrcolProbe.Kill()
            return $null
        }
        if ($netrcolProbe.ExitCode -eq 0) { return $netrcolOutput.GetAwaiter().GetResult().Trim() }
        return $null
    } finally {
        $netrcolProbe.Dispose()
    }
}

function Test-NetrcolLineEndings([switch]$Strict) {
    # Linux builds need LF sources. Upstream .gitattributes stays untouched; see docs/netrcol/LOCAL.md.
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { return }
    & git -C $netrcolRoot rev-parse --is-inside-work-tree 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { return }
    $netrcolFix = 'git config core.autocrlf false; git config core.eol lf'
    if ((& git -C $netrcolRoot config --get core.autocrlf) -eq 'true') {
        Write-Warning "Git converts checkouts to CRLF in this repository. Run: $netrcolFix"
    }
    $netrcolCrlf = @(& git -C $netrcolRoot ls-files --eol | Where-Object { $_ -match '^i/lf\s+w/crlf\s' })
    if ($netrcolCrlf.Count -eq 0) { return }
    $netrcolSample = ($netrcolCrlf | Select-Object -First 5 | ForEach-Object { ($_ -split "`t", 2)[1] }) -join ', '
    $netrcolMessage = "$($netrcolCrlf.Count) source file(s) have CRLF line endings ($netrcolSample). Run: $netrcolFix; then re-checkout those files."
    if ($Strict) { throw $netrcolMessage }
    Write-Warning $netrcolMessage
}

try {
    if ($Action -in @('Start', 'Prepare')) {
        Test-NetrcolLineEndings -Strict:$Build
        & node (Join-Path $PSScriptRoot 'prepare-local.mjs')
        if ($LASTEXITCODE -ne 0) { throw 'Local configuration could not be prepared.' }
        if ($env:OS -eq 'Windows_NT') {
            # Include the workspace owner when an automation sandbox creates the file.
            # Otherwise a subsequent launch by the real desktop user cannot read it.
            $netrcolSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
            $netrcolOwner = [Security.Principal.NTAccount]::new((Get-Acl -LiteralPath $netrcolRoot).Owner)
            $netrcolOwnerSid = $netrcolOwner.Translate([Security.Principal.SecurityIdentifier]).Value
            & icacls.exe $netrcolEnvPath /inheritance:r /grant:r "*$($netrcolSid):(F)" "*$($netrcolOwnerSid):(F)" '*S-1-5-18:(F)' | Out-Null
            if ($LASTEXITCODE -ne 0) { throw 'Could not restrict the local secret file permissions.' }
        }
        if ($Action -eq 'Prepare') { exit 0 }
    }
    if (-not (Test-Path -LiteralPath $netrcolEnvPath)) { throw 'Run Start-Local.ps1 once to create the local configuration.' }
    $netrcolDockerCommand = Get-Command docker -ErrorAction SilentlyContinue
    $netrcolDocker = if ($netrcolDockerCommand) { $netrcolDockerCommand.Source } else { Join-Path $env:ProgramFiles 'Docker\Docker\resources\bin\docker.exe' }
    if (-not (Test-Path -LiteralPath $netrcolDocker)) { throw 'Docker Desktop is not installed. See docs/netrcol/LOCAL.md.' }
    $netrcolComposeBase = @('compose', '--project-name', 'netrcol-local', '--env-file', $netrcolEnvPath,
        '-f', (Join-Path $netrcolRoot 'deploy\self-hosting\docker-compose.yml'),
        '-f', (Join-Path $netrcolRoot 'netrcol\local\compose.yml'))
    if ($Action -eq 'Check') {
        Invoke-NetrcolCompose -ComposeArgs @('config', '--quiet')
        Write-Output 'Compose configuration valid. No container was started.'
        exit 0
    }
    if ($Action -eq 'Start') {
        $netrcolEngine = Get-NetrcolEngine
        if (-not $netrcolEngine) {
            $netrcolDesktop = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
            if (Test-Path -LiteralPath $netrcolDesktop) {
                Start-Process -FilePath $netrcolDesktop -WindowStyle Hidden
                Write-Output 'Waiting for Docker Desktop. If Windows runtime installation requested a restart, restart Windows first.'
                $netrcolWait = [Diagnostics.Stopwatch]::StartNew()
                while ($netrcolWait.Elapsed.TotalSeconds -lt 120) {
                    Start-Sleep -Seconds 5
                    $netrcolEngine = Get-NetrcolEngine
                    if ($netrcolEngine) { break }
                }
            }
        }
        if ($netrcolEngine -ne 'linux') { throw 'Docker Linux engine is unavailable. Restart Windows if requested, then open Docker Desktop and rerun Start-Local.ps1.' }
        Invoke-NetrcolCompose -ComposeArgs @('config', '--quiet')
        if ($Build) {
            Write-Output 'Building the local web app, API/worker, gateway, users and messages services. Existing services stay running until the build succeeds.'
            Invoke-NetrcolCompose -ComposeArgs @('build', 'app-proxy', 'api', 'gateway', 'users', 'messages')
        } else {
            & $netrcolDocker image inspect 'netrcol/fluxer-app-proxy:local' --format '{{.Id}}' 2>$null | Out-Null
            if ($LASTEXITCODE -ne 0) { throw 'The local web app image is missing. Run Start-Local.ps1 -Build first.' }
            & $netrcolDocker image inspect 'netrcol/fluxer-api:local' --format '{{.Id}}' 2>$null | Out-Null
            if ($LASTEXITCODE -ne 0) { throw 'The local API/worker image is missing. Run Start-Local.ps1 -Build first.' }
        }
        & $netrcolDocker image inspect 'netrcol/fluxer-gateway:local' --format '{{.Id}}' 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'The local gateway image is missing. Run Start-Local.ps1 -Build first.' }
        & $netrcolDocker image inspect 'netrcol/fluxer-users:local' --format '{{.Id}}' 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'The local users service image is missing. Run Start-Local.ps1 -Build first.' }
        & $netrcolDocker image inspect 'netrcol/fluxer-messages:local' --format '{{.Id}}' 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'The local messages service image is missing. Run Start-Local.ps1 -Build first.' }
        Write-Output 'Starting Fluxer locally. Use -Build after changing web app, API/worker, gateway, users or messages source.'
        Invoke-NetrcolCompose -ComposeArgs @('up', '-d', '--no-build', '--wait', '--wait-timeout', '600')
        & node (Join-Path $PSScriptRoot 'verify-local.mjs')
        if ($LASTEXITCODE -ne 0) { throw 'Local HTTP or app asset checks failed. See the failing URL above.' }
        Write-Output "Fluxer is ready: $netrcolOrigin"
        Write-Output 'On first use, complete the setup wizard and create your local account. Netrcol automation modules are still in development.'
        if (-not $NoBrowser) { Start-Process $netrcolOrigin }
    } elseif ($Action -eq 'Stop') {
        Invoke-NetrcolCompose -ComposeArgs @('stop')
        Write-Output 'Local services stopped. Accounts, messages and files are preserved.'
    } elseif ($Action -eq 'Status') {
        Invoke-NetrcolCompose -ComposeArgs @('ps')
    } elseif ($Action -eq 'Logs') {
        Invoke-NetrcolCompose -ComposeArgs @('logs', '--tail', '100', 'api', 'worker', 'gateway', 'app-proxy')
    }
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
