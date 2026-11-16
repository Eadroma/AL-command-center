# Norme de code

> **Statut : proposition à valider ensemble.** Rien n'est encore appliqué. Chaque règle donne sa raison
> et, quand c'est possible, l'outil qui la vérifie. Une règle sans outil passe par la revue.

## 1. Pile

- **TypeScript** partout : interface, serveur, outillage, tests. Pas de fichier `.js` écrit à la main.
- Interface : **SolidJS** + `@solidjs/router`, construite par **Vite**.
- Serveur : **Hono** sur Node 24, dans le même paquet. WebSocket intégré à `@hono/node-server` ≥ 2.0.10
  (`@hono/node-ws` est déprécié). En développement, `pnpm dev` lance Vite et Hono ; Vite relaie `/api` et `/live`.
- Validation : **Zod**, partagé entre interface et serveur (`shared/`). Schémas souples pour les données du jeu.
- Base : SQLite intégré à Node (`node:sqlite`), requêtes préparées en SQL simple, FTS5 en SQL brut, sans ORM
  (ADR 0010). Disque local uniquement.

## 2. TypeScript strict

`tsconfig.base.json`, hérité par tous les sous-projets :

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true, // vérifié à l'étape 1, retiré si une dépendance l'empêche
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noFallthroughCasesInSwitch": true,
    "useUnknownInCatchVariables": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true
  }
}
```

| Règle | Raison | Vérifiée par |
| --- | --- | --- |
| Pas de `any`. `unknown` puis validation. | Un `any` désactive le contrôle pour tout ce qui en dépend. | `@typescript-eslint/no-explicit-any`, `no-unsafe-*` |
| Toute donnée entrante est validée par Zod (HTTP, `settings.json`, télémétrie, réponses MCP, `data.js`). Les types en sont déduits avec `z.infer`. | Le compilateur ne voit pas ce qui vient de l'extérieur. Un seul endroit décrit la forme. | Middleware de validation Hono, revue |
| Pas d'assertion non nulle `!`, pas de `as` pour contourner un type. | Cache des cas `undefined` réels. | `no-non-null-assertion`, `consistent-type-assertions` |
| Promesses attendues ou ignorées explicitement (`void`). | Une erreur non attendue disparaît sans trace. | `no-floating-promises`, `no-misused-promises` |
| `switch` exhaustif sur les unions. | Un nouveau cas ajouté plus tard est signalé partout. | `switch-exhaustiveness-check` |
| Types de retour explicites sur ce qui est exporté. | Le contrat se lit sans ouvrir l'implémentation. | `explicit-module-boundary-types` |
| Erreurs attendues renvoyées comme valeur (`Result<T, E>`), exceptions pour l'inattendu. | L'appelant voit dans le type ce qui peut échouer. | Revue |
| Propriétés `readonly` par défaut sur les props et les objets partagés. | Pas de mutation accidentelle d'un profil en cache. | `prefer-readonly`, revue |

## 3. Solid

| Règle | Raison | Vérifiée par |
| --- | --- | --- |
| Ne pas déstructurer `props` (`splitProps` si besoin). | Casse la réactivité. | `solid/no-destructure` |
| `<Show>`, `<For>`, `<Switch>` plutôt que `&&` et `.map()`. | Mises à jour ciblées du DOM. | `solid/prefer-for`, `solid/prefer-show` |
| Lire les signaux dans un contexte réactif. | Sinon la valeur est figée. | `solid/reactivity` |
| `createMemo` pour un calcul dérivé, `createEffect` seulement vers l'extérieur. | Évite les boucles et les états en double. | Revue |
| Un composant affiche, une fonction pure calcule (fichier `.ts` à côté, testé). | Logique testable sans navigateur. | Revue |

## 4. Langues (français et anglais)

Aucun texte visible n'est écrit en dur.

- Bibliothèque : `@solid-primitives/i18n`, dictionnaires en TypeScript dans `src/i18n/<langue>/<domaine>.ts`.
- `en` est la référence. Chaque autre langue est typée `satisfies Dictionary` : une clé manquante ou en trop,
  ou un paramètre absent, fait échouer la compilation.
- Paramètres par fonction typée, jamais de concaténation :
  `offline: (p: { name: string }) => \`${p.name} est hors ligne\``.
- Pluriels, nombres, dates, durées : `Intl.PluralRules`, `Intl.NumberFormat`, `Intl.DateTimeFormat`,
  `Intl.RelativeTimeFormat`.
- Le serveur renvoie des **codes d'erreur** typés (`{ code: 'mcp.invalidToken' }`), l'interface les traduit.
  Les journaux techniques restent en anglais.
- Textes du jeu : pris dans `languages/fr/` du dépôt du jeu quand la clé existe, anglais sinon (mention discrète).
- Exceptions : noms de personnages, identifiants techniques, messages d'erreur bruts du jeu ou du MCP
  (affichés tels quels à l'intérieur d'un message traduit).

| Contrôle | Outil |
| --- | --- |
| Texte en dur dans le JSX et ses attributs | `i18next/no-literal-string` v6, mode `jsx-only` (`jsx-text-only` ignore les attributs). `jsx-attributes.exclude` complété pour Solid : `class`, `classList`, `for`, `href`, `src`, `role`, `name`, `data-*` (les valeurs par défaut ne connaissent que `className`). |
| Chaîne littérale passée à `notify()` ou `confirmAction()` | `no-restricted-syntax` |
| Clé absente dans une langue | TypeScript (`satisfies`) |
| Clé inutilisée, texte identique dans les deux langues | `pnpm i18n:check` (erreur pour les clés inutilisées, avertissement pour les doublons, liste d'exceptions explicite) |

## 5. Organisation

- Un fichier, un rôle : 250 lignes au plus (`max-lines`), fonctions de 50 lignes au plus (`max-lines-per-function`).
- En-tête de fichier en anglais : rôle, utilisateurs, ce qu'il ne fait pas. TSDoc sur tout export.
- Noms complets (`telemetryAgeSeconds`, pas `tAge`). Fichiers en kebab-case, composants en PascalCase,
  hooks/primitives en `useXxx` / `createXxx`, tests `<sujet>.test.ts`.
- Exports nommés uniquement, `import type` pour les types, pas de cycle (`import-x/no-cycle`).
- Frontières : `src/` n'importe jamais `server/`, seulement `shared/` et le client typé
  (`import-x/no-restricted-paths`). `shared/` n'importe ni l'un ni l'autre.
- Styles : CSS natif, un fichier par composant, couleurs uniquement via les variables de thème.
- Interface : suivre [DESIGN.md](DESIGN.md) (palette, polices locales, case crantée) ; tout nouvel écran passe par le
  skill frontend-design (plan, relecture contre les défauts génériques, critique sur captures bureau et téléphone).
- Accessibilité : éléments natifs (`<button>`, `<dialog>`, `<details>`), focus visible, `eslint-plugin-jsx-a11y`
  quand il gère Solid, revue sinon.

## 6. Tests

- Vitest pour la logique et les composants (`@solidjs/testing-library`), Playwright pour trois parcours :
  premier lancement, enregistrer → prévisualiser → déployer, conflit entre deux fenêtres.
- Builder : golden tests contre les bundles produits par dashboard-v2.
- Déploiement : faux serveur MCP rejouant des réponses réelles. Aucun test ne touche le vrai compte.
- Données du jeu : mini `G` en fixture, faux serveur HTTP local. La CI n'appelle jamais adventure.land.

## 7. Outils et commandes

- ESLint 10 en configuration plate : liste complète et justifiée dans [ESLINT.md](ESLINT.md), configuration validée
  par le prototype dans [reference/](reference/). TypeScript reste en 6.0 tant que typescript-eslint ne supporte pas 7.
- Serveur exécuté par Node 24 sans compilation (type stripping) : `import type`, extensions `.ts` dans les imports,
  ni enum, ni namespace, ni propriétés de paramètres (`erasableSyntaxOnly`).
- Skills installés pour Claude : `node` et `typescript-magician` (Matteo Collina, MIT).
- Prettier pour le formatage, jamais discuté en revue.
- `pnpm check` = types + lint + `i18n:check` + tests. Même commande en local et en CI.
- Commits : Conventional Commits (`feat(team): …`, `fix(deploy): …`), vérifiés par commitlint.

## 8. Hors périmètre pour l'instant

Les scripts du jeu (`code/*.js`) restent en JavaScript ES5 : ils tournent dans le jeu, pas dans le dashboard.
Les passer en TypeScript compilé par esbuild est une question ouverte, à traiter après la bascule.

## Pièges Solid constatés

- **`<select value>` avec des options rendues par `<For>`** : Solid applique la valeur avant que les options
  existent, le navigateur retombe sur la première. Toujours poser `selected={...}` sur chaque `<option>`.
  (Bug vu sur l'écran Réglages : l'état disait « III », l'écran affichait « I ».)

## Décisions

Toute décision d'architecture (dépendance structurante, format de données, règle de sécurité, écart à cette norme)
s'écrit dans [`adr/`](adr/README.md) : un fichier court, numéroté, jamais supprimé (on le marque « remplacée »).
- **Vite sous Windows** : l'observateur natif a raté des écritures rapprochées (module périmé servi, page blanche).
  `vite.config.ts` active le polling sous Windows ; si une page reste blanche après une modification, relancer `pnpm dev`.
