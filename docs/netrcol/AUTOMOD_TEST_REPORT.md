# AutoMod functional verification

This report records the October 6, 2026 verification. All 14 rules passed. The recorded run included **255 API tests** and **80 panel/settings tests**, plus **16 separate live scenarios**. Repeated runs are not counted again.

The API total consisted of 127 detection/configuration/queue tests, 50 real-operation flow tests, seven wake-up tests, and 71 webhook/OAuth regression tests. Of the 80 panel/settings tests, 51 covered AutoMod. Later shared-settings and automatic-role regression totals in the [README](../../README.md#verification) overlap this coverage and should not be added to these counts.

## Environment and boundaries

Integration tests used temporary PostgreSQL 17 databases and isolated communities/accounts. They exercised real Fluxer HTTP routers, message/membership/audit writes, PostgreSQL outbox, the AutoMod processor, and worker tasks where applicable. Gateway, object-storage, and wake-up adapters in these harnesses were test doubles.

Live scenarios separately used the local HTTP API, JSON WebSocket gateway, PostgreSQL, JetStream worker, and file storage. Panel checks covered desktop and a 390 × 844 mobile viewport. Destructive actions were performed in isolated test communities.

Physical microphone/camera operation and LiveKit media transport were outside this verification. Local fixture seeding created fresh test accounts/sessions without exercising signup/CAPTCHA. Subsequent community, message, upload, management, and cleanup operations used the real API. Account deletion followed the normal waiting period; immediate physical deletion was not assumed.

## Rule results

| Rule | Verified behavior |
| --- | --- |
| Bad words | Whole/partial matches, Unicode/case normalization, scopes, delete/warn, corrected queued messages |
| Repeated text | Same member and normalized text across selected channels; other members, edits, and excluded channels do not count |
| Server invites | Fluxer/Discord invite recognition, shared URL-prefix exceptions, case sensitivity, deletion |
| External links | Exact domains/subdomains, lookalike-domain rejection, URL prefixes, edited messages |
| Excessive caps | Minimum letter count, equality passing, threshold overflow deleting |
| Excessive emojis | Limit boundaries, family/skin-tone/flag/keycap/custom sequences |
| Excessive spoilers | Complete/multiline blocks, unclosed blocks, create/edit, single delivery |
| Excessive mentions | Unique users/roles/broadcast tags, equivalent user-mention forms, create/edit |
| Zalgo | Consecutive combining marks, ordinary accents, multiple scripts, scopes, create/edit |
| Anti-spam | New messages per member, selected channels, ignored edits, time-window boundaries |
| Character limit | Unicode code points, equality/overflow, four scopes, create/edit |
| Media spam | Actual attachments/stickers; edits, links, and emojis excluded |
| Anti Raid | Join burst, persisted counter, lockdown, age boundaries, expiry, owner access, join-notification race |
| Anti Nuke | All 17 watched audit types, observation/enforcement, actor quarantine, owner access, community isolation, expiry |

## Defects fixed during verification

1. Quarantined staff could update a webhook through its ID route. A hold check now uses the verified webhook community before mutation. Regression tests assert 403 and an unchanged webhook.
2. Webhook deletion had the same bypass. The pre-delete check preserves the webhook while the actor is quarantined.
3. OAuth bot approval carried its community ID in the request body and bypassed a route-parameter guard. The hold check now runs before OAuth side effects; tests assert 403 and no added bot.
4. `<@id>` and `<@!id>` counted twice for one user. Normalization before counting fixes the false positive in detection and real create/edit flows.
5. A fast worker could start an Anti Raid hold after membership committed but before the native join notification. The notification was treated as a user message, causing invite acceptance to return 403 despite an existing membership. Native system notifications are now excluded from hold checks and the AutoMod queue. The regression reproduced the failure before the fix and verifies a successful join, its notification, the active hold, and blocked subsequent member messages after the fix.

Webhook/OAuth regressions also verified expiry, owner recovery, and unaffected permissions in other communities. Webhook-token endpoints without a member actor retained their existing behavior.

## Actions and recovery

Tests covered disabled, observation, warning, deletion, delete/warn, timeout, delete/timeout, and lockdown outcomes. A message matching three rules produced one deletion, one timeout, one history entry, and one Netrcol notification. An existing longer timeout was not shortened.

System identity, embeds, non-notifying mentions, omission of violating text, and protection against automation loops were checked. An expired lease was recovered. Injected dispatch failure after notification persistence reused the same message ID without creating another message.

A deleted notification channel did not cause fallback. After six attempts, history recorded failure even when moderation had already succeeded. Cancelled work did not change messages. A 55-message queue advanced across multiple pages; a second run processed no work and 55 distinct notifications remained. This was a recovery/progress check, not a capacity benchmark.

Outbox write failures rolled back real message creation/editing and preserved the previous text. Ownership transfer, operator stop, settings revisions/conflicts, bot/member/role/channel/category scopes, and legacy records were tested.

## Live measurements

The live run passed **16 scenarios with no failures**: gateway initialization, all 14 rules, and a bounded concurrent-message scenario.

Content/count rules preserved allowed or boundary messages and deleted violations. Netrcol embeds arrived through the gateway and were verified through persisted HTTP messages and action history. Counter rules used repeated messages and real multipart file uploads.

Anti Nuke triggered on actual staff channel changes, blocked the next staff request with 403, and allowed owner recovery. Anti Raid triggered through an actual leave/rejoin: acceptance returned 200 with its native notification; member messaging was blocked, owner messaging worked, and expiry restored member messaging.

For individual rule scenarios, HTTP-operation start to notification arrival measured **41–133 ms**. Twenty messages sent in five batches of four concurrent requests produced exactly 20 distinct deletion events, 20 notifications, and 20 successful history entries, without duplicate deliveries. Deletion-event latency was minimum 55 ms, median 98 ms, p95 129 ms, and maximum 135 ms. No gateway reconnect, invalid session, or community-unavailable state occurred in that run.

These figures describe one local environment and a bounded workload. They are not latency guarantees or maximum-capacity measurements.

## Panel and build checks

Checks covered all 14 settings pages, Enter/Space, Tab/Shift+Tab, focus on entry/return, separate permissions, word insertion, Back/Discard, draft protection, and mobile overflow. Translation generators, all 34 languages, strict Lingui compilation, API/app type checks, relevant Biome checks, and source builds passed. Running-instance health, discovery, and entry-point HTTP/JS/CSS checks also passed.

## Running tests

The test sources are published; local execution logs and machine-specific helper scripts are not required. Use a prepared Fluxer development environment with workspace dependencies installed. From the repository root, run the module suites with pnpm:

```powershell
$env:NETRCOL_TEST_POSTGRES_URL = '<disposable-test-database-url>'
pnpm --filter fluxer_api test src/api/netrcol
pnpm --filter fluxer_app test src/features/application_settings
```

Supply a real URL for a **disposable PostgreSQL test database**, never the live application database. The suites clear their test tables, including `kv_automod_flow`, `kv_automod_unit`, `kv_automatic_role_flow`, `kv_event_logs_test`, and `kv_event_log_flows`. PostgreSQL-dependent cases can be skipped when the variable is absent; a skipped case is not verification of persistence.

For real services, start an owned loopback development instance and run:

```powershell
node netrcol/scripts/verify-automod-live.mjs --run --seed-local-fixtures
node netrcol/scripts/verify-local.mjs
```

The live verifier uses `localhost:8088`, creates an isolated community and fresh fixture accounts, and cleans up its own fixtures. It does not modify existing accounts. Credentials are not written to reports. Generated results remain under the ignored `.fluxer/` directory. See [local setup](LOCAL.md), [AutoMod configuration](AUTOMOD.md), and [automatic-role verification](AUTOMATIC_ROLES.md#verification).
