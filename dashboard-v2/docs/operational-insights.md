# Operational insights

## Party decisions

Each character card explains its current action, reason and next condition.
Priority is disabled/stale/dead, danger hold, paused loot goal, Ready/Engage,
explicit blocker, watchdog recovery, running merchant transaction, combat
observation, destination, then generic intent. Stale telemetry never describes a
live action. Explanations distinguish runtime responses from inferred state.
Next conditions are dashboard guidance, not a prediction of script scheduling.

Action, blocker/reason and next condition are now always visible in the roster.
Connection loss and active bank sorting have dedicated explanations. Navigation
recovery includes reported time without progress, destination and attempt count;
it takes precedence over the generic movement blocker. Unknown blockers retain
their runtime text and explicitly state that the release condition is unavailable.
Combat observations without a target are included when they explain cooldown,
mana, range or target selection. These remain labelled as observations/inferences.
No configuration, game action or recovery is triggered by this read-only view.

## History profitability

The new table follows the History time, character, terrain and server filters.
Rows separate character, target monster and reported participants. Farming
context is attributed only when it stays identical across telemetry samples.

Game-confirmed consumed item responses (`game_response`, successful `equip`,
`used` item with potion gives or elixir type) increment consumed counters.
Failed actions, equipment swaps and free regeneration do not count. Cost uses
`G.items[item].g` as a replacement-price assumption. It is neither a confirmed
purchase price nor market value. Only recognised consumed item responses count.
Other costs, NPC resale and commerce income are not included.

Persistent five-minute buckets keep matched loot and consumption intervals
separate from legacy loot coverage. Session resets, counter resets and telemetry
outages establish new baselines. Negative net is allowed. Unpriced consumption
suppresses the net figure. Samples under five minutes carry a warning. Rates
use observed online time per character; adding hourly rows is not a team rate.

## Combat build comparison

The read-only comparison resolves the AOE, single-target and tank gear overrides
against equipment and bag copies. Unspecified slots inherit current equipment;
unknown script-default loadouts are not reconstructed. An item copy can be used
once per candidate build, so one ring cannot satisfy two slots. Each build is an
independent alternative, not a simultaneous equipment reservation.

Updated bundles collect item properties using the game's
`calculate_item_properties` with character class and map, or `item_properties`
as fallback. Real item level and modifiers are preserved in that calculation.
The table compares summed equipment contributions. It does not claim a full
character simulation: class weapon restrictions/bonuses, sets, nonlinear
attributes, buff changes and skill rotations are not modelled. Measured session
DPS and live HP/MP/defence are displayed separately. Incomplete or stale property
data suppresses totals; owned-item checks remain available on older bundles.

## Activation

Party explanations use existing telemetry immediately. Consumption accounting
and detailed item properties begin after deploying the updated farmer bundles.
Deployment remains an explicit action; adding these views does not restart
characters or change the saved profile. Old history is preserved, with unknown
cost coverage shown rather than backfilled.
