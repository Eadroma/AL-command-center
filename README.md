# Adventure Land Command Center

[![Build and tests](https://github.com/Eadroma/AL-command-center/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Eadroma/AL-command-center/actions/workflows/ci.yml)
[![Code quality](https://github.com/Eadroma/AL-command-center/actions/workflows/quality.yml/badge.svg?branch=main)](https://github.com/Eadroma/AL-command-center/actions/workflows/quality.yml)
[![Dependency audit](https://github.com/Eadroma/AL-command-center/actions/workflows/security.yml/badge.svg?branch=main)](https://github.com/Eadroma/AL-command-center/actions/workflows/security.yml)
![Node.js 24](https://img.shields.io/badge/Node.js-24-339933?logo=nodedotjs&logoColor=white)
![pnpm 12.4.1](https://img.shields.io/badge/pnpm-12.4.1-F69220?logo=pnpm&logoColor=white)

Les trois badges de validation reflètent les résultats réels de GitHub Actions sur `main` : build et tests, lint, puis audit des dépendances et du périmètre public. Aucun score de couverture ou de qualité non mesuré n'est annoncé. Présentation inspirée de [dwyl/repo-badges](https://github.com/dwyl/repo-badges).

Dashboard local pour piloter ses personnages [Adventure Land](https://adventure.land), configurer les scripts de farming et inspecter leur activité. React, TypeScript, Fastify et SQLite, avec interfaces intégrées au jeu.

Ce projet est indépendant du jeu. Le dashboard se lance sur votre ordinateur ; il ne doit pas être exposé tel quel sur Internet. La publication du dépôt ne déploie aucun personnage.

## Démarrage

Prérequis : Node.js 24 et pnpm 12.4.1.

```sh
git clone https://github.com/Eadroma/AL-command-center.git
cd AL-command-center
pnpm --dir dashboard-v2 install --frozen-lockfile
pnpm dev
```

Ouvrir `http://localhost:5173`. L'API utilise `http://127.0.0.1:9320`.
L'assistant permet de connecter son propre compte et de choisir ses personnages. Il prépare un profil ; sauvegarde et déploiement sont des actions séparées.

En production locale :

```sh
pnpm build
pnpm --dir dashboard-v2 server
```

Ouvrir ensuite `http://127.0.0.1:9320`.

Garder le terminal ouvert pendant l'utilisation ; `Ctrl+C` arrête le service local. `pnpm preview` sert uniquement le frontend et ne remplace pas le serveur API. Conserver `dashboard-v2/` et `code/` dans leur organisation d'origine.

## Utiliser le dashboard pour la première fois

Le mode décrit ici est **Browser CODE** : le dashboard, le navigateur du jeu et les personnages doivent fonctionner sur le même ordinateur. caracAL n'est pas nécessaire pour ce mode.

1. Se connecter à [Adventure Land](https://adventure.land), ouvrir ses personnages sur le serveur souhaité et les garder ouverts.
2. Dans [Mainframe](https://adventure.land/mainframe), ouvrir **Connect an AI** et récupérer son token MCP avec **Reveal token**, ou **Create token** si nécessaire. Utiliser ce token, jamais le mot de passe du jeu.
3. Ouvrir **Team → Party** (`/#party`). Dans **First farming setup**, coller le token et cliquer sur **Connect and discover characters**. Cette étape vérifie le compte et liste les personnages.
4. Choisir la région et le serveur **home** correspondant au jeu ouvert. Sélectionner les personnages, leurs scripts v2 et le leader. Pour un personnage seul, utiliser **Independent / leader**. Le choix du serveur dans le dashboard ne déplace pas les personnages en jeu.
5. Choisir une cible adaptée à leur équipement. Le rogue et le ranger spécialisés crabs conservent leur cible dédiée ; ne pas les choisir pour tester une autre cible globale. Le rogue exige l'équipement permettant ses compétences spécifiques.
6. Dans **Review**, vérifier la composition puis cliquer sur **Stage cautious profile**. Cela prépare le brouillon ; les fonctions commerciales et activités avancées restent désactivées dans ce profil initial.
7. Cliquer sur **Save profile**, puis **Deployment preview → Preview saved deployment**. Vérifier les scripts, les personnages et les différences de CODE avant de continuer.
8. Utiliser **Deploy saved profile** pour appliquer le profil sauvegardé. Cette action écrit les bundles dans les slots `CC_<nom>` et demande leur rechargement. Le dashboard conserve une sauvegarde du contenu remplacé dans ses données locales.
9. Attendre une télémétrie récente dans Party, puis vérifier le déplacement et la console CODE du personnage. Un upload réussi ne confirme pas que le script s'exécute correctement. Utiliser **Stop** dans le roster si nécessaire.

Pour toute modification ultérieure : **modifier → Save profile → Preview saved deployment → Deploy saved profile**. Une sauvegarde seule ne change pas les scripts en cours. Le déploiement reste indisponible tant que des modifications ne sont pas sauvegardées.

Le [guide premier farming](dashboard-v2/docs/FIRST-FARMING.md) détaille les réglages prudents, les erreurs de connexion et les limites du runtime.

## Où trouver chaque fonction

| Écran | Utilisation |
| --- | --- |
| Party (`#party`) | Composition, connexion, état des personnages, sauvegarde, preview, déploiement et arrêt |
| Inventory (`#inventory`) | Inventaires live, équipements et réservations des builds |
| Combat (`#combat`) | Performances de session et diagnostic des échecs |
| Operations (`#operations`) | État des missions, watchdog de déplacement et historique des opérations |
| Farming (`#farming`) et Events (`#events`) | Cibles, hunts, boss, événements et loadouts |
| Merchant (`#merchant`) | Consommables, livraisons, achats, ventes, craft, upgrades et stand ; activer progressivement avec des budgets explicites |
| Bank (`#bank`) | Dernier snapshot bancaire et son horodatage ; ouvrir la banque en jeu pour le rafraîchir |
| Simulator (`#simulator`) | Estimations XP/or/loot, à comparer aux mesures réelles |
| Activity (`#activity`) et Scripts (`#scripts`) | Journaux serveur, catalogue et affectations des scripts |

Les mesures XP et or par heure dépendent de la télémétrie effectivement reçue. `Loot Gold/h` mesure les événements de loot ; `Balance gains/h` peut inclure des transferts. Une absence de télémétrie signifie « non confirmé ». Le voyant WebSocket décrit la liaison avec le dashboard, pas l'état du personnage.

## Dépannage

| Symptôme | Vérification |
| --- | --- |
| Interface inaccessible ou API indisponible | Relancer `pnpm dev`, vérifier Node 24 et les ports 5173/9320. Pour le build compilé : `pnpm --dir dashboard-v2 server`. |
| Token refusé | Retester la connexion dans l'assistant et vérifier le compte associé. Une variable `AL_MCP_TOKEN` existante est prioritaire sur la clé enregistrée. |
| `Open character first` | Ouvrir manuellement le personnage dans Adventure Land sur le serveur choisi. |
| Déploiement indisponible | Sauvegarder le brouillon et attendre la fin de l'opération en cours. |
| Pas de télémétrie | Vérifier la console CODE, le script exécuté et l'accès à l'API locale depuis le navigateur du jeu. |
| Conflit de sauvegarde | Conserver les modifications utiles, utiliser `Discard edits` pour recharger le profil, puis les réappliquer. |

## CI et maintenance

GitHub Actions exécute trois workflows à chaque push et pull request :

- **Build and tests** : installation avec lockfile figé, audit du périmètre, compilation TypeScript/frontend, suite Vitest complète, tests des scripts et smoke test des routes API/UI.
- **Code quality** : lint Oxlint. Ce contrôle ne constitue pas un score global de maintenabilité.
- **Dependency and publication audit** : scan des signatures de secrets sur le périmètre retenu et audit pnpm bloquant à partir du niveau élevé, également chaque semaine.

Ces workflows n'utilisent aucun compte de jeu et n'effectuent aucun déploiement. Dependabot propose les mises à jour hebdomadaires des dépendances et actions. Le smoke test utilise un profil temporaire sans personnages actifs. La vérification TypeScript actuelle couvre le frontend et le schéma partagé ; le backend n'est pas encore intégralement typé en mode strict.

## Organisation

| Dossier | Contenu |
| --- | --- |
| `dashboard-v2/` | Application maintenue : UI, API, schémas, tests et ressources |
| `code/` | Scripts de personnages et interfaces intégrées au jeu |
| `combat/` | Modules de combat partagés par les scripts historiques |
| `tests/` | Tests des scripts et du périmètre de publication |
| `tools/` | Outils de maintenance, audit et export local |
| `docs/` | Notes d'architecture et audit de publication |

Les noms de personnages présents dans les sources sont des exemples historiques. Le builder du dashboard applique les noms et réglages de votre profil. Les scripts `*-v2.js` sont privilégiés ; les variantes historiques restent utiles aux tests de régression. Le script rogue actuel est spécialisé dans les crabs.

Documentation détaillée : [dashboard](dashboard-v2/README.md), [premier farming](dashboard-v2/docs/FIRST-FARMING.md), [scripts et interfaces](code/README.md).

## Configuration et données privées

La clé `AL_MCP_TOKEN` peut être fournie via l'environnement, ou enregistrée par l'assistant dans le répertoire de données local. Aucun `.env` n'est chargé automatiquement. Ne jamais ajouter une clé au code ou au profil exporté.

`ALCC_DATA_DIR` permet d'isoler SQLite, télémétrie, sauvegardes et bundles générés. `AL_CODE_DIR` remplace le dossier `code/`. L'intégration headless est optionnelle : une installation externe de caracAL peut être indiquée par `ALCC_CARACAL_DIR`.

Le code du jeu, caracAL, les anciens dashboards, les recherches, les sauvegardes et les autres projets du dossier de travail ne font pas partie du périmètre public.

## Validation

```sh
pnpm lint
pnpm build
pnpm test
pnpm test:combat
pnpm test:smoke
pnpm audit:public
pnpm --dir dashboard-v2 audit --audit-level high
```

Les tests isolent automatiquement les données et ne déploient pas de CODE réel. Le smoke test vérifie les routes localement, sans ouvrir de port ni lire une clé de compte. Le workflow GitHub valide l'ensemble depuis la racine du monorepo, sans secret de compte.

## Préparation d'une publication

```sh
pnpm export:public
```

Cette commande prépare `.release/public-candidate/` avec une liste explicite de fichiers et un manifeste SHA-256. Elle refuse d'écraser une exportation existante et s'arrête sur les signatures de secrets détectées. Elle ne crée aucun dépôt distant et ne pousse rien sur GitHub.

Avant tout push public, lire [l'audit](docs/REPOSITORY-AUDIT.md), [les crédits et licences](THIRD_PARTY_NOTICES.md) et [la politique de sécurité](SECURITY.md). Une analyse de motifs ne prouve pas l'absence de secrets. Le choix de licence du projet et les droits des éléments tiers doivent être finalisés séparément ; aucune licence MIT globale n'est supposée.
