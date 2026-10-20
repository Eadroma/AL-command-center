# Dashboard themes

Use the Theme selector in the header to switch between **Guild · Clean** and
**Retro · Original**. Guild is the default. The choice persists in this browser
under `alcc.dashboard.theme`. It does not alter the game profile or deploy CODE.
Unavailable browser storage falls back to Guild without blocking the dashboard.

Retro retains the original colour values, pixel headings, square controls,
scanlines, vignette and glows. The old values remain the fallback values in
`src/styles/_variables.scss`; do not replace those values when tuning Guild.

Guild tokens live in `src/styles/guild.scss` under
`html[data-theme="guild"]`. Components use shared runtime colour variables and
RGB variables for translucent states. Guild-specific component adjustments are
scoped to this root attribute in their SCSS modules. Inventory aliases resolve
to the same surface and border tokens. Keep sprite rendering and equipment slot
geometry unchanged; their pixel art belongs to the game.

Guild uses neutral surfaces, readable UI headings and forms, monospace code and
logs, tabular numbers, restrained purple selections, semantic status colours,
4px corners and larger control targets. No CRT layer covers the content.

Verification: production build and lint passed; both themes were switched in
the browser, and their selection survived reload. All 15 routes were checked at
390px with Guild and no horizontal page overflow was observed. Reset the
viewport override after checking mobile. Theme changes are cosmetic only.
