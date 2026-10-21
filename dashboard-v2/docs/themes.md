# Dashboard themes

Use the theme selector in the header to switch between **Night** (default) and
**Retro**. Night is stored as `guild` so existing preferences keep working. The choice
persists in this browser under `alcc.dashboard.theme`. It does not alter the game profile
or deploy CODE. Unavailable browser storage falls back to Night without blocking the dashboard.

Retro retains the original colour values, pixel headings, square controls,
scanlines, vignette and glows. The old values remain the fallback values in
`src/styles/_variables.scss`; do not replace those values when tuning Guild.

Night tokens live in `src/styles/guild.scss` under `html[data-theme="guild"]`.
Each component module has at most one Night block. Palette: ink background `#11181a`,
surfaces `#172022`/`#1e292c`, lines `#263236`, text `#e4ebe7`, and a single gold accent
`#e2b65c` reserved for the primary action, the current page and gold amounts. Status colours
are green (online/HP), mana blue, orange (warning) and red. Type is IBM Plex Sans with
tabular numbers; code and logs stay in JetBrains Mono.

Layout rules: brand, navigation and actions share one header bar; the team roster is a
ledger of rows (sprite, identity, status, HP/MP, stats) instead of nested cards; page
slogans are hidden and panel subtitles read as a quiet second line. Pixel sprites are the
only illustration. Buttons default to the quiet secondary style; only Save profile,
Deploy saved profile and the first-run Connect action use the gold primary style. Night
cancels legacy all-caps labels inside pages and dialogs, and routes `$font-mono` /
`--font-mono` UI text to IBM Plex Sans (code and logs keep JetBrains Mono). Keep sprite rendering and equipment slot geometry unchanged.

Verification: production build and lint passed; both themes were switched in
the browser, and their selection survived reload. All 15 routes were checked at
390px with Guild and no horizontal page overflow was observed. Reset the
viewport override after checking mobile. Theme changes are cosmetic only.
