# Documentation et données du jeu

> **Statut : conception.** Décrit le fonctionnement visé, rien n'est codé.

L'onglet **Docs** affiche la documentation officielle d'Adventure Land hors ligne, avec recherche, et une
encyclopédie (monstres, objets, cartes, classes, calculateurs) reliée à l'équipe. Une seule tâche serveur,
`game-data`, met à jour les données du jeu, les images et la documentation.

## Sources

| Contenu | Source | Jeton |
| --- | --- | --- |
| Guides, tutoriels, fonctions CODE, articles | Dépôt `kaansoral/adventureland_mongodb` : `docs/`, textes `languages/fr/docs.json` (2 808 clés) avec repli sur `languages/en/docs.js` | Non |
| Données du jeu (`G`) | `https://adventure.land/data.js` (2,8 Mo, avec ETag), seule source à jour : le serveur du jeu le génère | Non |
| Images (icônes, sprites, tuiles) | Dépôt GitHub en priorité, même chemin sur adventure.land en secours | Non |
| Prix du marché | Voir [MARKET.md](MARKET.md) | Non |

Le dépôt complet pèse 430 Mo (dont 132 Mo d'images) : il n'est **jamais** téléchargé en entier. Une requête à
l'API Git trees (`/git/trees/main?recursive=1`, 4 331 entrées, non tronquée au 26/10/2026) donne le SHA de chaque
fichier. Seuls les fichiers nécessaires dont le SHA a changé sont téléchargés depuis `raw.githubusercontent.com`.

Les pages officielles sont des gabarits **nunjucks** (le moteur du jeu) : `phrase`, `phrase_html`, mais aussi
`{% include %}`, `{% if %}`, `{% for %}`. Elles sont rendues avec nunjucks, en français quand la clé existe,
en anglais sinon (mention discrète), puis converties en Markdown.

Les fonctions reprises d'[AL Data Explorer](https://aldata.adventureland.community/) sont réécrites à partir
des données du jeu : son dépôt n'a pas de licence, son code n'est pas copié.

## Rythme

Le dashboard ne tourne pas en permanence : au démarrage, puis toutes les 6 heures, le serveur rattrape ce qui est en retard.

| Quoi | Quand | Coût sans changement |
| --- | --- | --- |
| `data.js` | Toutes les `gameData.checkEveryHours` heures (24) | Une requête conditionnelle (ETag), réponse 304 |
| Images | Quand `G` a changé | Rien |
| Documentation | Tous les `gameData.docsEveryDays` jours (7) | Une requête à l'API Git trees |

Le bouton **Mettre à jour maintenant** et la commande `pnpm game:update` lancent la même tâche. Pour la planifier
dashboard fermé :

- **Windows** : `schtasks /Create /SC WEEKLY /D MON /ST 09:00 /TN "ALCC game-data" /TR "cmd /c cd /d C:\chemin\vers\dashboard-solid && pnpm game:update"`
- **Linux / macOS** (`crontab -e`) : `0 9 * * 1 cd /chemin/vers/dashboard-solid && pnpm game:update`

## Règles de la tâche

- Lecture de `data.js` sans `eval`. Validation Zod **souple** : seuls les champs utilisés sont exigés, les ajouts
  du jeu sont acceptés et signalés. Empreinte SHA-256 du contenu normalisé : version seule modifiée = rien à faire.
- `G` reste côté serveur ; l'interface reçoit des projections (liste d'objets, fiche monstre, prix).
- Images tirées de `G.imagesets`, `G.sprites`, `G.tilesets`, nommées par empreinte (SHA du blob git, ou SHA-256
  si l'image vient d'adventure.land), servies avec `Cache-Control: immutable`. Signature PNG et dimensions vérifiées.
- 6 téléchargements en parallèle, délai de 30 s, nouvelles tentatives espacées sur 429/5xx (`Retry-After` respecté).
- Préparation à part, bascule par écriture du manifeste en dernier. Plus de 2 % d'images en échec : l'ancienne version reste.
- Une seule exécution à la fois (verrou en base). État, durée et rapport des changements enregistrés et affichés.
- Tests : mini `G` en fixture, faux serveur HTTP local. La CI n'appelle jamais adventure.land ni GitHub.

Les images et textes du jeu sont sous licence AdventureLandOnlyUse : attribution et lien vers https://adventure.land
affichés dans l'interface, rien de tout cela dans le dépôt public.

## Stockage

Tout va dans le dossier applicatif (`dashboard.dataDirectory`) : Markdown des docs, `game-data.json`, images,
index de recherche FTS5 dans la base SQLite. Seules la version courante et la précédente sont gardées.

## Mesures réelles (26/10/2026)

- `G` version 18183 référence **227 images** (8 planches d'icônes, 193 planches de sprites, 26 tuiles de cartes),
  toutes présentes dans le dépôt GitHub, **3,5 Mo** sur disque.
- Premier lancement dans un dossier vide : données + images en **2,2 s**. Lancement suivant : aucun téléchargement.
- Chaque image venue de GitHub doit avoir exactement l'empreinte git de l'arbre (SHA-1 de `blob <taille>\0<contenu>`),
  un en-tête PNG valide et, pour les planches d'icônes, les dimensions annoncées par `G`.
- Images servies sur `/game-assets/<empreinte>.png` (cache immuable) ; index chemin du jeu → adresse sur
  `/api/game/assets`. En développement, Vite relaie `/game-assets` vers le serveur.

## Tâche de mise à jour (26/10/2026)

- **Quand** : au démarrage du serveur, puis toutes les 6 heures tant qu'il tourne (si `gameData.autoUpdate`) ;
  à la demande (`POST /api/game/refresh`, jeton CSRF requis) ; en ligne de commande (`pnpm game:update`).
  Les lancements manuels et en ligne de commande vérifient toujours ; les automatiques seulement si les données
  ont plus de `gameData.checkEveryHours` heures.
- **Une seule à la fois** : verrou en mémoire dans le serveur, et fichier `game-data/update.lock` partagé entre le
  serveur et la commande. Un verrou dont le processus a disparu, ou de plus de 10 minutes, est repris.
- **État** : dernière exécution (déclencheur, début, fin, durée, résumé) dans `game-data/job.json`, lisible sur
  `GET /api/game/job`.
- **Rapport des changements** : à chaque changement de contenu, objets, monstres et cartes ajoutés, retirés ou
  modifiés sont ajoutés à `game-data/changes.json` (20 derniers rapports), lisibles sur `GET /api/game/changes`.
- **Code de sortie** de `pnpm game:update` : 0 à jour ou mis à jour, 1 échec, 2 une autre mise à jour tourne.
