# Adventure Land — Dashboard Solid

> **Statut : en construction (MVP).** Le squelette tourne (serveur Hono, interface Solid, WebSocket).
> Suivi tâche par tâche dans le Kanban, conception et wireframes dans la proposition
> (liens dans [`docs/PROPOSITION.md`](docs/PROPOSITION.md)).
>
> Le port vient de `settings.json` (le tien est réglé sur 9321 pendant la migration, dashboard-v2 garde 9320).
> `ALCC_PORT` reste prioritaire pour un essai ponctuel. `pnpm check` lance types, lint, langues et tests.

Nouvelle version du tableau de bord, entièrement réécrite en **TypeScript** : SolidJS pour l'interface,
Hono pour le serveur, dans un seul projet. Objectifs :

- **Trois écrans** : Équipe, Marchand, Banque. Le reste s'ouvre en panneau latéral.
- **Un onglet Docs** : documentation officielle du jeu, mise à jour chaque semaine, et encyclopédie
  (monstres, objets, calculateurs) reliée à l'équipe. Voir [`docs/DOCUMENTATION.md`](docs/DOCUMENTATION.md).
- **Un Market** : prix de tes objets, prix au survol et pré-remplissage des annonces et ordres d'achat.
  Voir [`docs/MARKET.md`](docs/MARKET.md).
- **Un seul fichier de réglages** : `settings.json` (clé MCP, serveur, port…), rempli par l'écran
  *Réglages* au premier lancement ou à la main, rangé dans le dossier applicatif.
- **Une seule commande** pour démarrer, sans lire le code.
- **Français et anglais** dès le départ, aucun texte en dur.
- **Une norme de code** commune, vérifiée par les outils : [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md).
- **Une identité visuelle** tirée du jeu (or, vie, mana, cases d'inventaire) : [`docs/DESIGN.md`](docs/DESIGN.md).
- **Les mêmes bundles CODE que dashboard-v2**, vérifiés octet pour octet : [`docs/BUILDER.md`](docs/BUILDER.md).

## Démarrage visé (quand le code existera)

Prérequis : [Node.js 24](https://nodejs.org) et pnpm (`corepack enable`, ou `npm install -g pnpm`
si corepack est absent).

```sh
git clone https://github.com/Eadroma/AL-command-center.git
cd AL-command-center/dashboard-solid
pnpm install
pnpm start
```

Ouvrir **http://127.0.0.1:9320**. Sans `settings.json`, le tableau de bord ouvre l'écran *Réglages* :
coller la clé MCP, choisir le serveur, cliquer **Valider**. La clé est testée, puis enregistrée dans
`settings.json` (dans `%LOCALAPPDATA%\ALCC\` sous Windows). Elle n'est jamais renvoyée au navigateur.

Pour remplir les réglages à la main : copier `settings.example.json` à cet emplacement sous le nom
`settings.json` et suivre [`docs/SETTINGS.md`](docs/SETTINGS.md).

Au premier envoi de télémétrie, Chrome demande sur l'onglet adventure.land l'autorisation d'accéder au
réseau local : cliquer **Autoriser**, sinon le dashboard ne reçoit rien.

## Règles qui ne changent pas

- Parcours de déploiement : **modifier → Enregistrer → Prévisualiser → Déployer**. Enregistrer ne déploie jamais.
- Outil local : écoute sur `127.0.0.1` uniquement, avec contrôle de l'origine des requêtes.
- `settings.json` contient la clé MCP : il est ignoré par git et ne doit jamais être partagé.
