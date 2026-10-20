# Domain adapters

Pure transformations only. `party.ts` adapts nested runtime telemetry and persisted
activity into display models. `profile.ts` updates supported controls immutably
and compares drafts to their original snapshot. Tests cover missing/stale telemetry,
zero HP, activity ordering, unrelated settings and reverted edits. `events.ts` and
`farming.ts` own immutable feature edits so their React pages contain no mutation
or schema-default logic.
