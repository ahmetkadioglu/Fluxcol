# AutoMod

**Community menu → Application settings → AutoMod** provides 14 built-in moderation rules on self-hosted PostgreSQL instances. Only the current community owner can read or change the configuration. The module and every rule start disabled; bots are ignored by default.

## Configure a rule

Choose each rule's action on the overview. **Settings** opens its own page with permissions and relevant thresholds/lists. Opening a page does not enable the rule. Enable the module and save the policy when ready.

**Save & Close** saves the module draft with revision checking. **Discard** removes edits made on the current rule page while preserving the draft that existed before opening it. Back navigation retains unsaved edits with the usual close guard. Validation or revision errors keep the page and draft available.

Message rules support **Disabled**, **Log only**, **Warn member**, **Delete message**, **Delete & warn**, **Timeout**, and **Delete & timeout**. Anti Raid and Anti Nuke support **Disabled**, **Log only**, and **Lockdown**. There is no automatic kick or ban action.

## Rules and fresh defaults

Thresholds below are stored even while a rule is disabled. Previously saved settings are preserved on upgrade.

| Rule | Detection | Fresh default |
| --- | --- | --- |
| Bad words | Whole-word or partial matching after Unicode/case normalization; lists are not regular expressions | Empty lists |
| Repeated text | The same member repeats the same normalized text across in-scope channels | 3 messages in 10 seconds |
| Server invites | Recognized Fluxer/Discord invite addresses, including invite URLs | No link exceptions |
| External links | HTTP(S) and `www.` links, with domain and shared URL-prefix exceptions | No link exceptions |
| Excessive caps | Uppercase percentage among letters that have case, after a minimum letter count | At least 10 cased letters; more than 70% uppercase |
| Excessive emojis | Unicode and custom emoji sequences | More than 10 |
| Excessive spoilers | Complete `||...||` blocks in raw text | More than 5 |
| Excessive mentions | Unique user/role mentions plus `@everyone` and `@here` | More than 5 |
| Zalgo | Consecutive Unicode combining marks | More than 3 |
| Anti-spam | New messages from the same member across in-scope channels | 5 messages in 10 seconds |
| Character limit | Unicode code points, including whitespace and Markdown | More than 2000 |
| Media spam | Actual attachments and stickers across in-scope channels | 5 items in 10 seconds |
| Anti Raid | A community join burst from sufficiently new accounts | 10 joins in 60 seconds; accounts younger than 7 days |
| Anti Nuke | Dangerous management activity by one actor in the community | 5 actions in 60 seconds; starts in log-only mode |

Content limits trigger **above** the configured value. Window counters trigger **at** the configured count. Edited messages are checked for content violations but do not count as new repeated-text, spam, or media events. Scopes are applied before counting. System messages, webhooks, native join/pin notifications, and the owner are excluded; ordinary replies are checked. Turning off **Ignore bots** includes eligible bot activity.

Caps counting excludes digits and uncased letters. Equality with the maximum percentage passes; a 100% maximum cannot be exceeded. Emoji sequences such as families, skin tones, flags, and keycaps count as one. Spoiler counting includes complete empty/multiline blocks, but not unclosed blocks or single bars; it is based on raw text, not Markdown rendering context.

`<@id>` and `<@!id>` count as one user mention. Repeated role/broadcast tags are deduplicated; channel mentions and ordinary `@name` text are not counted. Character counting uses code points: a simple emoji counts as one, while joined emoji and decomposed accented letters can contain several code points.

Rate windows exclude their lower time boundary. Media counting includes files and stickers, not plain links, emojis, file contents, or metadata-only updates.

## Shared and separate permissions

Shared permissions define users, roles, channels, and categories. Each scope supports **Apply to all except selected** or **Apply only to selected**. The default is all except an empty list; an empty only-selected scope applies to nobody. Selected role/channel/category IDs must belong to the community.

A rule inherits these scopes until **Use separate permissions for this rule** is enabled. Enabling it copies the shared scopes into that rule's draft. While it is off, inherited controls are read-only; edit the shared scopes on the AutoMod overview instead.

An explicitly selected user decides coverage before roles: an included user can be covered despite an exempt role, and an excluded user remains exempt. For unselected users, the user mode and role scope both apply. Channel and category restrictions always apply. Uncategorized events pass category exclusions but cannot match an only-selected category list. Join/audit events have no source channel, so channel/category include-only scopes do not match them. Scopes do not bypass owner or system exclusions.

Legacy role/channel exclusions remain authoritative until shared permissions are saved. Upgrades preserve existing whole-word lists and treat missing partial lists as empty.

## Lists and numeric settings

Bad-word lists accept up to 200 entries each, with 1–100 characters per entry. Enter or comma adds a word; individual entries can be removed. Whole-word and partial examples explain their matching behavior.

**Link whitelist** is shared by Server invites and External links. It accepts up to 100 HTTP(S) URL prefixes of at most 2048 characters, without spaces or embedded credentials. Enter/comma adds entries; valid pending input is included when saving. Matching is case-sensitive and includes scheme and path. It is a raw prefix comparison without fetching or following links. A matching URL bypasses those two filters only; other URLs and rules still apply.

Existing domain exceptions remain separate. Domain matching is case-insensitive and covers the exact host and actual subdomains, not lookalike suffixes.

| Setting | Supported range |
| --- | --- |
| Repeated-text count / window | 1–1000 / 1–300 seconds |
| Caps minimum letters / percentage | 1–10000 / 1–100% |
| Emoji, spoiler, or mention limit | 1–10000 |
| Anti-spam sliders | 1–100 messages / 1–600 seconds |
| Character limit | 1–10000 code points |
| Media-spam sliders | 1–100 items / 5–600 seconds |
| Anti Raid join count / window / new-account age | 1–1000 / 1–300 seconds / 0–365 days |
| Anti Nuke action count / window | 1–1000 / 1–300 seconds |
| Timeout/lockdown duration | 10–86400 seconds; default 600 |

Legacy Anti-spam counts above the slider maximum are preserved; the API accepts up to 1000. Legacy Media-spam values are also preserved; the API accepts up to 10000 items and 1–600 seconds, including older windows below five seconds. The Zalgo page exposes permissions while retaining its saved sensitivity.

## Raid and management protection

Anti Raid derives account age from the Fluxer ID. With a positive age limit, only accounts younger than that limit count; an account exactly at the limit does not. Zero includes all account ages and preserves the behavior of older records. A raid lockdown temporarily blocks further affected joins and member messages; owner recovery remains available.

Anti Nuke watches 17 audit action types involving role, channel, ban, kick, and related management abuse. A lockdown quarantines the actor's subsequent authenticated community/channel/webhook writes and OAuth bot approvals. The owner is exempt. Webhook-token requests have no member actor and are outside that member quarantine. Already completed operations are not undone.

Both rules work independently of the separate Security module preview once AutoMod and the rule are enabled and saved. **Start in log-only mode** overrides Anti Nuke enforcement while it is on. A disabled action stays disabled, and choosing Log only remains observational even with that switch off. Missing flags in old records preserve their previous behavior.

## Notifications, preview, and history

Moderation notifications use **Netrcol SYSTEM** rich embeds in the [shared community message language](MODULE_SETTINGS.md). They do not ping members or copy the violating content. A configured notification channel takes priority; otherwise message events use their source channel. Events without a source channel can remain history-only if no destination is configured. A deleted configured destination fails visibly rather than falling back.

Log-only actions record an outcome without sending a moderation notification. Multiple rules on one message are combined into one outcome and avoid duplicate sanctions/notifications. A longer existing timeout is preserved.

**Preview message** evaluates saved content rules, not unsaved drafts. It sends no message, performs no moderation, and does not advance rate counters. Burst rules require actual events for functional testing.

Action history shows settings changes and outcomes without message contents. Configuration history is kept for 90 days, action results for 30 days, and source/outbox records for seven days. Counter state expires after ten minutes; completed outbox records clear their event payload. Retention does not remove channel messages or reverse completed actions.

## Processing and stopping

Message checks run after persistence, so a message can briefly be visible before deletion. If the worker is unavailable, chat continues and persisted work can recover later; events older than five minutes are skipped. Anti Raid/Anti Nuke cannot undo the operation that first triggers them.

Source writes and outbox entries share a PostgreSQL transaction. Stable event keys, post-commit wake-ups, five-second recovery scanning, leases, bounded retries, and persisted notification IDs support recovery. Counters use shared versioned state; repeated text is stored as a normalized SHA-256 fingerprint. This is not an absolute exactly-once guarantee.

Changing settings invalidates old work and holds. Ownership transfer pauses automation until the new owner saves it. The operator switch `NETRCOL_AUTOMATIONS_ENABLED=false` stops automation. These controls do not undo completed actions. See [local operation](LOCAL.md#stop-automations).

## API and verification

- `GET/PUT /guilds/:guild_id/application-settings/automod`
- `POST /guilds/:guild_id/application-settings/automod/simulate` with `{"content":"example"}`
- `GET /guilds/:guild_id/application-settings/automod/history`

Updates include the complete policy and `revision`. Stale revisions return 409; non-owner access returns 403. Settings and automation state use the existing PostgreSQL KV layer; no volume reset is required.

The [functional test report](AUTOMOD_TEST_REPORT.md) records rule coverage, fixed defects, live measurements, and test-environment limits. See [screenshots](../screenshots/README.md). Check translations with `node netrcol/scripts/automod-i18n.mjs --check`.
