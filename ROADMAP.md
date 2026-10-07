# Fluxcol roadmap

Fluxcol integrates community-management tools into a self-hosted Fluxer instance. Owners configure automation and review its results in the existing chat application, without running separate moderation bots or switching dashboards.

## Available now

| Area | Implemented scope |
| --- | --- |
| Event logs | 11 categories, 58 supported event types, native embeds, channel inheritance, optional message content, and recovery |
| AutoMod | 14 rules, moderation actions, shared/per-rule scopes, counters, Anti Raid, and Anti Nuke |
| Automatic roles | Separate member/bot lists, delayed assignments, role-creation shortcuts, and recovery |
| Module settings | Shared Netrcol message language with 34 languages |
| Action history | Configuration changes and automation/delivery outcomes |
| Local installation | Windows launcher and Docker source images for web, API/worker, gateway, user, and message services |

The implementation uses the existing Fluxer session, community settings, repositories, gateway, and worker. Automation configuration is currently owner-only and supported on self-hosted PostgreSQL instances. The Windows launcher is a loopback development setup; it does not configure a public production deployment.

Other modules shown in Application settings remain previews. Disabled event types without upstream producers are explicitly labeled. See the [README](README.md) and [module guides](docs/netrcol/LOCAL.md) for current behavior and limitations.

## Next community modules

The next planned module is **Welcome & goodbye**, using the existing membership-event and delivery infrastructure. It should support configurable messages, valid same-community destinations, previews, language preferences, and action history.

Further candidates include reaction roles, moderation/warning management, levels and rankings, invite tracking, tickets, registration, custom commands, starboard, giveaways, polls, temporary channels, statistics, and social notifications. These are backlog candidates, not currently working features or release-date commitments.

## Platform work

- Add channel/category exclusions to event logging.
- Define delegated management permissions before expanding beyond owner-only configuration.
- Document production installation, upgrades, backup/restore, and rollback with verified procedures.
- Expand restart, outage, concurrency, and source compatibility coverage.
- Verify physical voice/video transport separately from automation-event processing.
- Continue upstream maintenance while keeping downstream automation changes identifiable.

## Requirements for a new module

Each module should ship with usable configuration and real execution, rather than enabling a preview page alone. It must validate destinations/targets in the same community, preserve drafts on conflicts, respect ownership transfer and the operator stop switch, and show clear outcomes.

Source writes should persist their automation work transactionally where possible. Stable source identities, bounded retries, recovery, and reconciliation must account for duplicate events and worker interruptions. Delivery guarantees and retention must be documented without implying that history expiry removes already-delivered messages or completed actions.

Verification should cover real source operations through durable state and visible results, private channels/bots where relevant, legacy data, permission failures, deleted targets, keyboard/mobile interaction, and all 34 languages. Destructive live tests belong in isolated test communities.

## Scope and upstream

Native app-store distribution, a third-party code marketplace, mandatory cloud accounts/telemetry, external-platform support, and complete recovery of deleted resources are outside the current scope. Official Fluxer client compatibility needs separate verification.

The recorded upstream baseline is in [netrcol/upstream.json](netrcol/upstream.json). Fluxcol retains the upstream license, attribution, and included name/marks policy; see [Upstream and license](README.md#upstream-and-license).
