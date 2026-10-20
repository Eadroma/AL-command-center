# Activity automation and runtime policies

## Using the dashboard

- **Combat → Live combat diagnostic**: current blocker, elapsed state time and the last actions. Observations are distinguished from actual game responses. Offline reports remain historical.
- **Farming → Activity profiles**: save/edit a named farm, recurring boss or Cave activity. Choose participants and each participant's existing AOE/Mono/Tank build. Preview, stage, save, preview deployment and deploy. Excluded characters already online must be stopped from Party. The dedicated crab ranger switches to the general v2 ranger for other activities.
- **Farming → Loot objectives**: select one or more items, a quantity and farmers. Each objective counts only new loot received by those farmers. Completion can remain informational or hold farming. Editing a quantity preserves progress; **New run** creates a fresh rule ID. Save/deploy changes to activate them.
- **Farming → Danger management**: opt in to HP/attacker/priest limits. Holds stop new pulls and movement. Targeted defence, potions, healing and loot stay available. Town retreats have a 30-second cooldown. Recovery requires HP above the configured upper threshold and three seconds without a triggering danger.
- **Farming → Combat-only gloves · Hand of Midas**: choose combat and travel gloves per v2 farmer. Movement always overrides combat, including attacks made while moving. A stationary nearby fight equips the combat pair; leaving combat equips the travel pair, or removes the combat pair if no travel item is configured. Missing travel gloves also cause removal when space is available. A full inventory prevents removal and is reported. This policy owns the glove slot ahead of kit/loadout rules and protects both glove IDs from dumping. Minimum upgrade levels and highest matching inventory level apply. Switching is sampled every 250 ms, serialized and limited to one attempt per 400 ms.
- **Commerce → Commercial objectives**: produce an additional quantity of items from known recipes, with one budget per recipe. Budget includes NPC ingredient purchases and crafting fees. Other ingredients must already be available from farming/delivery. Existing craft gold reserve applies. No player-market purchases are generated.

## Runtime contract

`shared/automation.ts` defines backwards-compatible defaults, settings validation and the bounded runtime snapshot schema. `src/models/activities.ts` stages activity changes without executing code. Original build gear/skill lists and merchant settings remain intact. Consumable selections filter existing delivery rules in generated bundles; they do not erase them from the saved profile. An empty selection preserves all existing rules.

`server/builder.ts` injects `code/runtime-policy.js` before v2 loops start. AST insertions guard navigation and hunt loops; action wrappers gate attacks and offensive skills, and record resolved/rejected game results. Activity build choices are consumed by `StyleLoadout`. Original farm/merchant functions remain responsible for target selection, heals, potions, paths and transactions.

Diagnostics sample every 250 ms. Range, mana, cooldown and readiness observations explain common causes but are not proof that a server accepted an attack. Actions list actual responses. Counters reset on CODE restart. Damage/healing rates use the preceding five seconds of character hit events and are descriptive estimates. Danger management defaults **off**, and no commercial or loot goal exists by default.

## Progress and interruptions

Loot event `items[].looter` identifies recipients; party broadcasts are not counted by every character. Chest IDs deduplicate recent receipts. Progress is stored under profile + objective ID + character using Adventure Land `get/set` storage. Farmers also exchange their own counters every ten seconds via `send_cm`; receivers accept only configured participants and matching objective IDs/items, and reject regressing counters. This supports separate game stores while preserving each character's own contribution. A disconnected participant may leave peer counters temporarily behind until messages resume.

Progress survives CODE restarts in the same game storage. Switching browser/origin or clearing storage starts a new local history. Item transfers, purchases and pre-existing inventory do not increment loot objectives. The ETA extrapolates from observed loot after five minutes, including downtime; rare-drop estimates are uncertain.

Commercial progress records **newly produced units**, rather than total inventory/bank stock. The merchant reserves cost in persistent progress before purchase/craft awaits, and settles verified results afterwards. An interrupted/unconfirmed transaction remains blocked for review rather than automatically repeating it. Review the game inventory and transactions before selecting **New production run**, which intentionally resets quantity and spending counters. Raising a target/budget preserves existing progress. Completed outputs and ingredients remain protected through craft rules; disable/remove the goal when you want another merchant workflow to handle the outputs.

Validation requires compatible v2 scripts for active runtime policies and the v2 merchant for commercial goals. It rejects production-output conflicts with deposits, upgrades, exchange or stand listing rules. One active production goal per item is allowed. Cave activity requires a warrior, priest and ranger; the merchant is excluded.

## Verification

`tests/runtime-policy.test.ts` covers observed blockers, healing priority, action holds and defence, hysteresis, town throttling, loot recipient attribution/deduplication, restart persistence, peer message validation, commercial budgets/unconfirmed operations, activity staging, old-profile migration, bundle startup ordering and telemetry ingestion. Existing builder/loadout tests exercise compiled v2 bundles.
