# Local setup and operation

Fluxcol's Windows launcher runs the customized web app, API/worker, gateway, user service, and message service with Docker Compose. This is a loopback development setup at **http://localhost:8088**. Internet-facing deployment, production TLS, domains, and email are not configured by this launcher.

## Requirements

- Git and Node.js on the host.
- Docker Desktop with its Linux container engine available.
- Enough disk space and memory for the Compose services and source builds.

Source builds run inside Docker. The existing Fluxer source, tests, and build tools remain part of the repository.

## First start

Clone with LF line endings, then build and start:

```powershell
git clone -c core.autocrlf=false -c core.eol=lf https://github.com/ahmetkadioglu/Fluxcol.git
cd Fluxcol
git remote add upstream https://github.com/fluxerapp/fluxer.git
powershell -NoProfile -ExecutionPolicy Bypass -File .\Start-Local.ps1 -Build
```

The launcher prepares `.fluxer/local/.env` with random secrets when it does not exist. It preserves an existing configuration, starts Docker Desktop if necessary, builds the source images, starts the `netrcol-local` Compose project, checks service health and entry-point assets, and opens the browser. Add `-NoBrowser` to suppress the browser launch.

Create your account and complete instance setup in the application. A community owner can open **Community menu → Application settings** to configure [event logs](EVENT_LOGS.md), [AutoMod](AUTOMOD.md), [automatic roles](AUTOMATIC_ROLES.md), and the [shared message language](MODULE_SETTINGS.md). Other module pages are previews.

The launcher checks source line endings. A normal start warns about CRLF source files; a source build stops until those files have LF endings. Keep the clone's `core.autocrlf=false` and `core.eol=lf` settings when working on Windows.

## Start, stop, and inspect

Later starts reuse the prepared images. Use `-Build` after changing source or when the images have not been built yet.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Start-Local.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\Stop-Local.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\netrcol\scripts\local.ps1 -Action Status
powershell -NoProfile -ExecutionPolicy Bypass -File .\netrcol\scripts\local.ps1 -Action Logs
powershell -NoProfile -ExecutionPolicy Bypass -File .\netrcol\scripts\local.ps1 -Action Check
```

Stopping or rebuilding preserves Docker volumes, accounts, messages, uploads, and module settings. `Stop-Local.ps1` does not delete volumes. Local secrets and generated reports under `.fluxer/` are ignored by Git.

The configuration combines [Fluxer's Compose file](../../deploy/self-hosting/docker-compose.yml) with the [local overlay](../../netrcol/local/compose.yml). Web access binds to `127.0.0.1:8088`; voice transport uses loopback ports `7881/TCP` and `7882/UDP`. Email is disabled in this setup. Physical microphone, camera, and LiveKit media transport require separate verification from the automation tests.

## Stop automations

An operator can set `NETRCOL_AUTOMATIONS_ENABLED=false` in `.fluxer/local/.env`, then apply the environment:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Start-Local.ps1 -NoBrowser
```

The overlay passes this setting to the API, worker, and gateway. It stops new automation and causes pending work to be skipped. Re-enabling does not replay skipped work or undo completed moderation, role assignments, or channel messages. Community owners can also disable individual modules in Application settings.

## Checks and troubleshooting

Run these commands from the repository root:

```powershell
node netrcol/scripts/doctor.mjs --source-only
node netrcol/scripts/doctor.mjs
node netrcol/scripts/verify-local.mjs
```

The doctor checks source and development prerequisites, including the recorded upstream baseline/remote and Docker. It does not test builds or runtime behavior. The running-instance verifier checks web, API, gateway, and media health, discovery, and the JavaScript/CSS assets loaded by the entry page. If startup fails, inspect `Status` and `Logs`, confirm Docker's Linux engine is running, and check whether the loopback ports are already in use. `-Action Check` validates the Compose configuration without starting containers.

Translation generators can be checked without changing files:

```powershell
node netrcol/scripts/application-settings-i18n.mjs --check
node netrcol/scripts/event-log-i18n.mjs --check
node netrcol/scripts/automod-i18n.mjs --check
node netrcol/scripts/automatic-roles-i18n.mjs --check
node netrcol/scripts/module-settings-i18n.mjs --check
```

The launcher preparation tests are available with `node --test netrcol/scripts/prepare-local.test.mjs`. See the [AutoMod test report](AUTOMOD_TEST_REPORT.md) and [automatic role verification](AUTOMATIC_ROLES.md#verification) for functional test scope and live-test commands.
