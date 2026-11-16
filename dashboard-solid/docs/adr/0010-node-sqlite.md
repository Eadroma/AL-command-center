# 0010 — SQLite intégré à Node (`node:sqlite`) plutôt que better-sqlite3 + Drizzle

- **Statut** : acceptée, 27/10/2026
- **Contexte** : CONVENTIONS prévoyait `better-sqlite3` + Drizzle. Le premier besoin réel est le profil : un seul
  document JSON avec un compteur de révision. Node 24 fournit `node:sqlite` (`DatabaseSync`) sans option ni
  avertissement, FTS5 compris (vérifié sur Node 24.18), et dashboard-v2 l'utilise déjà pour son profil.
- **Décision** : `node:sqlite` en SQL simple, requêtes préparées. Pas d'ORM : une table, trois requêtes.
  Le profil reste un document JSON validé par Zod (`shared/profile.ts`) ; l'écriture est conditionnée par la
  révision (`UPDATE … WHERE revision = ?`), un conflit renvoie 409.
- **Conséquences** :
  - Aucun module natif à compiler (`allowBuilds` inchangé), aucune dépendance ajoutée.
  - Les schémas de table sont créés par `CREATE TABLE IF NOT EXISTS` ; un vrai système de migrations sera ajouté
    au premier changement de schéma (documentation FTS5, historique des déploiements).
  - Si `node:sqlite` change d'API avant de devenir stable, le code concerné tient dans `server/profile/store.ts`.
