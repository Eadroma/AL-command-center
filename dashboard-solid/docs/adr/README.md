# Décisions d'architecture (ADR)

Un fichier court par décision : contexte, décision, conséquences. Une décision remplacée n'est pas supprimée :
son statut passe à « Remplacée par NNNN ».

| N° | Décision | Statut |
| --- | --- | --- |
| [0001](0001-reecriture-complete.md) | Réécriture complète, dashboard-v2 comme cahier des charges | Acceptée |
| [0002](0002-vite-solid-hono.md) | Vite + Solid + Hono dans un seul paquet | Acceptée |
| [0003](0003-settings-json.md) | Réglages dans `settings.json`, dossier applicatif | Acceptée |
| [0004](0004-donnees-du-jeu.md) | Tâche game-data : sources et revalidation | Acceptée |
| [0005](0005-cohabitation-v2.md) | Cohabitation avec dashboard-v2 pendant la migration | Acceptée |
| [0006](0006-typescript-6.md) | TypeScript 6.0 tant que typescript-eslint ne supporte pas 7 | Acceptée |
| [0007](0007-schemas-zod-partages.md) | Schémas Zod partagés, l'interface valide les réponses | Acceptée |
| [0008](0008-garde-fous-locaux.md) | Garde-fous du mode local (Host, CSRF, télémétrie) | Acceptée |
| [0009](0009-telemetrie.md) | Télémétrie compatible v2 et relais pendant la migration | Acceptée |
| [0010](0010-node-sqlite.md) | SQLite intégré à Node plutôt que better-sqlite3 + Drizzle | Acceptée |
