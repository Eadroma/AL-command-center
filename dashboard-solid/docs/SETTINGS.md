# `settings.json` — réglages globaux

Un seul fichier pour tout ce qui concerne **la machine et le compte**. Emplacement par défaut : le dossier
applicatif de l'OS (`%LOCALAPPDATA%\ALCC\settings.json` sous Windows), à côté des données, pour que le jeton
ne se trouve pas dans le dossier du code. La variable `ALCC_SETTINGS` permet un autre chemin. Le dépôt ne
contient que `settings.example.json`.

> Ton fichier est dans `%LOCALAPPDATA%\ALCC\settings.json` depuis le 26/10/2026. Pendant la migration, il utilise
> le port 9321 (dashboard-v2 garde 9320) et `deploy.enabled: false`.

La composition de l'équipe, les cibles, le marchand, etc. restent dans le **profil** (versionné,
modifiable depuis l'interface, déployé par le parcours Enregistrer → Prévisualiser → Déployer).

## Comment il est créé

1. Au premier lancement, s'il n'existe pas, le serveur démarre en *mode réglages* et l'interface affiche l'écran **Réglages**.
2. L'utilisateur remplit le formulaire et clique **Valider**.
3. Le serveur vérifie les valeurs (schéma Zod), teste la clé MCP auprès du jeu, vérifie que la région et le
   serveur existent (`get_servers` : le jeu renomme parfois ses serveurs), puis écrit le fichier
   de façon atomique (fichier temporaire puis renommage, droits `600`).
4. Les réglages sont rechargés sans redémarrage. Si une valeur exige un redémarrage (port, hôte), l'écran le dit.

On peut aussi le remplir à la main à partir de `settings.example.json`. Un fichier invalide n'empêche pas
le démarrage : l'écran Réglages s'ouvre et indique le champ en cause.

## Champs

| Champ | Exemple | Rôle |
| --- | --- | --- |
| `version` | `1` | Version du format. Permet de migrer le fichier plus tard. |
| `account.mcpUrl` | `https://adventure.land/mcp` | Adresse MCP du jeu. À ne changer que pour un serveur de test. |
| `account.mcpToken` | *(secret)* | Jeton MCP obtenu dans Mainframe → *Connect an AI*. Jamais le mot de passe du jeu. |
| `game.region` / `game.server` | `EU` / `III` | Serveur de base de l'équipe. Ne déplace pas les personnages en jeu. |
| `game.runtime` | `browser` | `browser` (personnages ouverts dans le navigateur) ou `mainframe`. |
| `game.codeDirectory` | `../code` | Dossier des scripts du jeu utilisés pour construire les bundles, relatif au dossier `dashboard-solid` (`../code` = le dossier `code/` du dépôt). |
| `dashboard.mode` | `local` | `local` : écoute sur 127.0.0.1, sans compte, mais avec contrôle de l'en-tête Host, de l'origine et un jeton anti-CSRF. `hosted` : refuse de démarrer sans authentification ni HTTPS. |
| `dashboard.publicUrl` | *(vide)* | Adresse à laquelle les scripts **navigateur** envoient la télémétrie. Vide = `http://127.0.0.1:<port>`. Sans effet pour Mainframe : ses machines n'ont pas d'accès internet, le serveur va chercher leur état par le MCP. |
| `dashboard.host` / `dashboard.port` | `127.0.0.1` / `9320` | Adresse d'écoute. Redémarrage nécessaire. |
| `dashboard.dataDirectory` | *(vide)* | Base de données, télémétrie, sauvegardes. Vide = dossier applicatif de l'OS (`%LOCALAPPDATA%\ALCC` sous Windows). |
| `dashboard.language` | `fr` | Langue de l'interface (`fr`, `en`). |
| `dashboard.theme` | `night` | Thème par défaut (`night`, `day`). Chaque navigateur peut le changer pour lui-même. |
| `gameData.autoUpdate` | `true` | Met à jour données, images et documentation du jeu. Voir [DOCUMENTATION.md](DOCUMENTATION.md). |
| `gameData.checkEveryHours` | `24` | Fréquence de vérification de `data.js` (requête conditionnelle, quasi gratuite sans changement). |
| `gameData.docsEveryDays` | `7` | Âge maximum de la documentation avant une nouvelle mise à jour. |
| `market.enabled` | `false` (exemple), `true` (toi) | Collecte des prix sur l'API communautaire `aldata.earthiverse.ca`. Désactivé dans le modèle : c'est un service externe. Voir [MARKET.md](MARKET.md). |
| `market.refreshMinutes` | `15` | Fréquence de collecte des prix. |
| `migration.relayV2Url` | *(vide)* (exemple), `http://127.0.0.1:9320` (toi) | Pendant la migration, lit la télémétrie en direct depuis dashboard-v2, qui fait encore tourner les scripts. Vide = désactivé. |
| `deploy.enabled` | `true` (exemple), `false` (toi) | Autorise le déploiement. Verrouillé chez toi tant que dashboard-v2 reste le seul à déployer (migration). |

## Priorité des sources

Variable d'environnement > `settings.json` > valeur par défaut.
Exemple : `AL_MCP_TOKEN` remplace `account.mcpToken` (utile en CI ou pour un test ponctuel).

## Sécurité

- Le fichier est dans `.gitignore`. Ne jamais faire `git add -f settings.json`.
- L'API ne renvoie jamais le jeton : l'écran affiche seulement « configuré » et un bouton **Tester la connexion**.
- Pour changer de jeton, en coller un nouveau puis **Valider**. L'ancien est remplacé, pas conservé.
