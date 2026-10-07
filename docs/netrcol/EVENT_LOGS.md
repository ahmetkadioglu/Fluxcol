# Event logs

**Community menu → Application settings → Event logs** configures real channel delivery for community events. The module is owner-only on self-hosted PostgreSQL instances. It starts disabled, with join/leave selected. New event types are not enabled automatically during upgrades.

## Configuration

The 11 categories appear as horizontal tabs. Each event can be enabled separately; category selections show partial states. Search covers all categories, while **Select all** and **Clear selection** apply to supported events. Changing tabs preserves the draft. Arrow keys, Home/End, Tab, and Shift+Tab support keyboard navigation; the tab bar scrolls on narrow screens.

Channel priority is **event-specific channel → category channel → default channel**. An empty override inherits the next level. Saving requires every enabled event to resolve to an existing text channel in the same community. A deleted destination produces an error; another channel is not selected automatically.

**Log message text** starts off. Enabling it captures created/deleted message content and the before/after content of edits. Private-channel content can be copied into the log channel and read by anyone with access to that destination. Attachments are represented by name, type, and size; their original files are not archived. Long content and bulk-deletion dumps use a UTF-8 `event-log.txt` attachment. With text capture off, a bulk dump contains IDs and attachment metadata only.

**Preview** renders the draft without sending a message. **Send test message** queues a marked test for the selected saved, enabled event and its actual destination. Testing is disabled while there are unsaved changes. A revision conflict preserves the draft; **Reload** fetches the current configuration.

Set the log language in [Module settings → Netrcol message language](MODULE_SETTINGS.md). Event logs and AutoMod share this preference; your personal interface language remains independent.

## Event catalog

| Category | Events |
| --- | --- |
| Membership and profiles | Join, leave, bot addition, nickname, community profile, and visible user-profile changes |
| Moderation | Kick, ban/unban, timeout, server mute/deafen, moderator voice move/disconnect |
| Messages | Create, edit, delete, bulk delete, pin/unpin, announcement publishing |
| Reactions | Add/remove, clear one emoji's reactions, clear all reactions |
| Channels and categories | Create/update/delete; names, topics, category, ordering, and channel properties |
| Channel permissions | Create/update/remove user or role permission overwrites |
| Roles | Create/update/delete, permissions/order, and member-role changes |
| Invites | Create/delete and joining through an invite |
| Webhooks and expressions | Create/update/delete webhooks, emojis, and stickers |
| Community | Settings, visible features, vanity invite address, and ownership |
| Voice and visible presence | Join/leave/move, self-mute/deafen, camera, screen sharing, suppression, entrance sounds, visible online/custom status |

The catalog contains 60 event types; 58 are supported. All 35 upstream audit types are mapped. **Member prune** and **Invite update** are disabled because the current Fluxer source has no producer for them. Catalog tests require an explicit mapping when upstream audit types change.

Bot operations and private channels are included. DMs, account secrets, and operator service logs are outside this module. Channel/category exclusions are not yet available. Invisible users remain offline, as presented by Fluxer. Message creation, reactions, personal voice state, and presence logging require explicit selection.

## Message presentation

Logs are native rich embeds from **Netrcol SYSTEM**. Titles, relevant names, a source-channel reference, and event timestamps replace repeated raw IDs. Creation is green; deletion, departure, and moderation are red; updates are yellow; presence is gray; test messages are purple.

Names prefer community nicknames, then display names and usernames. Deleted targets can use names from audit snapshots. Unknown actors/targets have a clear fallback, retaining an ID when needed to distinguish the target. Permission changes show readable added/removed permissions. Message edits show **Before / After** when text capture is enabled. User-controlled text is escaped, and log messages do not send mention notifications.

Embed limits include UTF-16 field and total lengths. Full long content and bulk dumps remain available in the UTF-8 attachment. Existing plain-text logs are not rewritten.

Same-instance channel and message links open within the current application tab on a normal click or Enter. Message links use Fluxer's native jump/highlight behavior and preserve channel access checks. Ctrl/Cmd-click and middle-click retain browser new-tab behavior. External links retain the normal untrusted-domain checks. Deleted source messages or channels do not receive new jump links.

## Delivery and recovery

Audit records and their outbox entries are written in the same PostgreSQL transaction. Membership and message events participate in their source write transactions. Message deletion uses the operation source; pins use the audit source. Later audit merging does not create a second deletion delivery.

Voice/presence transitions reach the API through the gateway's existing authenticated `/internal/rpc` path using `x-fluxer-rpc-auth`. Initial loads, reconnects, and unchanged states are ignored. Accepted events are persisted by the API; transient gateway events lost before acceptance cannot be fully reconstructed.

A stable source identity deduplicates events. The outbox carries actor, target type/ID, source ID, and payload. It excludes account secrets, webhook tokens, and entrance-sound download URLs. System log/test messages and operations on those messages are excluded to prevent logging loops, including after history retention expires.

After commit, a JetStream notification wakes the worker. Notifications are batched with up to 200 event IDs and do not carry settings or message content. Broker unavailability does not lose the persisted event or fail the source operation.

A five-second recovery scan examines up to 200 records per pass with a continuing cursor. Delivery uses a 60-second lease, up to six attempts, and backoff capped at five minutes. Persisted message IDs are reconciled after interruption to avoid creating a second channel message. Gateway dispatch can repeat; absolute exactly-once delivery is not guaranteed.

Disabling the module, changing its revision, or transferring ownership skips old work. The new owner must save the module before it resumes. Deleted destinations fail visibly. New settings do not replay historical events. Operators can use `NETRCOL_AUTOMATIONS_ENABLED=false`; see [local operation](LOCAL.md#stop-automations).

Action history shows the latest 50 entries. Settings history is kept for 90 days, delivery results/deduplication for 30 days, and queued work for seven days. These periods **do not automatically delete messages already sent to channels**.

## API and upgrades

- `GET/PUT /guilds/:guild_id/application-settings/event-logs`
- `POST /guilds/:guild_id/application-settings/event-logs/test`
- `GET /guilds/:guild_id/application-settings/history`

The test body accepts an event type, for example `{"event_type":"message_delete"}`. Settings schema v2 adds category channels, event channels, and message-content capture while retaining compatibility with v1 settings and pending records. Existing destination channels, language, and join/leave selections are preserved. No volume reset is required.

The [shared catalog](../../packages/constants/src/EventLogConstants.ts), [API producers](../../fluxer_api/src/api/netrcol/EventLogSources.ts), and [gateway transitions](../../fluxer_gateway/src/guild/guild_event_log.erl) define the supported sources.

## Verification

`EventLogFlow.test.ts` exercises real HTTP operations through PostgreSQL outbox and channel persistence across the supported event families. It includes private channels, bots, message edits/deletions/bulk deletions, audit merging, and authenticated voice/presence RPC. Failure injection checks transaction rollback.

Repository, delivery, rendering, catalog, and worker tests cover channel priority, unsupported events, migration, ownership, revisions, retries, leases, recovery, queue progress, Unicode limits, and long/bulk attachments. Gateway regression tests cover system account `0` without treating it as a normal snowflake; this prevents the temporary community-unavailable screen during log delivery.

These integration harnesses use test gateway/storage adapters. Gateway EUnit, source builds, type checks, keyboard/mobile panel checks, and live channel delivery were also verified. Physical audio/video and LiveKit media transport are outside the automation-test scope.

Use only a disposable database for `NETRCOL_TEST_POSTGRES_URL`: event-log tests clear `kv_event_logs_test` and `kv_event_log_flows`. See the [test setup](AUTOMOD_TEST_REPORT.md#running-tests), [README verification](../../README.md#verification), and [screenshots](../screenshots/README.md). Check translations with `node netrcol/scripts/event-log-i18n.mjs --check`.
