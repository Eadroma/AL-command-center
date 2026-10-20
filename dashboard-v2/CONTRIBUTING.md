# Contributing

- Use named component exports and explicit prop interfaces.
- Import types with `import type`; do not introduce `any` in new UI code.
- Keep transport in `api`, state orchestration in hooks and pure transformations in models.
- Keep one component per file and use SCSS Modules with shared variables.
- Write code comments and JSDoc in English; document user-facing setup in the README.
- Preserve unknown runtime values instead of inventing sample telemetry.
- Never mutate cached profiles; preserve their original revision while editing.
- Validate behavior with focused tests, then run build, lint and the relevant existing suite.
- Use an isolated `ALCC_DATA_DIR` for manual tests. Never deploy to the game as part of CI.
- Describe the behavior change, verification and remaining limitations in each PR.
