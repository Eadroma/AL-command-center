# Merchant essential overview trial

The Merchant page opens on Live overview. Settings and planning tools are separate local views; hidden editors remain mounted to preserve drafts. Rule navigation reveals the appropriate parent and child view. Save, discard, deployment actions and conflict/error messages remain outside those views.

Queue assumptions, event reports, compound details and item-rule previews are collapsed initially. Current activity, stand state, inventory space and blockers remain visible. Upgrade summaries show pending transactions even for paused rules.

This changes only dashboard presentation. No runtime script or saved profile was changed.

## Restore the previous presentation

The four original source files are preserved in `.tmp/merchant-ui-before-essentials`. Restore each file to its matching path in `src/components/pages` or `src/components/merchant`; do not restore the entire repository or overwrite runtime script changes. The backup is local and is not intended for publication.

Validation: TypeScript and production build, lint, browser check of the default overview and navigation to Settings. Party and Combat are unchanged during this first trial.
