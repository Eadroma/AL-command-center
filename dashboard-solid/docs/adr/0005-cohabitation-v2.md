# 0005 — Cohabitation avec dashboard-v2 pendant la migration

- **Statut** : acceptée, 26/10/2026
- **Contexte** : les scripts du jeu n'envoient leur télémétrie qu'au dashboard qui a construit leur bundle ; deux
  déployeurs sur les mêmes emplacements `CC_` s'écraseraient. Constaté : v2 occupe le port 9320.
- **Décision** : dashboard-solid tourne sur 9321 avec `deploy.enabled: false` ; v2 reste seul à déployer jusqu'à la
  bascule ; les essais de déploiement se font sur un personnage de test.
- **Conséquences** : le script `dev` calcule le port comme le serveur, pour que Vite ne relaie jamais vers v2.
