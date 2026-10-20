# On-demand event duo

`code/event-expedition.js` owns the mission lifecycle and is included in v2 builds. The merchant coordinates through authenticated-by-sender CM messages; workers keep a 20-second coordinator lease. A missing lease returns the worker instead of continuing an orphaned boss fight.

Enable the mode in **Events → On-demand event duo settings**. Save, prepare warrior/priest CODE without starting them, then deploy the saved profile. Party deployment prepares offline workers before deploying the merchant. Existing online workers are reloaded by party deployment; preparation alone never reloads them.

The first version supports **Mr. Green and Mr. Pumpkin on the home server**. Ranger event routing is disabled, its farm remains unchanged, and the normal supervisor cannot start event workers. Neither worker can engage without its living partner nearby. Both workers require 70% HP, 20% MP and 20 health/mana potions at assembly before departure. Gear still follows the event's configured combat loadout.

Phases: forming → engaging → returning → complete. Startup/readiness expires after two minutes; a startup request has a 45-second confirmation window without repeated requests. Default mission limits are 20 minutes and three deaths per worker. Missing heartbeat, a full bag or a disappearing boss requests return. Return uses town(), travels to assembly and transfers only slots approved by the existing farmer item-protection rules. Only workers whose startup request was accepted for this mission can be stopped, and only after their unloading report. Manual characters stay online. The merchant prioritizes returning to assembly for unloading. Cleanup exceeding four minutes becomes blocked, leaving characters online for inspection. Completed missions have a five-minute cooldown, including after a merchant script reload.

Mission state is persisted under the merchant/profile key. Worker death counts survive script reloads within a mission. CM heartbeats and observed ranger buff absence feed `eventExpedition` telemetry, shown on Events and Merchant. Lone Wolf is lost while another non-merchant character is online, regardless of map; recorded downtime does not estimate lost income. Stale telemetry is labeled. Disabling the mode requires saving and deploying the merchant; active workers receive a return instruction. Prepare new worker CODE only after cleanup, to avoid replacing the telemetry session of an active expedition.

Tests cover ownership, readiness, startup timeout, home-server checks, death/duration limits, cleanup, coordinator loss, cooldown persistence, roster isolation and verified offline CODE preparation.

Cleanup timeouts remain visible as blocked, but verified late return/unload reports are still accepted. Owned workers are stopped only after confirmation; manual workers are left online. Blocked workers report completion after all dumpable loot has been transferred.
