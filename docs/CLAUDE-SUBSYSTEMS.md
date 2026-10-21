# Subsystem invariants (companion to CLAUDE.md)

Condensed from the feature docs as of 2026-10-21. Read the linked source doc before changing behaviour.

## Profile, build, deploy
- Profile is Zod-validated (`shared/schema.ts`) and saved with its original revision; a mismatch is a conflict, never a silent merge.
- `server/builder.ts` parses each script's `CONFIG` with acorn, validates overrides by shape (non-negative numbers, `*RATIO` ≤ 1,
  rejects `__proto__`/`constructor`/`prototype`), injects managed keys + `__ALCC` settings, bundles with esbuild.
- Deploy writes `CC_<name>` slots, backs up replaced slot contents in the data dir, requests a reload. Partial errors surface even on HTTP 200.
- Deployment preview reads saved in-game slots and diffs sources/parameters; it never executes, uploads or restarts.
- Party deploy prepares offline event workers before deploying the merchant.

## Telemetry
- Scripts push to the local API; deployments polled every 3 s; WebSocket `/live` only for notifications (badge ≠ bot online).
- Missing/stale telemetry = "unconfirmed", not offline. A ≥20 s gap rebases counters (no extrapolation).
- `Loot Gold/h` comes from loot events; `Balance gains/h` may include transfers. New samples carry map/server; legacy = `Unknown (legacy)`.
- Bank data is a snapshot taken only when a character opens the bank.
- Incident capture: 2 min / 60 reports retained, ≤20 frozen captures per session, deduped by error text.

## Merchant (`code/eadrosell-merchant-v2.js` + modules)
- Tasks polled every 3 s. Circuit breaker: 6 transitions with ≥3 repeated states in 20 s, or 3 min of repeated selection without
  inventory change ⇒ suspend that task only. Holds release on inventory/rule change, not on time.
- Navigation: stop requesting a destination after 3 definitive `smart_move` failures without progress (cancel/timeout/disconnect don't count).
- Remote exchange allowed with Computer/Supercomputer even with stand open; always leave the bank before exchanging.
- Never buys/equips costumes; never launches another character just to use quotas.

## Bank hub v1 (`code/bank-coordinator.js`) — docs/BANK-CENTRAL-V1.md, docs/STAND-BANK-RESERVE.md
- One visit owner for deposits + stand restock; merchant exits bank once per phase.
- No arbitrary deposits: only recurring rules, production destinations, or surplus of an explicit commercial rule.
- Locked/bound/other-owner/reserved items are never moved automatically. Reserve minimum is per item **and** level.
- Withdrawn stand stock keeps its reservation until listing published/removed; storage failure must not trigger deposit/withdraw cycles.
- Remember visible listings before closing a stand (closed snapshot can omit extended slots).
- Not yet migrated: craft, Xyn, compound withdrawals (planned in docs/BANK-CENTRIC-ARCHITECTURE.md).

## Event duo (`code/event-expedition.js`) — dashboard-v2/docs/EVENT-EXPEDITIONS.md
- Phases forming → engaging → returning → complete. Worker lease 20 s; startup window 45 s; readiness expires 2 min;
  mission ≤20 min, ≤3 deaths/worker; cleanup >4 min ⇒ blocked (characters left online); 5 min cooldown persisted.
- Workers need 70% HP, 20% MP, 20 HP/MP potions. Ranger stays farming (Lone Wolf lost if another non-merchant is online).
- Only workers started by this mission may be stopped, and only after their unload report.

## Halloween — dashboard-v2/docs/HALLOWEEN-2026.md
- Horseman (`horseman`, 30M HP) and Graveyard (`graveyard` event; monsters zombie→ghoul→gargoyle) are events, not respawn camps.
- Trick-or-Treat: 7 doors/char/UTC day, 14 account-wide; journaled per UTC day; holds nav lock for whole circuit; needs 3 free slots + 70% HP.
- Witch's Cipher: enumerate 1,024 recipes vs live clue board; ≤5 attempts/UTC day; journal **before** `brew()`; never buys/withdraws ingredients.
