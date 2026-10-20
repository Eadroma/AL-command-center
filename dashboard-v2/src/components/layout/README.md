# Layout

`AppShell` defines the page frame, `PageHeader` displays connection state and
refresh controls, and `DashboardGrid` places feature panels responsively.
These components receive state and handlers; they do not fetch data.

`NavBar` renders two levels: the four primary workspaces and the pages belonging
to the active workspace. Route metadata and hash validation live together in
`src/models/navigation.ts`, so adding a page cannot leave routing and menus with
different allowlists. Existing page hashes remain stable for bookmarks.
