# Loot farming contracts

Activity profiles optionally include a loot contract: up to ten distinct items,
a quantity per item and notify/pause completion behavior. The activity already
defines participants, target, builds, consumables and safety settings.

Staging an activity replaces all activity-owned loot objectives and creates new
run IDs for its contract. Standalone objectives remain unchanged and can still
pause farming. Staging an activity without a contract clears activity-owned
objectives. Preview does not mutate the profile. Save and deploy are required
to activate the staged run. Re-staging the same activity resets its contract.

Contracts reuse the existing loot event accounting, deduplication, persistence
and party progress messages. Purchases and transfers do not count. With multiple
items, pause occurs when any individual target is reached, not when all finish.
Healing, potion use and self-defence continue during the hold. Notify marks
completion in the dashboard and does not send an external notification.

Progress is shown in Loot objectives, where a run can be reset, disabled or
removed. Edits there affect the run, not its saved activity template. Time and
gold contracts are not implemented; this first version covers item quantities.
