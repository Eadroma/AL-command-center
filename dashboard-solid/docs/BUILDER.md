# Builder : génération des bundles CODE

Le builder transforme un script de `code/` en bundle prêt à déployer pour un personnage, à partir du profil.
C'est une réécriture typée du builder de dashboard-v2, **identique octet pour octet** sur les profils de référence.
Construire n'écrit rien et ne lance rien : le déploiement est une étape séparée et explicite.

## Étapes (`server/builder/`)

| Fichier | Rôle |
| --- | --- |
| `catalogue.ts` | Liste les scripts de `code/` et lit leur `CONFIG` dans l'AST (acorn), sans exécuter de code. Empreinte = script + modules partagés embarqués. |
| `validate.ts` | Refuse un profil inutilisable : script absent ou incompatible, réglage inconnu, géré ou mal formé, automatisations et règles marchand incohérentes. |
| `facts.ts` | Faits du jeu pour la validation (objets améliorables, combinables, recettes), lus dans `G`. |
| `effective-config.ts` | La `CONFIG` du personnage : celle du script, ses réglages propres, puis les valeurs gérées par le profil. |
| `adapt-source.ts` | Remplace les variables gérées, réécrit les fonctions pilotées par le profil, ajoute `__ALCC` (`metadata.ts`) et les modules partagés. |
| `merchant-policy.ts`, `warnings.ts` | Conflits des règles marchand (erreurs bloquantes, avertissements) et avertissements livrés avec le bundle. |
| `bundle.ts` | Assemble, compile en ES2017 (esbuild, mêmes version et options que v2) et ajoute la télémétrie. |
| `runtime/*.js` | Fragments de code de jeu insérés tels quels (corps de fonctions, gabarit de télémétrie). Pas des modules : exclus du lint. |

Les sections du profil (`seller`, `farming`, `events`, `automation`) sont lues sur place et recopiées telles qu'elles
sont stockées : mêmes valeurs, même ordre des clés. Les sections que ce dashboard n'édite pas encore restent donc intactes.

## Références (« golden tests »)

`test/builder.test.ts` compare chaque étape à la sortie du vrai builder v2 sur 11 variantes du profil, noms anonymisés
(`test/fixtures/builder/`) : catalogue, `CONFIG` (66 personnages), code généré, avertissements, validation, bundle
compilé et télémétrie. Les tests lisent `../code`, comme ceux de v2.

Quand `code/` change, régénérer les références (dashboard v2 lancé, lecture seule) :

```sh
pnpm --dir dashboard-v2 exec tsx ../dashboard-solid/tools/golden-v2.mts
```

Le script régénère aussi `runtime/telemetry.js` à partir du gabarit v2.

## Différences voulues avec v2

- **Adresse de télémétrie configurable** : `http://127.0.0.1:<port>/api/telemetry` en local, `publicUrl` en mode hébergé
  (`telemetryEndpoint`). v2 l'écrivait en dur.
- **Prêtre de la télémétrie** : celui du profil, au lieu de `Aedroma` écrit en dur ; nom écrit avec `JSON.stringify`.
- **Sections manquantes** : un profil sans `seller`, `farming`, `events` ou `automation` est refusé avec un message clair
  (un profil prudent n'en a pas encore). v2 les complétait avec ses valeurs par défaut.
- **Faits du jeu** lus dans `G` plutôt que dans `catalog.json` : un objet caché du jeu sans image est accepté comme
  améliorable (v2 l'ignorait).

## À savoir

- Le script `droma-ranger-crab-aoe-v2.js` déclare `PARTY_GUESTS: ["EadroSell"]` dans sa propre `CONFIG` : ce nom n'est pas
  remplacé par le marchand du profil (comportement v2 conservé, à corriger dans le script).
- Les messages de validation et les avertissements sont en anglais, comme en v2 ; l'aperçu de déploiement les traduira.

## Déploiement (`server/deploy/`)

Déployer un personnage : construire le profil **enregistré** (la révision demandée doit être la révision courante),
ajouter la télémétrie avec un ticket neuf, puis écrire le bundle dans son emplacement CODE `CC_<nom>`, comme la v2 :

1. le personnage doit être connecté (sauf « préparer seulement ») ;
2. l'emplacement `CC_<nom>` est réutilisé, sinon le plus grand numéro libre (100 → 1) est pris ; deux emplacements du
   même nom bloquent tout ;
3. le contenu actuel de l'emplacement est sauvegardé dans `code-backups/` (dossier de données) avant d'être remplacé ;
4. le code envoyé est relu et comparé : s'il diffère, rien n'est démarré ;
5. un rechargement est demandé. Le jeu met la demande en file : c'est la télémétrie qui confirme.

Déployer l'équipe enchaîne les personnages actifs, le marchand en dernier (il démarre les emplacements des autres), et
renvoie la liste des échecs sans s'arrêter au premier. Démarrer réutilise l'emplacement `CC_<nom>` existant.

**Verrou** : tant que `deploy.enabled` vaut `false` dans `settings.json`, toute action qui touche le jeu est refusée
(403 `deploy.disabled`) avant le moindre appel. Une seule opération à la fois (409 `deploy.busy`).

**Tests** : `test/deploy.test.ts` joue contre un faux jeu en mémoire (`test/helpers/fake-game.ts`) qui répond avec
les formes relevées sur l'API réelle (lecture seule, 27/10). Aucun test ne peut atteindre le vrai compte : le service ne
parle qu'au client qu'on lui donne.

## Aperçu, historique et retour arrière

- **Aperçu** (`POST /api/deploy/preview`, révision enregistrée) : construit chaque personnage actif **sans ticket de
  télémétrie**, lit son emplacement `CC_<nom>` (appels en lecture seule) et compare les variables gérées (`CONFIG`,
  `__ALCC`, `BOARD_CTL`, `HUNT_ALLOW`, `BOSS_CHECKS`). Autorisé même quand le déploiement est verrouillé : il n'écrit
  rien. Lit les variables dans l'AST, ce qui marche aussi sur le code compilé par esbuild (clés sans guillemets), là où
  la v2 utilisait `JSON.parse` et ne pouvait pas comparer. Vérifié le 27/10 sur les quatre personnages déployés par la
  v2 : aucun réglage ne change, même version de script.
- **Historique** (`GET /api/deploy/history`) : les copies de `code-backups/`, 100 au plus, les plus récentes d'abord.
- **Retour arrière** (`POST /api/deploy/rollback`, verrouillé comme le déploiement) : retire le rapporteur de télémétrie
  de la copie (seulement s'il est bien le nôtre : personnage, ticket de 64 caractères, adresse `…/api/telemetry`),
  ajoute un ticket neuf, garde une copie du code actuel, puis envoi, relecture comparée et rechargement.

## Profil prudent

Il porte les sections du builder du profil prudent de la v2 (`server/profile/cautious-sections.json`, tout désactivé,
extrait par `tools/golden-v2.mts`) et, pour chaque personnage, le script habituel de sa classe (version v2, script
général plutôt que crabe ou crypte). Il passe la validation du builder et peut donc être prévisualisé.

## Messages

Le builder garde les messages anglais de la v2 (comparés octet pour octet). L'interface les reconnaît par motif et les
affiche en français ou en anglais (`src/deploy/builder-messages.ts`) ; un message inconnu est affiché tel quel.
`test/builder-messages.test.ts` vérifie que tous ceux des références sont traduits.
