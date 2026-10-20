# Audit de préparation GitHub public

Date : 20 octobre 2026. Périmètre : dashboard maintenu, scripts de personnages, interfaces en jeu, modules partagés et outillage. Aucun push ni création de dépôt distant n'est effectué par cet audit.

## Verdict

**La publication est techniquement préparée, mais la mise en public doit attendre la clarification des licences des reprises tierces et le choix de licence du projet.** Le candidat local n'est pas une autorisation de redistribution.

Le dossier de travail initial n'était pas un dépôt Git. Il contenait un dépôt imbriqué pour le code du jeu, trois générations de dashboard, caracAL, des projets sans rapport, des sauvegardes et des diagnostics. Il ne faut pas publier cet ensemble avec un `git add .` non contrôlé.

## Périmètre conservé

- `dashboard-v2/` : UI React, backend Fastify, schémas, tests, documentation et assets utilisés.
- `code/` : scripts de personnages et interfaces intégrées ; variantes historiques conservées pour compatibilité et tests.
- `combat/`, `tests/`, `tools/` et `docs/` : modules et maintenance du projet.
- Métadonnées racine et workflow CI monorepo.

Le code complet du jeu (~188 Mio), caracAL (~16 Mio), les anciennes générations d'interface et le site de candidatures ne sont pas exportés. Ces mesures excluent les `node_modules` et les historiques Git.

L'export est construit par `tools/prepare-public.mjs` à partir d'une liste explicite dans `tools/repository-files.mjs`. Son manifeste liste les fichiers, tailles et SHA-256. Les captures de comptes et les screenshots historiques ne sont pas inclus par défaut.

## Nettoyage effectué

- 91 fichiers de diagnostic et scripts ponctuels déplacés dans une archive locale ignorée, avec manifeste de restauration. Pas de suppression définitive.
- Exclusions des credentials, données runtime, sauvegardes CODE, builds, caches, dépendances et projets extérieurs.
- README racine, guide des scripts/interfaces, contribution, sécurité et notices tierces ajoutés.
- CI déplacée au niveau du monorepo avec permissions de lecture, installation figée et contrôles sans déploiement de jeu.
- Suppression de la dépendance du test de combat à l'ancien `command-center/node_modules`.
- Installation caracAL rendue configurable via `ALCC_CARACAL_DIR`, sans embarquer le client externe.
- Outil de sauvegarde CODE compatible avec `AL_MCP_TOKEN`, erreurs sans corps de réponse brut et délai réseau borné.
- Données de tests isolées du profil réel ; concurrence limitée pour stabiliser les compilations de bundles.
- Contexte de test des achats NPC complété avec l'état de pause d'échange attendu.

## Sécurité et dépendances

Le premier audit de dépendances signalait :

| Dépendance | Alerte initiale | Correction figée |
| --- | --- | --- |
| `source-map-js` | Élevée, [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) | `1.2.2` |
| `shell-quote` | Critique, [GHSA-pqg4-j6r4-53mv](https://github.com/advisories/GHSA-pqg4-j6r4-53mv) | `1.11.0` |

Le lockfile est actualisé avec des overrides ciblés. Le nouvel audit pnpm retourne zéro alerte connue dans toutes les catégories à la date du contrôle. Cela ne garantit pas l'absence de vulnérabilités inconnues ou futures.

Le scan du périmètre candidat ne détecte aucun secret correspondant à ses motifs. Il affiche uniquement des chemins et numéros de ligne, jamais les valeurs détectées. Il ne couvre pas une reconnaissance universelle des secrets ni un historique Git existant. Les configurations de compte et les données de jeu restent hors périmètre ; leurs contenus ne sont pas reproduits dans ce rapport.

## Validations

Contrôles à conserver pour chaque publication :

```sh
pnpm --dir dashboard-v2 install --frozen-lockfile
pnpm lint
pnpm build
pnpm test
pnpm test:combat
pnpm test:smoke
pnpm audit:public
pnpm --dir dashboard-v2 audit --audit-level high
```

La suite complète locale passe : **544/544 tests**. Les tests de combat et du périmètre de publication passent : **30/30**. Le lint est sans erreur. La vérification a aussi été répétée dans une copie propre sans anciens projets ni credentials : installation avec lockfile figé, build, lint, 544 tests applicatifs et 30 tests de scripts réussis. Le smoke test additionnel exerce `/`, `/api/health` et `/api/bootstrap` en mémoire, sans port ouvert ni action de jeu.

## Points à régler avant le premier push public

1. **P1 — Licences des reprises** : `code/gui.js` indique une reprise du HUD Crowns3bc. Aucune licence racine explicite n'a été identifiée dans le dépôt consulté. Clarifier l'autorisation ou remplacer les reprises avant publication. Examiner aussi les références de `merchant-party-gui.js` et les autres fragments crédités. Détails dans [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).
2. **P1 — Licence du projet** : choisir une licence pour les contributions originales, sans prétendre couvrir les assets et reprises tierces. Aucune licence globale n'est ajoutée automatiquement.
3. **P2 — Dernière revue du manifeste** : vérifier les fichiers retenus, les en-têtes et les règles de licence ; activer la protection contre les secrets sur GitHub lors de la création du dépôt.

## Limites et améliorations suivantes

- L'application reste un outil local, pas un service multi-utilisateur avec authentification. Un hébergement public du dashboard est un projet distinct de la publication de ses sources.
- Le contrôle TypeScript principal couvre le frontend et ses schémas. Le backend historique utilise encore des `any` et mérite une migration stricte séparée ; cet audit n'en fait pas une réécriture globale.
- Des scripts v1/v2 et du code embarqué sont volontairement conservés : supprimer les variantes sans plan de migration casserait les tests et certains usages. Leur consolidation est un chantier ultérieur.
- Les actions GitHub sont référencées par version majeure. Un durcissement ultérieur peut figer leurs SHA avec un mécanisme de mise à jour.
- L'import de nouvelles ressources dépend des sources publiques du jeu ; l'intégration headless nécessite une installation externe de caracAL. Le fonctionnement navigateur du dashboard ne dépend pas des projets exclus.

## Procédure conseillée

Après résolution des points P1, recréer un export local dans un nouveau dossier `.release/`, vérifier le manifeste et les contrôles, puis créer un dépôt GitHub public et pousser uniquement ce candidat. Ne pas copier le répertoire `.git` du jeu ni transformer l'ensemble du dossier personnel de travail en historique public.
