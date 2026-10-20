# Draft impact preview

A read-only panel appears across dashboard pages when profile edits are unsaved.
It compares the draft against useProfile's original revision-bound baseline,
including when a newer remote revision creates a conflict. It never silently
compares an old draft against a newly fetched revision.

Character changes include enabling/excluding characters, scripts and follow
settings. Shared profile groups conservatively list all enabled characters for
deployment review, not an exact dependency graph. Exact before/after values
are available in disclosures. Exclusion does not stop running CODE.

Cross-board checks reuse validateDashboardConfig. Gear availability reuses the
equipment reservation view and its fresh-character/latest-bank data rules.
Missing gear is not an automatic purchase or a definite shortage across every
possible source. The existing reservation view does not allocate distinct
copies to simultaneous slots; alternate builds may share pieces.

Saving and deployment remain separate actions. After saving, the existing CODE
deployment preview is the authoritative comparison against saved game slots.
