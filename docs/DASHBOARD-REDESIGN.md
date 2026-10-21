# Three-page dashboard redesign

This local candidate reorganizes the existing dashboard into Team, Merchant and Bank. It has not been pushed or activated on the live dashboard.

## Structure

- **Team**: roster and current activity, with four contextual tools for setup, farming/events, equipment/bags and insights. Map and operational warnings are expandable. Existing deep links open the corresponding tool and subsection.
- **Merchant**: current work first; configuration and planning in dialogs. Seasonal tasks now belong with merchant configuration. Editors retain the shared profile draft when a dialog closes; transient picker selections may reset.
- **Bank**: stored items and search first; deposits, sorting and recurring rules under Bank actions.

Studio uses a dark neutral palette, system typography, a restrained blue accent, larger spacing and consistent rounded controls. It applies the user-provided Apple-design principles of hierarchy, immediate feedback, progressive disclosure and keyboard accessibility. Native dialogs provide modal focus containment and Escape dismissal. Reduced motion and transparency preferences are respected. The original Retro theme remains available.

## Party Console inspiration

Reviewed [Ryan-Haines/adventureland-party-console](https://github.com/Ryan-Haines/adventureland-party-console) at `79286046b0d881ac2bab140248b1431c2b48ad7f`. The character-first presentation, focused item workflows and separation of requested actions from observed completion informed this candidate. In particular, its [terminal settlement ownership checks](https://github.com/Ryan-Haines/adventureland-party-console/blob/79286046b0d881ac2bab140248b1431c2b48ad7f/runtime/coordinator/navigation/terminal-settlement.ts) and [verified artifact loader](https://github.com/Ryan-Haines/adventureland-party-console/blob/79286046b0d881ac2bab140248b1431c2b48ad7f/runtime/characters/loader-artifact.ts) informed the rollback work below.

The implementation here is independently written against this project's APIs and React components. No upstream source, game assets, dependencies, installers or tests were copied. Their entire coordinator, Windows updater, equipment stat simulator and durable merchant queue protocol are not part of this candidate.

## Rollback correctness

Rollback now shares the character busy state used by deployment and stop controls. It blocks an occupied character and a managed headless client, holds ownership through the remote operation, and publishes state changes. It replaces the dashboard-generated telemetry suffix with a fresh session ticket before restoration and verifies the uploaded bytes through the existing restore helper. The dashboard cannot confirm the replaced deployment from old telemetry. Ambiguous remote failures leave rollback unconfirmed and release the operation lock. Historical profile/script identity is left unknown rather than assigning the current configuration to an older backup.

## Validation

Route-level tests cover occupied-character rejection, fresh rollback identity, confirmed runtime reporting, lost reload responses and preservation of ordinary source. Browser checks cover the three destinations, Team setup, events, Merchant settings, Bank actions, old bookmarks, Escape, and desktop/mobile layouts using disposable demo data and disabled game requests. Validation passed locally: 580 Vitest tests, 30 root script/publication tests, TypeScript/frontend build, Oxlint, isolated API/UI smoke and the publication allowlist scan (762 files). Additional browser checks passed for centred dialogs, switch geometry, search deep links, Retro appearance and the increased-contrast preference. Supporting tools are code-split and load on demand.

The isolated preview uses port 9341. The existing live application and account credentials are not used by that preview. Changes remain in the local `refactor/three-page-dashboard` branch pending user review.


## Local usage report

The header Usage button opens a report without adding a fourth page. An explicit feature registry provides both used and zero-use rows. The client records canonical page visits, contextual tool/disclosure opens, clicks on registered controls and committed field changes. It stores only feature IDs, aggregate counts and timestamps in local storage, with a rolling 90-day reporting window. No labels from the DOM or input values are stored; there is no collector endpoint or external analytics dependency. Tracking can be paused, reset or exported. Background queries and telemetry do not contribute, and the report excludes its own controls.

Validation includes model tests for periods, local dates, corruption, bounded input, pause and persistence; storage tests cover updates, reset preferences and write failure. A real-browser journey verifies Strict Mode does not duplicate opens, polling/report exclusion, no captured field values, unused rows, pause/resume, export, reset, reload persistence and desktop/mobile presentation. Preview tests use a separate browser context and do not populate the user's usage history.
