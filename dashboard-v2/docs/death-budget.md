# Per-character death budget

Danger settings include `maxDeaths` (0 disables the budget) and a risk `runId`.
Safety must be enabled. Farmer alive-to-dead transitions increment a persisted
counter keyed by profile, run and character. Repeated dead snapshots do not
increment it. Activating a run while already dead establishes a baseline rather
than counting an earlier death. Deaths not observed by the runtime are unknown.

At the limit, normal safety recovery cannot release the hold: revival and healthy
HP do not reset it. The configured hold/town action applies, with existing town
throttling, healing, potions and self-defence exemptions. Merchant is excluded.
This is a per-character limit, not a coordinated party-wide retreat.

Prepare a new risk run in Danger management, or stage an activity, then save and
deploy to reset. Progress survives CODE restarts through game get/set storage
on the same browser; cross-browser persistence is not guaranteed. New fields
default to an unlimited budget, preserving old profile behavior.

The live safety report exposes deaths/limit; Party diagnostics explain the reset
condition. Existing incident handling observes safety holds. Mana/spending
budgets and alternate fallback activities are outside this first version.
