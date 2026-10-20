# Premier farming — du clone au premier bot

Ce guide concerne le runtime **Browser CODE**. Le dashboard et le navigateur du jeu doivent fonctionner sur le même ordinateur : les scripts envoient leur télémétrie à une API locale. Un site statique distant ne remplace pas ce service.

## 1. Installer

Conserver `dashboard-v2/` et `code/` comme dossiers voisins. Installer Node.js 24 et pnpm 12.4.1, puis ouvrir un terminal dans `dashboard-v2` :

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Ouvrir <http://localhost:5173/#party>. Au premier démarrage, l'assistant s'ouvre avec un profil prudent : tous les personnages sont désactivés. Les noms `Example_*` sont des exemples, pas des personnages à déployer.

Pour une application compilée : `pnpm build`, puis `pnpm server`, et ouvrir <http://127.0.0.1:9320>. Ne pas utiliser `pnpm preview` seul : il ne fournit pas l'API.

## 2. Connecter le compte

Se connecter à Adventure Land, puis ouvrir <https://adventure.land/mainframe>. Dans **Connect an AI**, utiliser le token MCP existant avec **Reveal token**, ou **Create token** s'il n'en existe pas. Une rotation invalide l'ancien token ; il n'est pas nécessaire d'en créer un nouveau pour chaque outil.

Dans Party → **First farming setup**, coller le token et choisir **Connect and discover characters**. Ne jamais saisir le mot de passe du jeu. La vérification liste uniquement les personnages ; elle ne les démarre pas et n'active pas Mainframe.

Le serveur enregistre une clé vérifiée dans `credentials.json`, sous `ALCC_DATA_DIR` (par défaut `AdventureLandDashboard` dans LOCALAPPDATA sous Windows). Ce fichier est privé, n'appartient pas au profil et ne doit pas être publié. Sous Windows, les permissions sont celles du dossier utilisateur. Une autre possibilité est `AL_MCP_TOKEN` dans l'environnement du serveur ; cette variable est prioritaire et l'assistant ne la remplace pas. Le `.env` n'est pas chargé automatiquement. Si une connexion existe déjà, laisser le champ vide pour la tester.

Une clé rejetée ou un problème réseau conserve la configuration de connexion précédente. Une connexion réussie n'est pas une confirmation que vos personnages sont ouverts dans le navigateur.

## 3. Choisir personnages, serveur et scripts

Sélectionner la région et le serveur **home**. Ouvrir manuellement les personnages choisis sur ce même serveur dans Adventure Land : ce réglage ne les déplace pas et ne les connecte pas automatiquement.

Sélectionner seulement les personnages à déployer ; leur rôle correspond à leur classe réelle. Choisir le script v2 général de la classe et définir un leader, par exemple le guerrier, suivi par le prêtre et l'archer. Éviter les chaînes de suivi circulaires. Un solo peut rester **Independent / leader**.

Choisir une cible adaptée aux niveaux et à l'équipement. `goo` est proposé pour un premier essai, sans garantie de survie. Le script spécialisé **Ranger Crab AOE** garde sa cible crabe et sa route dédiée, même si une autre cible globale est choisie.

## 4. Préparer puis sauvegarder

Dans **Review**, vérifier personnages et serveur, puis choisir **Stage cautious profile**. Cela remplace le profil dans l'éditeur, sans écrire dans le jeu. Si vous avez déjà des modifications, sauvegardez-les ou abandonnez-les avant de préparer ce nouveau profil.

Le profil prudent désactive achats wishlist, ventes NPC, stand, upgrades, craft, Ponty, échanges, dépôts bancaires, livraisons et démarrage automatique. Hunts, événements, boss et Cave Dreams sont également désactivés. Les potions et mécanismes de sécurité propres aux scripts restent actifs : ce profil ne garantit ni absence de dépense ni absence de danger.

Choisir ensuite **Save profile**. Sans cette sauvegarde, le déploiement reste indisponible. Le fichier `examples/starter-profile.json` documente le profil initial ; l'assistant crée le profil avec les noms réels de votre compte. Il ne réinitialise jamais un profil existant automatiquement.

## 5. Prévisualiser

Dans Party → **Deployment preview**, demander **Preview saved deployment**. Vérifier les personnages, scripts et différences de CODE. La prévisualisation ne démarre rien. Garder les fichiers `code/` et le backend à la même version ; les modules communs sont injectés par le builder, les scripts v2 ne se limitent pas au fichier copié manuellement.

## 6. Déployer et vérifier

Ouvrir les personnages dans le jeu, puis demander explicitement le déploiement. Le dashboard choisit des slots `CC_<nom>`, sauvegarde le contenu qu'il remplace et vérifie l'upload avant de demander le reload.

Attendre **live telemetry** dans Party et regarder l'activité dans Runtime Inspector. Un upload réussi n'est pas une preuve que le nouveau script tourne. Si le personnage reste immobile ou renvoie une erreur, consulter sa console CODE et utiliser **Stop** avant de modifier les réglages.

Activer ensuite les fonctionnalités une par une, avec des listes et budgets explicites. Toujours : modifier → sauvegarder → prévisualiser → déployer.

## Problèmes fréquents

- **Local service unavailable** : démarrer l'API avec `pnpm dev` ou `pnpm server` ; vérifier les ports et la version Node.
- **Configure AL_MCP_TOKEN** : connecter le compte dans l'assistant ou configurer l'environnement du serveur.
- **No supported characters found** : vérifier que le token appartient au bon compte ; seules les classes actuellement prises en charge sont listées.
- **Open character first** : ouvrir ce personnage dans Adventure Land avant son déploiement.
- **No live telemetry** : vérifier que le CODE tourne et que l'API locale est accessible depuis le navigateur du jeu ; consulter la console du personnage.
- **Conflit de profil** : ne pas écraser silencieusement une autre sauvegarde ; recharger le profil puis refaire les changements.
