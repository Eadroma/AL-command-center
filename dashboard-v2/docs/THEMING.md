# Theming Guide

> Note : ce guide est en anglais (le reste de la documentation du projet est en
> français). Les noms de tokens et de fichiers cités ici sont les références
> exactes à utiliser dans le code.

The dashboard uses a retro CRT theme built on SCSS variables, SCSS Modules and
two Google Fonts. This guide explains how the theme is organised and how to
create or restyle a component without breaking the look.

Everything documented here lives in two files:

```text
src/styles/_variables.scss   All design tokens (colors, fonts, effects)
src/styles/global.scss       App-wide rules and the CRT overlay layers
```

## Design tokens

Every component must use the shared tokens from `_variables.scss` instead of
hard-coded colors. Import them at the top of each SCSS Module:

```scss
@use '../../styles/variables' as *;
```

Adjust the relative path to your file's depth (components in
`src/components/pages/` use `../../styles/variables`, files one level deeper
use `../../../styles/variables`).

### Palette

| Token | Value | Usage |
| --- | --- | --- |
| `$retro-bg` | `#0d0d1a` | App background (deep night blue) |
| `$retro-surface` | `#141428` | Cards, panels, HUD boxes |
| `$retro-surface-alt` | `#1a1a35` | Secondary surface, hover states |
| `$retro-border` | `#2a2a4a` | Default borders |
| `$retro-border-glow` | `#3d3d6b` | Interactive borders, focus |
| `$retro-accent` | `#7c3aed` | Primary accent (purple) |
| `$retro-accent-glow` | `rgba(124, 58, 237, 0.35)` | Glow color of the accent |
| `$retro-green` | `#22c55e` | Success / alive / enabled |
| `$retro-amber` | `#f59e0b` | Warning / dirty state / pending |
| `$retro-red` | `#ef4444` | Error / dead (RIP) / danger |
| `$retro-cyan` | `#06b6d4` | Mana / telemetry / informational |

### Text

| Token | Value | Usage |
| --- | --- | --- |
| `$text-primary` | `#e2e8f0` | Default text |
| `$text-muted` | `#94a3b8` | Secondary text |
| `$text-faint` | `#64748b` | De-emphasised details |

### Typography

| Token | Font | Usage |
| --- | --- | --- |
| `$font-hud` | `VT323`, monospace | Headings, big HUD numbers |
| `$font-mono` | `JetBrains Mono`, monospace | Body text, inputs, buttons |

Both fonts are loaded in `index.html` from Google Fonts. If the machine is
offline the theme degrades gracefully to the generic `monospace` stack.

### Shapes and effects

| Token | Usage |
| --- | --- |
| `$radius-none` | `0px` — the retro look uses no rounded corners |
| `$border-pixel` | Ready-made `1px solid $retro-border` |
| `$border-active` | Ready-made `1px solid $retro-accent` |
| `$scanline-color` | CRT horizontal scanline tint |
| `$vignette-color` | Screen-edge darkening |
| `$glow-accent` / `$glow-green` / `$glow-red` | Box-shadow halos for active elements |
| `$transitions-fast` | `0.12s steps(2, end)` — deliberately choppy "pixel" motion |

## Global layers (global.scss)

`global.scss` is imported once in `src/main.tsx` and provides:

- Reset and base typography (body uses `$font-mono` on `$retro-bg`).
- A retro pixel scrollbar.
- Uppercase `VT323` headings for `h1`–`h4`.
- **CRT scanlines** — `body::before`, a fixed repeating gradient, `z-index: 9999`.
- **Vignette** — `body::after`, a fixed radial gradient, `z-index: 9998`.
- Themed `::selection` and a visible `:focus-visible` outline.
- A `prefers-reduced-motion` block that disables animations and transitions.

Both overlays are `pointer-events: none`, so they never block clicks. Keep
their `z-index` values the highest in the app; do not add modals above 9998
without accounting for them.

## Recipe: a themed component

```tsx
// src/components/ui/StatusLight.tsx
import styles from './StatusLight.module.scss';

type Props = { ok: boolean; label: string };

export function StatusLight({ ok, label }: Props) {
  return (
    <span className={ok ? styles.ok : styles.bad} role="status">
      {label}
    </span>
  );
}
```

```scss
// src/components/ui/StatusLight.module.scss
@use '../../styles/variables' as *;

.ok {
  color: $retro-green;
  border: $border-pixel;
  background: $retro-surface;
}

.bad {
  color: $retro-red;
  border: 1px solid $retro-red;
  box-shadow: $glow-red;
}
```

Conventions (enforced by `CONTRIBUTING.md`):

- One component per file, named exports, explicit prop interfaces.
- SCSS Modules only — no global class names outside `global.scss`.
- Only tokens from `_variables.scss`; if you need a new token, add it there
  with a comment explaining its usage, then use it everywhere.
- Component conventions live in `src/components/layout/README.md`.

## Adding or changing a token

1. Add the variable in `src/styles/_variables.scss` under the matching
   section, with a short comment.
2. Never rename an existing token without grepping the whole `src/` tree —
   module files reference tokens directly.
3. Check dark-value contrast: text must stay readable on `$retro-surface`.
4. Run `pnpm build` — Vite compiles every SCSS Module and will fail on a
   broken `@use` path or an unknown variable.

## Accessibility

The theme respects the retro aesthetic but keeps the app usable:

- Keyboard focus is always visible (`:focus-visible` ring in `global.scss`,
  per-component focus styles in `Button.module.scss`).
- All motion respects `prefers-reduced-motion`.
- Text contrast: `$text-primary`/`$text-muted` on `$retro-surface` meet WCAG
  AA at the sizes used. If you introduce new color pairs, verify contrast.

## Related docs

- [ROADMAP](ROADMAP.md) — project status and next steps
- [Contributing](../CONTRIBUTING.md) — code conventions
- [Layout components](../src/components/layout/README.md) — shell and grid
