# Bank hub v1

This first migration covers the bank stock observation, stand allocations and
the ownership of deposit/stand visits. Craft, Xyn and compound withdrawal
adapters remain on the existing routines; migrating them is the next stage.

## Shipped behavior

- `code/bank-coordinator.js` centralizes stand allocation storage and records
  eligible bank stock, minimum reserves and estimated surplus for configured
  stand rules. Observations have timestamps; they are not live outside the bank.
- Deposits and stand restocking share one visit owner. All eligible missing
  stand announcements can be stocked during an existing deposit visit, within
  the bounded bag/stand capacity. The merchant exits once after this phase.
- Each migrated movement records its intention and result in the journal.
  Uncertain results are informational: they never create an evidence hold,
  including after a reload. Exclusive visit ownership still prevents concurrent
  bank movements.
- Bank exposes a compact Stock & flow card. Detailed stock and journal are
  collapsed. Evidence inspection has been removed. A game-style merchant
  inventory supports explicit one-off full-stack deposits without changing
  recurring rules; locked and bound items remain protected.
- The existing allowlist, production destinations, minimum stock, locks,
  pauses and production counters are preserved. No profile setting is changed.

The ledger's surplus is an estimate for stand rules, not a shared-equipment
allocation engine yet. It must not be reused as craft availability until those
adapters and protections have been migrated.

## Rollback

The pre-change snapshot is recorded in `.tmp/bank-central-backup-path.txt`.
It includes code, dashboard source/tests/configuration, documentation, checksums
and the saved profile when supplied by the local API. Treat it as private.

1. Inspect Stock & flow for pending movements. Reconcile bank and inventory;
   do not erase an uncertain transaction or replay it.
2. Finish the current bank visit and stop merchant CODE before restoring files.
3. Verify with `tools/restore-bank-central.ps1 -BackupPath <snapshot path>`.
4. Restore with the same command plus `-Restore`.
5. Build the dashboard, then explicitly deploy the restored merchant.

The restore script overwrites only the migrated pre-existing files. New helper
files remain on disk but the restored builder no longer injects them. It does
not overwrite the current profile or delete any game storage. Legacy stand
allocation storage remains compatible. Restore never disconnects characters.

Keep production budgets and counters; rollback is not a production reset.
Do not restore the saved profile over later user edits without reviewing them.

## Validation

VM tests exercise visit exclusivity, multiple stand withdrawals within a single
deposit visit, protected stock, compatible reserve minimums, storage failure,
uncertain operations and restart reconciliation. Bundle, telemetry, merchant
priority and bank tests cover integration; TypeScript and Vite validate the UI.

Remote exchange: the server allows exchange at distance when a Computer or Supercomputer is carried, and does not prohibit an open stand. The merchant uses its stand spot in that case; otherwise it retains the NPC fallback. It always leaves the bank before exchanging. Source: https://github.com/kaansoral/adventureland_mongodb/blob/main/node/server.js (exchange handler).
