# Decision and evidence

The shared native dialog is opened from Party member explanations, the selected map character, Merchant Operations and Incident Centre. It shows activity, reason, next condition, blocker and a related settings link. Explicit blockers take precedence over inferred activity; stale telemetry never explains a current decision. Recent acknowledged combat during normal cooldowns is presented as active combat, not a safety hold. A closed stand on a farmer does not identify that character as a merchant.

## Incident context

The local service retains up to two minutes / 60 reports and freezes at most 20 incident captures per telemetry session. New death, route stall/block, upgrade review, merchant loop suspension and ERROR log evidence capture position, server, HP/MP, target, intent, blocker, equipment and available action acknowledgements. Logs with the same error text are deduplicated. Reports are discrete samples, not a continuous replay; gaps and unavailable legacy equipment are explicit. Captures survive service reload through the existing telemetry persistence.

## Circuit breakers

Merchant tasks are polled every three seconds. Six transitions with at least three repeated states over 20 seconds, or three minutes of repeated task selection without an inventory result, suspend only the affected task. Game queues, deaths and gaps in observation do not create a false timeout. Holds persist in the merchant browser and release when inventory or saved rule inputs change; time alone does not release them. Stand checks count bag and listed copies together: unlisting/relisting the same copy is not progress. Other ready tasks continue. The dashboard exposes holds as incidents and in the evidence drawer. Configured travel priorities override stand listing maintenance; the presence of a lower-priority bank item no longer prevents a craft/exchange travel lease.

Shared navigation stops requesting the same destination after three definitive smart_move path failures (invalid, failed or path_not_found) without real coordinate progress. Cancellations, timeouts, disconnections and inactive events are not counted as path failure. Other destinations remain available. Moving at least six units, changing terrain or redeploying releases that route context. The wrapper preserves the original callable and callback signature and does not stack on reinstallation. Existing safe movement recovery remains unchanged.

## Comparable measured profit

New farming context includes equipment identity/level, effect identifiers and gold multiplier. Profit rows separate those contexts, show coverage, movement and deaths, and identify short samples. Loot Lab calibration matches current equipment, effects and multiplier by default; explicitly disabling the match permits mixed history. Legacy samples missing these fields cannot qualify for strict calibration.

Confirmed NPC gold_received responses with cevent=sell supply a separate cumulative resale counter. Counter resets and reporting gaps rebase rather than fabricate revenue. Net including resale requires identical consumption and resale coverage. Loot minus catalog replacement cost remains an estimate, not wallet accounting: upgrades, fees, unrecognised consumptions and farmer-to-merchant resale attribution are excluded. Thirty minutes is a sample-duration indicator, not a statistical confidence guarantee.

## Expedition reports

Workers report observed cumulative mission damage, healing, attacks, loot gold, and item awards identifying them as the looter. Named-boss damage/hits require a matching visible entity. Missing visibility does not imply zero actual damage. The merchant retains ten completed/blocked mission summaries including duration, last worker reports, deaths, return/unload confirmation and owned-client stop state. No-confirmed-boss-hit warnings are limited to missions with at least 30 seconds of engagement. A later successful cleanup updates the same mission summary. These reports do not reconstruct earlier expeditions or stopped clients that never reported metrics. Deploy updated farmer/duo and merchant bundles to collect all fields.

## Validation

Focused tests cover route cancellation versus definitive failures, task-specific suspensions and persistent holds, genuine inventory progress, stand churn with unchanged owned stock, travel priority/stand contention, replay capture/deduplication, independent resale coverage, gear-separated profitability and completed expedition summaries. No test performs a real in-game trade.
