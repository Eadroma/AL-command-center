# Merchant production and operations

## Bounded upgrade runs

In Merchant → Production → Upgrades, enable **Bounded upgrade run** on an equipment rule. Set the number of finished pieces and a material budget, then save and redeploy the merchant. Existing rules remain unbounded unless this option is enabled.

The budget counts base items bought from NPCs at `G.items[item].g` and consumed upgrade scrolls at `G.items[scroll].g`. Carried scrolls count at replacement value. This is a material cost limit, not wallet expenditure, profit, or an estimate of other merchant expenses. Existing base equipment is not charged again. Other automation lanes retain their own budgets. A zero budget prevents new bounded actions.

The merchant reserves the cost in game storage before submitting the action. A confirmed upgrade failure consumes the reservation without increasing output. A confirmed success counts one finished piece only when the resulting level reaches the rule target. Completed equipment uses the existing bank-output policy. Quantity or budget limits stop further base purchases and upgrades for that rule.

An ambiguous response retains a pending reservation and blocks the run. Check the inventory, game logs and bank before staging a new run. **Stage a new production run** creates a new identifier in the editor; it requires save and redeployment. Do not use it as an automatic retry for uncertain transactions. Counters survive CODE restarts in the same browser storage; they are not synchronized across browser installations. Lowering a budget does not undo already reserved costs.

## Upgrade simulation

The simulator is local and does not change the profile or call game actions. Choose a configured rule, enter the base replacement value, and supply success probabilities and scroll costs for every step from +0 to the target. No rate is invented when game chance data is absent.

The model assumes independent attempts, destruction on failure, and restart from +0. Expected bases are `1 / product(probabilities)`. Expected cost is the cost of one base plus each step's cost weighted by the probability of reaching it, divided by the probability of completing the whole chain. Offerings, luck, extra fees, refunds and selling intermediate items are not modeled. The expected cost is an average, not a guaranteed spending ceiling.

## Visible merchant circuit

The planner appears above every merchant settings subtab. Current activity uses live intent or a running transaction. The next task is explicitly a **candidate**, inferred from fresh inventory and editor configuration, not a promised runtime operation. Bank candidates include completed upgrade outputs. NPC sales and base purchases are remote; exchanges own a trip to Xyn, and carried upgrades run at the stand.

Production limits appear beside activity and next-task candidates. Detailed runtime lanes and cadence are collapsed by default. Stale telemetry never becomes a live empty queue. Unsaved configuration can differ from deployed behavior; the view labels this distinction.

## Observed upgrade history and blocked transactions

Merchant → Production contains the upgrade journal and resolution centre. Redeploy the merchant to begin collecting history; earlier attempts cannot be reconstructed. Totals are grouped by item, action kind and input level, with the latest 60 actions retained. Pending costs are separated from confirmed material costs. Simulator steps show observed success rates alongside the entered assumptions; small samples and manually resolved results must be interpreted carefully.

A blocked action records its identifier, run, input level, target, reserved cost and pre-action inventory counts. The resolution screen shows current inventory and the latest timestamped bank snapshot. Identical copies or stale bank evidence cannot prove an outcome: verify in game before acknowledging a result. Fresh merchant telemetry is required to enqueue a resolution.

Confirm success, destruction, or that the action was not executed. Only the latter releases that action's reservation. Previous spending and finished-piece counters remain intact, and a confirmed final upgrade increments output once. Commands are tied to the current action and run; repeated or outdated commands cannot settle another action. Older reservations lacking action details can resume only with their costs retained. Resolution does not stage a new production run. Persistence uses the same browser game storage as production counters.

## Farmer loadout reservations

The bundle emits loadout equipment into `CONFIG.LOADOUT_ITEMS` with its minimum level, rather than adding its name to `KEEP_ITEMS`. Consequently a Fire Bow +0 is transferable when the loadout requires +8; qualifying +8 equipment remains reserved. Independent keep rules and locked items retain their existing protection. Redeploy farmers after changing the generator so their injected configuration reflects this policy.

## Stand wishlist capacity

Up to eight buy orders use `trade9` through `trade16` (the last two rows). With active wishlist orders, sales use `trade1` through `trade8`; without active orders, sales can use all sixteen slots. Budget and reserve checks still apply across the entire wishlist. Existing orders are reconciled into the new slots after redeployment.

Equipment wishlist quantities are posted in batches of at most 99, matching the game's upgradeable/compound-item cap. Larger configured targets remain valid; reconciliation compares against the capped batch to avoid an unlist/relist loop that would starve later orders. Orders share the available budget in configured order, so later slots may be partially funded or remain empty when the gold reserve leaves insufficient funds.
