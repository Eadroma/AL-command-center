# Page and contextual tool components

Only Team, Merchant and Bank are navigation destinations. Other components listed below are retained as contextual tools inside Team dialogs. Merchant settings and Bank actions also open in focused dialogs. Legacy hash links resolve to their corresponding Team tool. See `docs/DASHBOARD-REDESIGN.md` at the repository root for the new structure.

# Feature pages

- `ActivityPage`: searches recent server history by message/source, severity and source.
- `ScriptsPage`: searches the imported script catalog by filename/label/type and class.
- `BankPage`: browses persisted per-character bank snapshots with catalog-aware filters.
- `InventoryPage`: renders live bags and gear, and locates owned items across bags,
  equipment, stand sales and the newest shared-bank snapshot with policy reservations.
- `CombatPage`: presents cumulative session metrics and classified failures.
- `PartyPage`: composes the complete roster, safe profile controls and recent telemetry.
- `EventsPage`: edits the live-event master switch, character participation, allowlist and styles.
- `FarmingPage`: edits fallback and per-character targets, hunts, boss timers and loadouts.
- `OperationsPage`: correlates team intent, movement traces and verified merchant operations.
- `IncidentsPage`: groups runtime failures and preserves their local resolution state.
- `CavePage`: monitors and controls the three-character Cave Dreams mission.
- `PerformancePage`: charts persisted combat, XP and gold rates.
- `DeploymentsPage`: compares saved CODE revisions and supports rollback.
- `LootSimulatorPage`: ranks farmable monsters using live character assumptions.
- `MerchantPage`: edits and explains the merchant's complete task policy.

Pages receive server data from `App`, own only their display filters and compose
reusable primitives. Navigation uses hash links; `useProfile` stays mounted above
the pages, preserving unsaved changes while browsing. Filter state resets when a
page is left. Profile editors share revision-aware save, discard and deploy actions;
telemetry pages remain read-only.


## Local task navigation

`WorkspaceSections` groups the dense Farming, Merchant, Combat and Operations
pages by task. It uses labelled navigation buttons with `aria-pressed` and
`aria-controls`, and native hidden sections. Panels stay mounted when hidden:
local form entries and expanded cards survive a section change. Global profile
save/discard/deploy actions and alerts stay outside this navigation, so they are
always available for the whole draft. Selecting a local section never saves or
deploys a profile. Local selection resets on leaving the page; hash routes remain
unchanged.

- Farming: targets, activity profiles, equipment/skills, loot/safety, recurring bosses, hunts.
- Merchant: overview/supervisor, team supplies, production, trading.
- Combat: session metrics, live diagnostic, gear compliance, failure analysis.
- Operations: team/movement, transaction journals, configuration validation.
- Inventory: summary and filters precede results; equipment reservations are a disclosure.

Responsive audit: all 15 hash routes were inspected at desktop and 390px mobile
widths. Local sections were checked individually for visibility and horizontal
page overflow. A hunt search was preserved across a section change. Banking,
events, Cave Dreams, Loot Lab, history, incidents, deployments, activity and
scripts retain their existing task layouts. Configuration controls were not
submitted during the audit.
