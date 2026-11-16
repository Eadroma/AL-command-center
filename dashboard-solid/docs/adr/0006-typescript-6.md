# 0006 — TypeScript 6.0 tant que typescript-eslint ne supporte pas 7

- **Statut** : acceptée, 26/10/2026
- **Contexte** : TypeScript 7 (natif) est la version courante, mais typescript-eslint 8.72 exige TypeScript < 6.1.
  Sans lui, aucune règle ESLint typée (promesses, `any`, exhaustivité) ne tourne.
- **Décision** : TypeScript 6.0.3 pour la vérification de types et le lint.
- **Conséquences** : à revoir quand typescript-eslint supportera 7, ou en passant à oxlint avec analyse typée
  (carte « Passer à TypeScript 7 »).
