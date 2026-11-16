# Règles ESLint

> **Validé par le prototype jetable (26/10/2026).** La configuration complète est dans
> [`reference/eslint.config.ts`](reference/eslint.config.ts). Le fichier
> [`reference/lint-fixture.Violations.tsx`](reference/lint-fixture.Violations.tsx) contient des fautes
> volontaires : le lint doit en signaler 18, sinon une règle a cessé de fonctionner.

## Versions

| Outil | Version | Pourquoi |
| --- | --- | --- |
| ESLint | 10 (configuration plate, `defineConfig`) | `tseslint.config()` est déprécié. |
| typescript-eslint | 8.72 | Analyse typée (`projectService`). |
| TypeScript | **6.0.3** | typescript-eslint ne supporte que TypeScript < 6.1. TypeScript 7 (natif) casserait toutes les règles typées. Passage à 7 : voir la carte « Passer à TypeScript 7 ». |
| eslint-plugin-solid | 0.18 | Réactivité Solid. Configs `v2` déjà présentes pour Solid 2. |
| eslint-plugin-i18next | 6.1 | Textes en dur. |
| eslint-plugin-import-x | 4.17 + `eslint-import-resolver-typescript` | Cycles, frontières entre couches. |
| @eslint-community/eslint-plugin-eslint-comments | 4 | Raison obligatoire pour chaque désactivation. |

## Les règles, par intention

### Correction (bugs évités)

| Règle | Effet |
| --- | --- |
| `strictTypeChecked` (typescript-eslint) | Pas de `any`, pas d'accès non sûrs, pas de `!`, promesses gérées, conditions inutiles signalées. |
| `@typescript-eslint/no-floating-promises`, `no-misused-promises` | Une promesse non attendue est une erreur silencieuse. |
| `@typescript-eslint/switch-exhaustiveness-check` | `default` obligatoire sur un type ouvert (texte). Sur une union, le `default` contient `const _exhaustive: never = valeur;` : un nouveau cas casse la compilation. |
| `@typescript-eslint/strict-boolean-expressions` | Pas de `if (texte)` ambigu : vide et absent sont traités explicitement. |
| `@typescript-eslint/consistent-type-assertions` (`never`) | Aucun `as` pour contourner un type ; valider à la place. |
| `@typescript-eslint/no-base-to-string` | A trouvé un vrai bug au prototype (`String(event.data)` sur un message binaire). |
| `@typescript-eslint/require-array-sort-compare` | `sort()` sans comparateur trie des nombres comme du texte. |
| `@typescript-eslint/return-await` (`in-try-catch`) | Les erreurs restent attrapées par le `try` qui les entoure. |
| `eqeqeq`, `no-implicit-coercion` | Pas de conversion implicite. |
| `no-param-reassign` (`props`) | Pas de mutation d'un argument (profils en cache). Seule exception : un paramètre nommé `context` (contexte Canvas 2D, qu'on configure en affectant ses propriétés). |

### Lisibilité

| Règle | Seuil |
| --- | --- |
| `max-lines` | 250 lignes utiles par fichier (dictionnaires de langue exemptés). |
| `max-lines-per-function` | 50 lignes (tests exemptés). |
| `complexity`, `max-depth`, `max-params` | 10, 3, 3 (au-delà : passer un objet). |
| `no-nested-ternary`, `curly`, `no-else-return`, `prefer-template`, `object-shorthand` | Forme unique pour chaque construction. |
| `@typescript-eslint/naming-convention` | Types en PascalCase, variables en camelCase ou UPPER_CASE. |
| `@typescript-eslint/explicit-module-boundary-types` | Ce qui est exporté déclare son type de retour. |
| `@typescript-eslint/consistent-type-imports` / `-exports` | `import type` séparé (exigé aussi par le type stripping de Node). |
| `no-console` | Interdit hors `scripts/` : journal structuré côté serveur. |

### Architecture

| Règle | Effet |
| --- | --- |
| `import-x/no-restricted-paths` | `src/` ↛ `server/`, `server/` ↛ `src/`, `shared/` ↛ les deux. |
| `import-x/no-cycle`, `no-self-import`, `no-duplicates` | Pas de dépendance circulaire. |
| `import-x/no-default-export` | Exports nommés (sauf fichiers `*.config.ts`). |
| `import-x/no-unresolved`, `namespace`, `default`, `named` | **Désactivées** : TypeScript fait déjà ce contrôle, plus vite. |

### Solid (fichiers `src/`)

`solid/reactivity`, `solid/no-destructure`, `solid/prefer-for`, `solid/prefer-show`, `solid/self-closing-comp`,
`solid/no-react-specific-props`, plus le préréglage TypeScript du plugin.

### Langues (fichiers `src/**/*.tsx`)

| Règle | Réglage |
| --- | --- |
| `i18next/no-literal-string` | Mode `jsx-only` (`jsx-text-only` ignore les attributs). Attributs techniques exclus pour Solid : `class`, `classList`, `for`, `href`, `src`, `role`, `name`, `data-*`… |
| `no-restricted-syntax` | Chaîne littérale passée à `notify()` ou `confirmAction()` interdite. |

### Désactivations

`linterOptions.reportUnusedDisableDirectives: 'error'`, `eslint-comments/require-description`,
`eslint-comments/no-unlimited-disable` : toute désactivation nomme sa règle, dit pourquoi, et disparaît quand elle ne
sert plus.

## Ce que le prototype a appris

- **`exactOptionalPropertyTypes`** casse avec deux bibliothèques (`ws` × `@hono/node-server`, et
  `eslint-plugin-solid` × types ESLint). Option gardée pour le code applicatif ; `tsconfig.tools.json` la relâche pour
  les fichiers de configuration ; l'unique exception applicative est un `@ts-expect-error` commenté, qui échouera de
  lui-même quand la bibliothèque sera corrigée.
- **Conflit de préréglages** : `non-nullable-type-assertion-style` (stylistique) recommande `!`, interdit par
  `no-non-null-assertion` (strict). Désactivée.
- **Faux positif connu** : `solid/reactivity` sur `translator(dictionary)` au niveau du module ; désactivation
  justifiée sur la ligne.
- **Durée** : environ 9 s pour lint complet avec analyse typée sur le prototype.
