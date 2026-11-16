# 0004 — Tâche game-data : sources et revalidation

- **Statut** : acceptée, 26/10/2026 (implémentation : cartes « Données du jeu »)
- **Contexte** : le dépôt du jeu pèse 430 Mo ; `G` n'existe que dans `adventure.land/data.js` (2,8 Mo).
  Mesuré : avec gzip (que `fetch` demande toujours), le serveur ignore `If-None-Match` et renvoie tout.
- **Décision** : `HEAD` sans compression pour lire l'ETag de `data.js`, téléchargement seulement s'il change ;
  images et docs depuis le dépôt GitHub via l'arbre git (SHA par fichier), adventure.land en secours ;
  validation Zod souple ; `G` reste côté serveur, l'interface reçoit des projections ; rien de tout cela dans git.
- **Conséquences** : vérification quotidienne quasi gratuite ; docs rendues avec nunjucks (le moteur du jeu),
  `tutorial_data` à reproduire pour 15 tutoriels.
