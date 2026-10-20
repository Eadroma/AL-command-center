# State hooks

- `useBootstrap`: persisted profile, catalog and server activity.
- `useDeployments`: deployment and nested telemetry polling every three seconds.
- `useLiveFeed`: same-origin WebSocket notifications and reconnect cleanup.
- `usePartyState`: composes read-side state and local activity filtering.
- `useProfile`: revision-bound drafts, conflict detection, save and deployment feedback.

A draft retains its original snapshot while dirty. A remote refresh cannot silently
change the revision used by a save. Saving updates the query cache; deployment
uses only a saved, unmodified profile. The ref-based operation lock also guards
rapid clicks before React commits the pending state.
