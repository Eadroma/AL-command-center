# Contribuer

Lire aussi [les conventions du dashboard](dashboard-v2/CONTRIBUTING.md).

1. Installer les dépendances dans `dashboard-v2/` avec le lockfile.
2. Conserver la séparation UI, modèles, API et scripts de jeu.
3. Préférer des modifications ciblées ; ne pas reformater tous les scripts historiques dans une correction fonctionnelle.
4. Vérifier build, lint, tests et audit public avant un commit.
5. Ne jamais déployer de CODE ou utiliser un compte réel depuis la CI.

Les fichiers locaux ignorés ne doivent pas être ajoutés avec `git add -f`. Une modification de dépendances doit inclure le lockfile et une nouvelle analyse des alertes.

Le dossier de données utilisé par les tests est temporaire et distinct du profil de jeu. Pour des essais manuels, définir explicitement `ALCC_DATA_DIR` vers un répertoire temporaire.

Pour les contributions provenant d'autres projets, conserver leur provenance et vérifier leur licence avant de les intégrer. Ne pas ajouter de captures d'écran de compte sans revue.
