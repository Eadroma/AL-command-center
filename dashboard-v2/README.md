# Adventure Land — Dashboard v2

Refonte du Command Center : React, TypeScript, TanStack Query, Fastify et SCSS
Modules. Les pages métier sont opérationnelles et partagent un profil
révisionné, une télémétrie live et le même flux de sauvegarde puis déploiement.

## Démarrage

Nouveau sur le projet ? Suivre [le guide premier farming](docs/FIRST-FARMING.md).
Party propose un assistant de connexion, sélection des personnages et préparation
d'un profil prudent. Il ne démarre aucun CODE ; sauvegarde, prévisualisation et
déploiement restent des étapes explicites. Le profil d'exemple se trouve dans
[examples/starter-profile.json](examples/starter-profile.json).

Prérequis : Node.js 24 et pnpm 12.4.1. Depuis ce dossier :

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Interface : http://localhost:5173 ; API locale : http://127.0.0.1:9320.
Le serveur écoute uniquement sur la boucle locale.

Pour utiliser le build de production :

```sh
pnpm build
pnpm server
```

Ouvrir http://127.0.0.1:9320. `pnpm preview` ne démarre pas l'API ; utiliser
`pnpm server` pour vérifier l'application complète.

## Configuration locale

Les variables sont lues dans l'environnement du processus ; aucun fichier
`.env` n'est chargé automatiquement.

| Variable | Usage | Défaut |
| --- | --- | --- |
| `ALCC_PORT` | Port Fastify | `9320` |
| `ALCC_DATA_DIR` | SQLite, télémétrie, déploiements et sauvegardes locales | `AdventureLandDashboard` dans LOCALAPPDATA, sinon le dossier utilisateur |
| `AL_CODE_DIR` | Répertoire des scripts de jeu | `../code` |
| `ALCC_CARACAL_DIR` | Installation externe optionnelle de caracAL | `../caracAL` |
| `ALCC_DISABLE_LEGACY_CREDENTIALS` | `1` désactive le repli vers la configuration MCP historique | Désactivé |
| `AL_MCP_TOKEN` | Authentification pour les actions en jeu | Configuration MCP locale historique si disponible |

L'assistant peut aussi vérifier et enregistrer une clé dans `credentials.json`
sous `ALCC_DATA_DIR`. Priorité : variable d'environnement, clé locale de
l'assistant, puis configuration MCP historique. Ne jamais publier les données
locales ou ce fichier. Les profils existants sont conservés ; seules les bases
vierges reçoivent le profil prudent et l'assistant ouvert automatiquement.

Le proxy Vite cible le port 9320. Pour un autre port, adapter le proxy ; le build
servi directement par Fastify n'en a pas besoin. Pour un essai indépendant,
définir `ALCC_DATA_DIR` vers un dossier temporaire avant de démarrer le serveur.

Les scripts du dossier `../code` restent une dépendance du backend historique.
Un clone autonome du dashboard doit fournir `AL_CODE_DIR` pour utiliser les
profils et le builder. caracAL reste une intégration optionnelle externe.

## Fonctionnement actuel

- Groupe construit depuis le profil réel ; PV/PM et skin de base lus dans
  `deployment.telemetry.stats`.
- Party Status affiche le skin monobloc exact lorsqu'il existe dans le catalogue,
  puis un portrait représentatif de la classe pour les apparences cosmétiques
  composées de plusieurs couches.
- Une télémétrie absente ou périmée affiche des valeurs inconnues. Aucune activité
  de combat n'est déduite de la classe du personnage.
- WebSocket `/live` pour les notifications ; polling des déploiements toutes les 3 s.
- Navigation à deux niveaux : quatre espaces principaux (`Team`, `Farming`,
  `Commerce`, `System`) puis les écrans liés au contexte courant. Les anciennes
  URLs hash restent stables et peuvent toujours être ajoutées aux favoris.
- Édition complète des hunts, événements, boss checks, loadouts de combat et
  règles Merchant (kit, consommables, cadeaux, vente NPC, échanges, craft chez
  Leo, upgrades, Ponty, stand et ordres d'achat).
- Les loadouts reprennent la grille d'équipement du jeu, affichent les pièces
  actuellement portées et distinguent en vert les slots explicitement remplacés.
- Les consommables utilisent des seuils minimum, cible et maximum. Les ordres
  d'achat exposent le budget, la réserve d'or et leur capacité disponible.
- L'atelier de craft importe les recettes officielles. Le marchand conserve les
  ingrédients, achète uniquement les composants disponibles chez un PNJ connu,
  respecte sa réserve d'or et fabrique une unité à la fois chez Leo.
- `Save profile` persiste le profil complet avec sa révision d'origine.
- `Deploy saved profile` est une action séparée qui peut lancer les scripts en jeu.
  Elle est désactivée pendant les modifications locales et les opérations en cours.
- Une actualisation conserve les modifications locales. Un conflit de révision
  bloque la sauvegarde ; `Discard edits` recharge la version distante.
- La console affiche l'activité persistée du serveur, dans l'ordre chronologique.
  `Clear` masque les entrées déjà reçues jusqu'au rechargement de la page.

L'absence de télémétrie signifie « non confirmé », pas nécessairement « hors ligne ».
Le badge de connexion concerne les notifications WebSocket, pas l'état des bots.
Les erreurs partielles de déploiement sont affichées même si l'API répond HTTP 200.

## Architecture

```text
src/api/          Transport JSON et annulation des lectures
src/hooks/        Queries, WebSocket et cycle de vie du brouillon
src/models/       Adaptateurs purs et transformations du profil
src/types/        Types d'affichage
src/components/   Primitives, layout et panneaux contrôlés
src/styles/       Variables SCSS et reset global
shared/           Schéma du profil partagé avec le backend
server/           Backend repris du Command Center
```

`App` compose les panneaux. Les primitives ne connaissent ni les endpoints ni
les règles métier. `useProfile` conserve la révision initiale d'un brouillon ;
les réponses serveur ne sont pas fusionnées silencieusement dans les edits.
Les assets compilés utilisent `/app-assets/`, réservé à Vite ; `/assets/` reste
réservé aux ressources du jeu.

Les scripts spécialisés peuvent déclarer `CONFIG.FIXED_FARM = true`. Le builder
conserve alors leur cible dédiée, leur mode autonome et désactive pour eux les
détours Daisy, événements rares et donjon quotidien. Le script
`droma-ranger-crab-aoe-v2` utilise ce contrat pour rester sur la plage des crabs
tout en recevant les loadouts et les règles Merchant du profil.

Le catalogue d'objets et de sprites peut être actualisé depuis les données
publiques du jeu avec `pnpm assets:refresh`. Le script conserve les métadonnées
locales, ajoute les nouveaux IDs, retélécharge les planches d'objets susceptibles
d'avoir changé, importe les skins monobloc depuis les planches de personnages et
met à jour `public/assets/sources.json`. Les
champs Item ID des loadouts acceptent aussi un ID valide absent du catalogue,
ce qui évite de bloquer un objet ajouté entre deux actualisations.

## Validation

```sh
pnpm build
pnpm lint
pnpm test:unit
pnpm test
```

`test:unit` utilise les scripts du dossier `code/` voisin. La suite complète inclut les
régressions du builder et les gardes de l'intégration caracAL ; caracAL reste optionnel.
Les tests isolent leur stockage dans `.tmp/test-data/` ou dans le répertoire temporaire
explicitement fourni. La CI monorepo utilise la suite complète, le build et le lint.
Les tests n'effectuent pas de déploiement réel. Le build TypeScript couvre le frontend et son schéma partagé ;
il ne remplace pas un futur contrôle de types strict du backend repris.

Vérification navigateur de cette tranche : chargement production, modifications,
actualisation avec brouillon, sauvegarde, conflit entre deux fenêtres, abandon
et affichage de l'activité, sur une base temporaire sans déploiement en jeu.

## Préparation GitHub

Le dépôt publiable contient `dashboard-v2/`, `code/`, `combat/`, `tests/` et les
outils/documentations de maintenance. Le workflow actif se trouve à la racine du
monorepo : `../.github/workflows/ci.yml`. Il installe les dépendances depuis ce dossier.
Voir [le README racine](../README.md) et [l'audit de publication](../docs/REPOSITORY-AUDIT.md).

Ne pas versionner les données runtime, configurations MCP, tokens ou sauvegardes
CODE. Le `.gitignore` couvre ces fichiers. Avant publication, vérifier les droits
de redistribution des ressources de jeu de `public/assets` et des scripts : aucune
licence n'est ajoutée sans décision du propriétaire.

Voir [la feuille de route](docs/ROADMAP.md) pour la suite de la refonte et
[les conventions](CONTRIBUTING.md) avant une contribution.

## Documentation

| Document | Contenu |
| --- | --- |
| [docs/ROADMAP.md](docs/ROADMAP.md) | État du projet et prochaines étapes |
| [docs/REVIEW-2026-09-23.md](docs/REVIEW-2026-09-23.md) | Audit technique, état runtime et priorités proposées |
| [docs/THEMING.md](docs/THEMING.md) | Thème rétro CRT : tokens SCSS, couches globales, recettes de composants (en anglais) |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Conventions de code et process de contribution |
| [src/components/layout/README.md](src/components/layout/README.md) | Shell, grille et composants de mise en page |

Nouveau sur le projet ? Lire dans l'ordre : `README` (démarrage) →
`docs/THEMING.md` (comment est construit l'aspect rétro) → `CONTRIBUTING.md`
(avant de coder).

## Navigation

- `#party` : état du groupe, portraits, contrôles et sauvegarde/déploiement.
- `#inventory` : inventaires et équipements live dans une grille proche du jeu.
- `#combat` : métriques de session, couverture du healer et diagnostics d'échec.
- `#operations` : mission Ready/Engage, état du chef d'équipe, traces du watchdog
  de déplacement, journal bancaire, historique commercial et validation croisée
  de la configuration.
- `#simulator` : projection des kills, XP, or direct et butins par heure. La
  composition utilise le DPS de télémétrie, modifiable pour comparer des scénarios ;
  efficacité, spawns, luck, multiplicateur d'or et bonus home-server sont réglables.
  Tous les monstres sont classés par Gold/h et une alerte de survie confronte leur
  DPS aux PV, défenses et soins live de la composition sélectionnée.
- `#farming` : cibles, hunts, boss checks et loadouts AOE/Mono/Tank.
  Chaque boss récurrent choisit indépendamment l'un de ces trois builds.
- `#events` : participation, whitelist et style de combat par événement.
- `#bank` : dernier snapshot bancaire par personnage, recherche par identifiant,
  nom ou pack et filtre par catégorie. Un snapshot reste visible hors ligne.
- `#merchant` : logistique, transformation, commerce et stand du marchand v2.
  Les prix du stand, les prix/levels/quantités des wishlist et les targets
  d'upgrade sont modifiables directement dans leurs cartes. Chaque carte est
  repliable et conserve son état dans le navigateur.
  Le panneau Team supervisor choisit les farmers que le marchand peut redémarrer.
  Décocher le dernier personnage désactive le démarrage automatique. Solo guard,
  disponible avec une cible unique, signale les autres farmers en ligne et
  l'absence du buff Lone Wolf sur le ranger. Ces alertes utilisent la télémétrie
  fraîche ; les anciens bundles sans snapshot des buffs restent indéterminés.
- `#activity` : recherche sur les 100 dernières entrées serveur, filtres par niveau
  et source. Les filtres combinent leurs contraintes et se réinitialisent en quittant la page.
- `#scripts` : catalogue réel, recherche par fichier/libellé/type, filtre de classe,
  affectations sauvegardées et inspection des CONFIG/variables importées.

Le brouillon du profil reste en mémoire pendant la navigation et un indicateur
`Unsaved` apparaît sur Party. Les pages Activity et Scripts sont en lecture seule ;
elles ne changent ni les affectations ni les scripts et ne déclenchent pas de build.

La banque ne constitue pas une vue temps réel permanente : Adventure Land expose
les packs lorsqu'un personnage ouvre la banque. La télémétrie conserve la dernière
capture et son horodatage. Pour la rafraîchir, ouvrir la banque avec un personnage
reconstruit et attendre le pulse de télémétrie suivant.

L'historique des performances affiche `Loot Gold/h` depuis les événements de loot
du personnage, indépendamment des transferts, dépôts et achats. La durée couverte
par ce compteur est affichée séparément ; les anciennes données ne servent pas
à extrapoler ce taux. `Balance gains/h` conserve l'ancienne estimation par hausses
du solde, qui peut inclure des transferts reçus. Le compteur de loot commence après
le déploiement d'un bundle contenant cette instrumentation.
Les mesures nouvelles conservent aussi le terrain et le serveur de jeu, filtrables
dans l'historique. Les intervalles traversant un changement sont classés
`transition` pour la dimension concernée ; les données historiques sans localisation
restent accessibles sous `Unknown (legacy)`.
Le bouton `Export filtered CSV` exporte uniquement les mesures correspondant aux
filtres et à la période affichés. Les dates sont en UTC et les valeurs de loot
historiques inconnues restent vides. L'export contient les compteurs bruts, leurs
durées d'observation et le taux de loot par heure pour chaque mesure.
Une interruption de télémétrie d'au moins 20 secondes réinitialise la référence
des compteurs : les gains de cet intervalle ne sont pas extrapolés. Le taux de
déplacement représente la part du temps total observé passée en mouvement.

### Pilotage de l'équipe et diagnostic

- Party propose Solo, équipe complète (warrior/priest/ranger) et Cave Dreams.
  Ces modes préparent un brouillon : sauvegarder puis prévisualiser pour appliquer.
  Les compositions nommées sont conservées dans ce navigateur et restaurent les
  règles d'équipe, sans écraser les équipements ni les règles commerciales.
  Arrêter depuis le roster les personnages exclus qui sont déjà en ligne.
- Deployment preview reconstruit le profil sauvegardé et compare les paramètres
  injectés aux slots CODE sauvegardés en jeu. Elle n'exécute jamais le code lu,
  ne téléverse rien et ne redémarre rien. Les sources et les paramètres sont
  signalés séparément ; chaque personnage peut ensuite être déployé individuellement.
- Party présente les six signaux opérationnels prioritaires avec des liens vers
  les écrans de diagnostic. La carte conserve jusqu'à dix minutes de positions
  par session ; les lignes s'interrompent aux changements de terrain, de serveur
  et aux coupures de télémétrie.
- Inventory expose les réservations de chaque build et les pièces récupérables
  en banque ou chez un autre personnage. Les informations bancaires sont des snapshots.
- Loot Lab compare le loot réel au gold direct simulé, à cible et composition de
  groupe identiques, après cinq minutes de couverture par personnage. Il propose
  une efficacité calculée à partir du débit de kills. Les anciens relevés sans
  contexte sont exclus. Les buffs, bonus de serveur et jackpots peuvent encore
  produire des écarts ; l'attribution de cible est échantillonnée.

## Profils d’activité et objectifs

Le diagnostic direct se trouve dans Combat. Farming contient les profils
d’activité, les objectifs de loot et la gestion des dangers. Commerce contient
les objectifs de production avec quantité et budget. Les anciens profils
reçoivent des valeurs par défaut : aucun objectif et sécurité désactivée.
Enregistrer puis déployer les scripts v2 pour appliquer ces règles.

Voir [le guide des activités et politiques runtime](docs/activity-automation.md)
pour les compteurs persistants, le partage de progression entre personnages,
les holds de sécurité, la reprise des transactions et les limites des estimations.

Le [mode duo pour les events](docs/EVENT-EXPEDITIONS.md) garde le ranger en farming et laisse le marchand lancer puis rappeler warrior/priest sur le serveur home.

- [Equipment protections, margin calculator, stand position and global search](docs/MERCHANT-INSPECTION.md)

- [Production contracts and temporary characters](docs/PRODUCTION-CONTRACTS.md)

Merchant queue priorities and bank-backed craft batches: [operator guide](docs/MERCHANT-BATCHES.md).

Decision explanations, incident evidence, circuit breakers and expedition/profit coverage: [Decision & evidence](docs/DECISION-EVIDENCE.md).
