# Merchant work queues and bank-backed craft batches

## Operator workflow

- Merchant → Overview → Task priorities: move bank, NPC sales, exchanges, craft, compound and upgrade lanes up or down. Save and redeploy to apply. The first ready lane wins; disabled and unavailable tasks do not reserve priority.
- Merchant → Production → Craft workshop: select a real catalog recipe, enable bank ingredients, choose crafts per batch (1–500). The runtime reduces the requested batch to inventory capacity, contract quantity and budget. Individual crafts still run one at a time at Leo.
- Production contracts control the total quantity and monetary ceiling independently of batch size. For 2,500 Pouch Bows, choose that total on a craft contract and set a material budget; its catalog recipe includes one base bow, one `smoke` (Sac of Pouch), and a craft fee. The workshop can provision bows from a verified NPC shop and smoke from bank. Bounded contracts retain their outputs and cannot coexist with an output exchange/listing/deposit rule; use the ordinary recipe queue when crafting directly for exchange.
- Upgrade targets use compact table rows with expandable production budgets. Upgrade simulation shows per-step assumptions and confirmed outcomes in a table. The reference screenshot inspired layout; it does not imply automatic offerings or a game success-chance lookup.
- Events → On-demand event duo settings supports all listed bosses, including `crabxx` (GigaCrab), Franky and Ice Golem. Select bosses individually or use Allow all supported event bosses. Saved existing selections remain intact.

## Runtime invariants

Safety, event return service, bank sorting and outstanding transaction receipts retain precedence. Exchange visits drain before switching lanes. A craft batch retains its lane while actionable; ingredient scarcity or insufficient gold releases it. Stationary upgrades and compounds run only at the configured open stand. Priorities apply to production/logistics; potion supply and stand order reconciliation remain independent service loops.

Bank provisioning scans available packs, travels to the matching floor, and retrieves into an explicitly empty inventory slot. `bank_retrieve`'s third argument is an inventory slot, never a quantity. When a retrieved stack exceeds the batch need, `split` creates the needed stack and the remainder returns to its original bank slot after verification. Locked and bound ingredients are skipped. Missing ingredients trigger a 60-second retry delay rather than repeated bank travel. Ambiguous split/withdrawal failures stop the attempt and are logged.

Batch size is an upper bound, not a promise of a single 500-item craft API call. Contract progress persists through the existing RuntimePolicy commercial objective storage. Costs cover purchased NPC ingredients and craft fees; bank ingredient replacement value is not charged.

Temporary event workers keep the existing home-server, readiness, death/time-limit, town-return and verified-unload lifecycle. Only merchant-owned clients are disconnected; manual characters stay online. The archer keeps farming.

## Verification

`merchant-batches.test.ts` covers priority validation/arbitration, bank/NPC recipe planning and exact split/return of a 2,500-item bank stack. `event-expedition.test.ts` verifies GigaCrab/Franky/Ice Golem lifecycle. Existing merchant priority, craft reservation and v2 bundle integration tests cover the preserved behavior.

## Per-level upgrade materials

Open Scrolls & offerings by level on an upgrade target. Keys are source levels (`8` means +8 → +9). Omitted steps use the current live item grade to choose the lowest compatible scroll (`scroll0` through `scroll3`), with no offering. Explicit scrolls below the current grade and disabled steps hold that item. Primling (`offeringp`) and Primordial Essence (`offering`) are optional inventory ingredients, passed as the third argument to `upgrade`. Missing, locked, bound or foreign-owned offerings never silently fall back to an unprotected attempt. Offerings are not automatically purchased. Selected supplies are reserved from NPC sales and bank deposits while upgrade automation is enabled.

Missing selected scrolls are bought one at a time remotely, respecting the gold reserve. Consumed scroll and offering catalog gold values both count toward the production budget/history. This is replacement value, not a market-price estimate. Chance simulation remains a manual assumption tool and does not automatically calculate offering bonuses.


## Automatic review of held upgrade transactions

The merchant records a persisted before-image of inventory, terrain, gold and selected materials before each journalled base purchase or upgrade. Every three seconds it retries reconciliation once the action is at least 15 seconds old. An exact successful equipment transformation plus consumption of the selected scroll/offering confirms an upgrade. A base purchase requires exactly one new +0 copy and the exact expected gold payment. Unrelated inventory changes deliberately prevent inference. Explicit, whitelisted server rejection responses release only the rejected action's cost. Repeated checks and late callbacks cannot count the same action twice.

Timeouts, missing items and unchanged inventory do not prove destruction or non-execution. After 60 seconds these cases, unavailable inventory and legacy reservations raise a warning in Unconfirmed transaction review and the Incident Centre. Source equipment remains protected from sale/deposit while held. A later exact confirmation can still clear the hold automatically. Manual verified resolution remains available without resetting the production run. Automatically verified results are identified in recent upgrade history. Redeploy the merchant to enable the new recorder; old reservations without material evidence still require manual review. This currently covers the production review's journalled base purchases and upgrades, not every merchant transaction.
