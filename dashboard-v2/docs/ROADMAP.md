# Feuille de route

Le plan fourni reste la référence fonctionnelle. Cette liste décrit l'état réel
au 23 septembre 2026. L'audit détaillé et les propositions suivantes sont dans
[`REVIEW-2026-09-23.md`](REVIEW-2026-09-23.md).

## Tranche livrée : connecter le socle existant

- [x] Remplacer les mocks du shell par bootstrap, polling et notifications live.
- [x] Corriger la lecture de la télémétrie imbriquée et les valeurs absentes.
- [x] Éditer les trois contrôles supportés sans écraser les autres réglages.
- [x] Sauvegarder avec révision et préserver les brouillons lors des refreshs.
- [x] Séparer sauvegarde et déploiement ; afficher les erreurs partielles.
- [x] Afficher l'activité persistée et permettre un masquage local.
- [x] Documenter démarrage, architecture, limites et validation.
- [x] Préparer une CI autonome pour un dépôt dédié.

## Prochaines itérations

- [x] Compléter les primitives (NumberInput, Tooltip).
- [x] Porter la page Party complète.
- [x] Porter la page Combat (métriques de session et analyse des échecs).
- [x] Porter Events avec whitelist, participation et styles de combat.
- [x] Porter Farming, ses loadouts et toutes les règles Merchant.
- [ ] Étendre ensuite les fonctionnalités : Dragold, compound, scroll budget,
      exclusions d'upgrade, mluck et seuils de potions individuels.
- [ ] Extraire les types API restants hors des hooks et renforcer leur validation runtime.
- [ ] Tester automatiquement le cycle de vie des hooks et les reconnexions WebSocket.
- [ ] Rendre les tests du builder autonomes grâce à des fixtures de scripts dédiées.
- [ ] Auditer et typer strictement le backend hérité, qui conserve des `any`.
- [ ] Définir le périmètre et la licence du dépôt, puis créer le remote GitHub.

La référence `../dashboard-config-reference.md`, `../command-center` et les scripts
`../code` ne sont pas modifiés par cette tranche. L'auto-respawn global a été retiré
de la maquette : aucun champ correspondant n'existe dans le schéma actuel.

## Tranche suivante : pages Activity et Scripts

- [x] Navigation par liens hash, compatible avec retour/précédent et liens directs.
- [x] Conserver le brouillon du profil pendant la navigation, avec indicateur Unsaved.
- [x] Regrouper les pages en quatre espaces principaux et centraliser la définition
      typée des routes et sous-onglets.
- [x] Page Activity : recherche, filtres de sévérité/source et remise à zéro.
- [x] Page Scripts : recherche, filtre de classe, métadonnées, affectations sauvegardées.
- [x] Inspection en lecture seule des CONFIG et variables importées.
- [x] Primitives Field, TextInput, SelectInput et EmptyState.

Le catalogue provient de `/api/bootstrap` : il n'existe pas d'endpoint `/api/scripts`
dans ce backend. Les pages n'ajoutent donc pas de requêtes ou de contrats fictifs.
Les CONFIG affichées sont les valeurs importées, pas les valeurs finales après overrides.

Validation des pages : recherche de scripts, inspection CONFIG, état vide,
recherche et cumul des filtres d'activité, reset, masquage conservé au refresh,
navigation aller/retour avec brouillon intact. Vérifications effectuées sur une
base temporaire, sans appel de déploiement réel.

## Tranche Bank viewer

- [x] Extraire les contrats de déploiement et télémétrie hors du hook React.
- [x] Conserver les snapshots vides et hors ligne comme données valides.
- [x] Choisir le personnage ayant capturé la banque.
- [x] Rechercher par identifiant, nom de catalogue ou pack et filtrer par catégorie.
- [x] Grouper les résultats, afficher quantités, niveaux et emplacements exacts.
- [x] Afficher la date de capture et distinguer reporter live / snapshot stocké.
- [x] Ajouter la primitive Sprite avec fallback accessible.
- [x] Localiser globalement un objet dans les sacs, équipements, ventes du stand
      et dernier snapshot de banque, avec les réservations de configuration.

La page est en lecture seule. Elle n'effectue aucune opération de banque et ne
force aucun déplacement en jeu. Une capture est mise à jour uniquement quand la
télémétrie d'un personnage reconstruit peut lire `character.bank`.

## Tranche Combat telemetry

- [x] Typer les métriques combat, réseau et échecs déjà produites par le backend.
- [x] Calculer DPS, dégâts subis, mouvement et couverture du healer hors de React.
- [x] Distinguer les sessions live des dernières valeurs devenues obsolètes.
- [x] Consolider et trier les diagnostics de mort de toute la flotte.
- [x] Ajouter une navigation directe et des états vide/chargement explicites.
- [x] Comparer chaque override de loadout à l'équipement et au sac live, avec
      diagnostic du mauvais slot, niveau insuffisant ou pièce manquante.

Les compteurs sont cumulatifs depuis le dernier démarrage de CODE du personnage.
La page reste entièrement en lecture seule et n'envoie aucune commande au jeu.

## Tranche Loot simulator

- [x] Importer PV, XP, attaque, respawn, or de base et tables de drop officielles.
- [x] Composer une équipe depuis les personnages non marchands et leur DPS mesuré.
- [x] Estimer kills, XP, or direct, valeur NPC et unités de chaque drop par heure.
- [x] Exposer efficacité, spawns, luck, multiplicateur d'or et drops home-server.

La simulation est locale et ne commande aucun personnage. Les drops globaux, de
carte et d'événement ainsi que les valeurs de marché restent hors du modèle.

## Tranche Party complète

- [x] Extraire la composition Party hors de `App.tsx`.
- [x] Conserver les contrôles de profil et les actions de déploiement existantes.
- [x] Afficher runtime, niveau, carte, cible et étape de déploiement sans inventer
      de données lorsque la télémétrie est absente ou obsolète.

## Tranche Events & bosses

- [x] Éditer l'interrupteur global et la participation de chaque personnage.
- [x] Autoriser individuellement les 17 événements et boss pris en charge.
- [x] Configurer un style `aoe`, `mono` ou `tank` pour chaque entrée autorisée.
- [x] Préserver les styles désactivés et initialiser les nouveaux choix sans doublon.
- [x] Sauvegarder, annuler et déployer avec le brouillon révisionné partagé.

La page modifie uniquement le profil. Aucun événement, déplacement ou déploiement
n'est déclenché tant que l'utilisateur n'utilise pas explicitement les actions prévues.

## Tranche Farming & hunts

- [x] Configurer la cible par défaut et son style de combat.
- [x] Configurer les cibles indépendantes par personnage.
- [x] Gérer Daisy, les visites rares et le donjon journalier.
- [x] Rechercher et éditer la whitelist de hunts et leurs styles.
- [x] Configurer les huit rondes de boss et leur fréquence.
- [x] Éditer les équipements et compétences AOE/Mono/Tank par personnage.
- [x] Sauvegarder, annuler et déployer via le brouillon révisionné partagé.

Les valeurs par défaut des nouveaux monstres suivent `WEAPONS.pack` du script
warrior importé (`fireblade` donne `mono`, les autres packs donnent `aoe`). Les
styles désactivés et les loadouts non sélectionnés sont préservés. La prochaine
partie de cette itération porte sur les règles Merchant.

### Validation runtime des scripts v2

- [x] Injecter et appliquer les équipements `minLevel` des trois loadouts.
- [x] Protéger les pièces de loadout et de kit contre le dump d'inventaire.
- [x] Filtrer toutes les compétences proposées selon le style actif.
- [x] Relier Daisy, les visites Phoenix et le donjon quotidien aux v2.
- [x] Compiler les bundles warrior, priest et ranger avec des boards distincts.
- [x] Faire répondre les farmers v2 aux pings de stock et livrer les potions hors écran.
- [x] Prioriser le mana pour l'achat, la livraison et la consommation du guerrier.
- [x] Abandonner réellement une hunt après trois morts : compteur persistant
      plafonné, attente du prêtre dès le premier wipe et exclusion complète de
      la cible abandonnée des attaques, déplacements et compétences AOE.
- [x] Injecter les boards Seller kit, consommables et cadeaux dans le marchand v2.
- [x] Actualiser le catalogue en version jeu 17139 et accepter les nouveaux IDs valides.

Le module partagé choisit la meilleure pièce disponible respectant `minLevel` et
la contrainte shiny du kit. Les compétences avancées absentes des rotations v2
initiales (Agitate, Dark Blessing, Absorb, Revive et Poison Arrow) ne s'activent
que lorsqu'elles sont explicitement sélectionnées dans le loadout. Le marchand
n'utilise pas de loadout de combat ; il reste piloté par les règles Seller.

## Tranche Merchant logistics

- [x] Ajouter une page Merchant liée au même brouillon révisionné.

## Ordre de livraison opérationnel

1. [x] Le marchand démarre les farmers absents dans leurs slots `CC_*`.
2. [x] Runtime Inspector : intention, durée, carte, cible, destination et blocage.
3. [x] Movement Watchdog et récupération contrôlée des trajets bloqués.
4. [x] Centre d'incidents avec regroupement et résolution.
   - [x] Alertes métier pour stocks, capacité des sacs, prêtre indisponible,
         stand fermé et dérive entre source et build déployé.
5. [x] Panneau Cave Dreams et commande de sortie groupée.
6. [x] Planificateur des tâches du marchand.
7. [x] Historique des performances réelles.
8. [x] Déploiement avec comparaison et rollback.
- [x] Éditer les livraisons de kit par personnage et slot.
- [x] Éditer les stocks récurrents, leur source et le mode elixir.
- [x] Éditer les cadeaux permanents par item, niveau et quantité.
- [x] Prévisualiser les sprites et accepter les nouveaux IDs valides.
- [x] Sauvegarder, annuler et déployer avec les contrôles partagés.

- [x] Éditer la vente NPC et les échanges.
- [x] Éditer les objectifs d'upgrade et le budget minimum.
- [x] Éditer la wishlist Ponty.
- [x] Éditer les annonces du stand et les ordres d'achat.
- [x] Injecter ces règles dans le marchand v2 et les protéger des ventes concurrentes.
- [x] Gérer les consommables avec seuil minimum, cible de remplissage et plafond.
- [x] Expliquer les ordres d'achat bloqués par le budget ou la réserve d'or.
- [x] Afficher les loadouts dans une grille d'équipement, avec l'équipement live
      dans les slots non remplacés et une bordure verte sur les overrides.
- [x] Normaliser les anciens IDs d'items, dont `ololipop0` vers `ololipop`.

## Tranche Party portraits

- [x] Ajouter le skin de base au contrat de télémétrie sans casser les anciens paquets.
- [x] Importer localement les apparences monobloc officielles du jeu.
- [x] Afficher le skin exact disponible avec un repli stable par classe.
- [x] Éviter les aperçus partiels pour les apparences cosmétiques multicouches.
