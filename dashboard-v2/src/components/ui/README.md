# UI primitives

Pure presentational components with explicit props and colocated SCSS Modules.
Import reusable components through `index.ts` or their named module exports.
No API calls, profile keys or game actions belong here. `ResourceBar` accepts
nullable readings so unavailable telemetry is displayed explicitly.
`Sprite` renders local catalog sheets and exposes an accessible fallback.
`NumberInput` keeps temporary empty values explicit instead of coercing them to zero.
`Tooltip` exposes the same help text to pointer and keyboard users.
