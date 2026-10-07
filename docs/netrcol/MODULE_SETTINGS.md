# Shared module settings

**Community menu → Application settings → Module settings → Netrcol message language** selects the community's language for event logs and AutoMod notifications. All 34 supported languages are available. Labels follow your personal interface language; this preference does not change that interface language.

Only the current community owner can read or save these settings on a self-hosted PostgreSQL instance. Select a language and choose **Save changes**. **Reset** restores the saved value. On a revision conflict, the draft remains available and **Reload** fetches the current settings.

## Upgrade and delivery behavior

If no shared preference has been saved, the existing event-log language is used. Upgrades preserve that language; new communities without a previous setting use English (US). Preferences are independent for each community. Opening the page does not save settings or enable automation.

New notifications and pending event logs use the shared language at delivery time. Messages already sent to channels are not rewritten. AutoMod notifications use this community preference regardless of the recipient's account language.

A save appears in Action history. Changing the language does not change event-log or AutoMod policy revisions, renew their ownership approval, or resume modules paused by an ownership transfer. The new owner must save those modules separately.

## API and storage

`GET/PUT /guilds/:guild_id/application-settings/modules` reads or saves the preference. The PUT body contains `message_language` and `revision`.

Settings use the existing PostgreSQL application-settings storage; no new physical table or volume reset is needed. The legacy event-log API language field remains readable for compatibility. A saved shared preference takes priority.

## Verification

The shared-settings verification covered legacy language migration, independent community preferences, delivery of pending messages in the new language, revision conflicts, ownership transfer, draft preservation, and keyboard/mobile interaction. The shared-settings phase passed 241 API regression tests and 86 panel tests; these are historical suite totals, not additional tests to add to later regression totals.

Check all 34 language entries with:

```powershell
node netrcol/scripts/module-settings-i18n.mjs --check
```

See the [current README verification summary](../../README.md#verification) and [language-setting screenshot](../screenshots/module-language-settings.jpg).
