# Automatic roles

**Community menu → Application settings → Automatic roles** assigns starting roles to new community members. It needs no separate bot or token. The module is available to the community owner on self-hosted PostgreSQL instances and starts disabled.

## Configuration

1. Choose roles in **Member roles** for human members. Each list supports up to 20 roles.
2. Optionally configure **Bot roles** separately. An empty bot list skips bots; it does not use the member list.
3. Set **Assignment delay (seconds)** from 0 to 3600. Zero wakes the worker immediately after commit. Other values specify the earliest assignment time; delayed work is picked up by the five-second recovery scan, so delivery is not guaranteed at an exact second.
4. Enable the module and choose **Save changes**. **Reset** restores saved settings. A revision conflict preserves the draft; **Reload** fetches the latest settings.

Both dropdowns include **Create role**. The shortcut opens the community's native Roles settings. After successful creation, Automatic roles reopens and both role lists refresh. Unsaved role selections, the module switch, and the delay draft are preserved. Select the new role in the appropriate list and save your configuration.

Only future joins receive roles; enabling the module does not update existing members. Leaving and rejoining creates a new assignment for the new membership. Existing or manually assigned roles are kept, and adding an already-held role does not produce another role change.

`@everyone`, managed roles, and roles with elevated management/moderation permissions are ineligible. If a selected role is deleted or later gains those permissions, the panel shows the invalid selection and the worker skips it. Other eligible roles can still be assigned. No replacement role is chosen automatically.

## Results and event logs

The module page and shared **Action history** show the latest 50 configuration and assignment results. Outcomes include assigned, skipped, and failed, with reasons such as changed settings, ended membership, invalid roles, an empty role list, or operator stop. Partial results retain the roles that were assigned.

Assignments use Fluxer's native membership, audit, and gateway paths with Netrcol as the system actor. If **Member roles changed** is enabled in [Event logs](EVENT_LOGS.md), its usual Netrcol embed goes to that event's destination. Automatic roles does not need its own notification channel.

The panel uses your personal interface language. Channel logs use the community's [shared Netrcol message language](MODULE_SETTINGS.md). All 34 languages are supported.

## Reliability and stopping

The membership and assignment outbox are committed in one PostgreSQL transaction. If the outbox write fails, membership is not committed. A post-commit JetStream notification wakes the worker; a five-second recovery scan finds persisted work if the notification is lost. Jobs use a 60-second lease, up to six attempts, and a stable source key derived from the join identity.

Before each role write, the worker checks the current configuration revision, module switch, ownership approval, membership identity, and role eligibility. Versioned native role updates merge with existing roles and do not recreate a departed member. On recovery, existing assignments and persisted results are reconciled. This does not guarantee absolute exactly-once execution or complete reconstruction of every audit record after a crash.

Disabling or changing settings cancels pending work from the old revision. New settings do not apply retroactively to that queue. Ownership transfer pauses the module until the new owner saves it. The operator switch `NETRCOL_AUTOMATIONS_ENABLED=false` stops automation without removing roles already assigned.

Configuration persists. Settings history is kept for 90 days, assignment results for 30 days, and queue/completion markers for seven days. These periods do not limit how long a member keeps an assigned role. Storage uses the existing PostgreSQL KV layer; no new physical table or volume reset is required.

## API

- `GET/PUT /guilds/:guild_id/application-settings/automatic-roles`
- `GET /guilds/:guild_id/application-settings/automatic-roles/history`

The PUT body contains `enabled`, `member_role_ids`, `bot_role_ids`, `delay_seconds`, and `revision`. Stale revisions return 409; invalid roles or delay values return 400; non-owner access returns 403.

## Verification

The October 6–7, 2026 verification passed 18 automatic-role integration tests and seven live scenarios. Coverage included separate human/bot lists, delays, existing-role preservation, duplicates, leaving/rejoining, changed settings, ownership transfer, deleted or newly privileged roles, revision conflicts, operator stop, worker recovery, and PostgreSQL write failures.

The combined Netrcol API regression passed 266 tests. Panel/settings and shared-selector coverage passed 101 tests after the role-creation shortcuts were added, including return navigation, draft preservation, refresh failure, and close-guard behavior. Three actual desktop/mobile role creations also returned correctly. Source builds, API/app type checks, 34-language checks, and HTTP/JS/CSS checks passed. These are recorded verification results, not a new run performed while editing this guide.

Run the live verifier against an owned loopback development instance:

```powershell
node netrcol/scripts/verify-automatic-roles-live.mjs --run --seed-local-fixtures
```

It creates fresh test accounts and an isolated community, exercises the real HTTP → PostgreSQL → JetStream worker → gateway/channel path, and cleans up its fixtures. Account deletion follows Fluxer's normal waiting period. Fixture seeding does not exercise signup/CAPTCHA or modify existing accounts. Credentials are not written to reports; generated results stay in the ignored `.fluxer/` directory.

Check translations with `node netrcol/scripts/automatic-roles-i18n.mjs --check`. Use `Start-Local.ps1 -Build` to update source images while preserving volumes. See the [test setup](AUTOMOD_TEST_REPORT.md#running-tests) and [screenshots](../screenshots/README.md).
