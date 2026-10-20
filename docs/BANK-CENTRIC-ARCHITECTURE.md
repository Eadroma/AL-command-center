# Banque centrale — proposition d’architecture

Statut : proposition, pas encore implémentée. Préparée le 7 octobre 2026.

## Décision proposée

La banque devient le stock de référence. Le sac du marchand reste un espace
de travail limité et le stand une vitrine. Un coordinateur bancaire unique
exécute les dépôts et retraits demandés par les activités existantes.

Il ne faut pas imposer un trajet bancaire à chaque opération : les potions,
scrolls et ingrédients d’un lot en cours restent dans le sac. Les bases NPC
achetées pour ce lot sont directement consommables. Un équipement terminé
passe en banque avant d’être éventuellement réservé au stand, conformément
au comportement demandé.

Objectifs : arrêter les mouvements contradictoires, préserver les réserves,
regrouper les visites, expliquer les décisions, reprendre après un crash sans
dupliquer une action ni perdre la progression des lots.

## Ce que le code actuel révèle

- `eadrosell-merchant-v2.js` contient le dépôt récurrent, le retrait pour le
  stand, les retraits craft et les batches Xyn. Chacun conserve son état.
- `compound-production.js` prélève ses trios pendant un passage en banque.
- Le générateur injecte une logique de publication et de wishlist dans
  `dashboard-v2/server/builder.ts`.
- Les verrous, délais et protections actuels corrigent des cas locaux, mais
  ne constituent pas un plan bancaire partagé.
- Le snapshot du stand fermé peut masquer les emplacements étendus. Une
  absence dans ce snapshot n’est pas une preuve de vente ou de place libre.
- Les objets reçus peuvent ne pas fournir d’identifiant stable. Un slot de
  banque ou de sac est une adresse temporaire, pas une identité d’objet.

Les composants métier restent réutilisables. Le changement porte d’abord sur
la propriété du stock et l’exécution des mouvements, pas sur une réécriture
de tous les scripts.

## Règles non négociables

1. Aucun dépôt arbitraire : dépôt récurrent explicite, destination de
   production, ou surplus d’une règle commerciale explicitement configurée.
2. Objets verrouillés, liés, appartenant à un autre propriétaire ou réservés
   à un personnage exclus des mouvements automatiques incompatibles.
3. Les résultats d’upgrade terminés passent en banque avant mise en vente.
4. Les niveaux intermédiaires de compound restent déposables selon la règle
   actuelle ; un trio engagé dans une tentative reste réservé jusqu’au résultat.
5. La réserve minimale du stand reste définie par objet ET niveau.
6. Une action incertaine ne peut pas être répétée aveuglément.
7. Une seule routine possède la navigation bancaire et les mutations du sac.
8. Une lecture de politique ou de disponibilité ne modifie aucun état.
9. Un personnage manuel et ses équipements ne sont jamais repris en main
   implicitement par le coordinateur.

## Modèle de stock

Chaque observation comporte sa source, sa date et son degré de fraîcheur.
La vue regroupe banque, sac, stand et équipements des personnages, mais
ces emplacements ne sont pas interchangeables.

Clé commerciale minimale : objet + niveau. Pour une allocation réelle,
tenir également compte des propriétés de la pièce : verrouillage, liaison,
propriétaire, variante et identifiant stable lorsqu’il existe.

| Notion | Définition |
|---|---|
| Stock observé | Quantité réellement vue à un emplacement et une date donnés |
| Stock éligible | Stock utilisable pour une opération donnée après protections |
| Réserve minimale | Quantité à conserver physiquement en banque pour la règle concernée |
| Allocation | Quantité engagée par un lot, une annonce ou un équipement |
| Disponible | Stock éligible restant après contraintes et allocations compatibles |
| Attendu | Résultat possible ou transfert en cours ; jamais compté comme disponible |

Les planchers ne s’additionnent pas automatiquement. Deux règles qui imposent
un minimum bancaire sur le même stock utilisent le plus grand plancher
compatible ; des réservations d’exemplaires distincts s’additionnent.
Une même pièce ne peut pas satisfaire deux allocations exclusives.

Ne pas afficher un « disponible » unique trompeur : montrer aussi
« disponible pour la vente » et « disponible pour la production » lorsque
leurs contraintes diffèrent. Par défaut, une réserve commerciale protège
ce stock contre toute allocation automatique ; un usage plus permissif
doit être explicite.

Les snapshots anciens permettent une estimation et une proposition de trajet.
Ils n’autorisent pas seuls un retrait : le stock est revalidé sur place.

## Réservations

Une réservation comprend : identifiant, demandeur, règle et révision,
objet/niveau/propriétés, quantité, emplacement observé, état et preuves.

États proposés : demandée → allouée → retrait en cours → transportée →
consommée ou publiée. Annulation et examen manuel sont des issues distinctes.

- Avant retrait : réservation logique de quantité, revalidée en banque.
- Après retrait : propriété du stock porté pour l’activité précise.
- Après publication : le stock appartient à l’annonce ; le surplus du sac
  redevient déposable selon les règles. Aucun second retrait pour cette annonce.
- En pause : pas de nouveaux retraits. Les opérations déjà lancées sont
  réconciliées ; le stock inutilisé peut être rendu lors d’une visite justifiée.
- Après modification d’une règle : invalider les demandes non exécutées,
  conserver les preuves des opérations exécutées et proposer leur clôture.

Une propriété de stock ne disparaît pas sur un simple timeout. En revanche,
un verrou d’exécution doit avoir un watchdog : un déplacement bloqué conduit
à une récupération bornée, puis à une alerte, sans relancer une mutation incertaine.

Sans identifiant stable, suivre des quantités et propriétés dans un lot dédié.
Si deux exemplaires deviennent indiscernables après compactage ou fusion,
réconcilier les quantités ; ne jamais prétendre connaître leur identité exacte.

## Cycle unique de visite

1. Les activités proposent des besoins, sans se déplacer ni retirer d’objet.
2. Le planificateur choisit un travail exécutable selon les priorités existantes,
   les budgets, la place, les protections et les contraintes du lot.
3. Il prépare une visite : dépôts justifiés, retraits et espace nécessaire.
4. Le coordinateur acquiert un verrou, ferme le stand en conservant son
   dernier état complet, rejoint la banque et attend les données utilisables.
5. Il réconcilie les transactions pendantes et revalide le plan.
6. Il dépose, puis retire les besoins admis, regroupés par étage et pack.
7. Il vérifie chaque mouvement, actualise le journal et les allocations.
8. Il quitte la banque jusqu’à un point sûr avant de libérer le verrou.
9. Les activités reprennent avec les stocks attribués.

Le plan n’est pas figé pendant toute la visite : revalider avant chaque
mutation, sans laisser une autre boucle prendre la navigation. Une modification
manuelle du sac invalide les adresses en attente et force une nouvelle lecture.

La planification réserve de la place pour les récompenses, les scrolls et une
éventuelle scission de stack. Elle ne retire pas de quoi saturer le sac.
Par défaut, alimenter le prochain lot exécutable et les annonces manquantes
compatibles avec l’espace restant, pas tous les lots actifs simultanément.

### Quand visiter ?

- Immédiatement si un objet explicitement à déposer est présent, conformément
  à la préférence actuelle.
- Quand un travail prioritaire manque de matériaux disponibles en banque.
- Pour une annonce manquante avec surplus bancaire suffisant et place au stand.
- Sur demande manuelle de synchronisation ou de tri.

Pas de visite répétée pour chercher un stock absent. Retenter sur changement
pertinent de stock, de règle ou sur demande ; prévoir un rafraîchissement borné
pour les modifications externes inconnues, avec une raison visible.
Une erreur ne déclenche pas un nouvel aller-retour à chaque tick.

Le dépôt immédiat peut encore créer des visites fréquentes lorsque les farmers
envoient continuellement des objets autorisés. Une temporisation de collecte
pourrait être proposée ensuite, désactivée par défaut car elle changerait
la préférence actuelle.

## Exemple : coats +9

Annonce à 150 millions, réserve minimale 2.

- Deux coats +9 en banque : aucun retrait pour cette annonce.
- Trois coats +9 en banque, annonce absente : allouer et retirer un exemplaire.
  Deux restent en banque, même si la publication est retardée.
- Une annonce est déjà publiée : aucune deuxième allocation pour elle.
- Un coat +9 supplémentaire arrive dans le sac : dépôt en banque.
- Le coat publié est vendu : confirmer la vente ou constater l’absence dans
  un snapshot complet, puis envisager un réassort avec la réserve recalculée.
- Un snapshot incomplet de stand fermé ne suffit jamais à conclure à une vente.

## Transactions et récupération

Écrire l’intention dans un journal avant l’appel jeu : opération, lot,
source/destination, propriétés et quantités observées avant action.

L’accusé de réception est une preuve parmi d’autres. La quantité dans le sac
et la banque doit être cohérente avec le mouvement demandé. Si un joueur
intervient entre les deux observations, suspendre la conclusion automatique.

Après redémarrage :

1. Restaurer le journal et les allocations persistantes.
2. Acquérir des observations suffisamment récentes.
3. Classer chaque opération : confirmée, non exécutée avec preuves,
   ou indéterminée.
4. Reprendre uniquement les opérations dont la situation est déterminée.
5. Signaler les autres dans le centre d’incidents avec les éléments manquants.

Le tri de banque partage le même verrou. Il ne démarre pas au milieu d’un
transfert, et invalide les adresses mémorisées à sa fin. Un pack occupé n’est
pas une banque pleine ; chercher tous les packs accessibles et les fusions
compatibles avant de conclure à un manque de place.

## Architecture modulaire proposée

| Module | Responsabilité |
|---|---|
| StockLedger | Observations normalisées, fraîcheur, quantités et emplacement |
| StockReservations | Allocation, protections et disponibilité par usage |
| MerchantWorkPlanner | Propositions des activités et choix du prochain lot |
| BankVisitPlanner | Préparation d’une visite et estimation d’espace |
| BankCoordinator | Verrou, déplacement et exécution séquentielle |
| BankJournal | Intentions, preuves, récupération et incidents |

Les modules de craft, upgrade, compound, Xyn et stand deviennent des clients.
Ils gardent leurs recettes, budgets, pauses et compteurs, mais ne peuvent
plus appeler directement les retraits bancaires.

Le marchand est l’unique exécuteur en jeu. Le service local conserve les
observations et sert le dashboard ; il ne lance pas une deuxième boucle
concurrente. Les décisions critiques utilisent l’état disponible en jeu.

## Dashboard : garder l’essentiel

Pas de nouvel onglet principal. La page Banque devient « Stock et flux »
avec trois sous-vues : Suivi, Stock, Règles.

**Suivi** : activité, motif, prochaine visite et blocage. Une carte compacte
présente le plan courant : « déposer 4 objets, récupérer les ingrédients
de 20 crafts, réapprovisionner 1 annonce ». Détails au clic.

**Stock** : recherche et sprites, quantité en banque, réservé, disponible
pour l’usage choisi, âge des données. Une donnée ancienne est signalée,
jamais présentée comme un inventaire live.

**Règles** : dépôts récurrents, minimums et réservations. Les réglages métier
restent sur Merchant ; la banque fournit des liens vers la règle concernée.

Le tiroir existant « Décision et preuves » montre : activité → raison →
prochaine action → blocage → régler. Le détail d’un objet explique ses
allocations, sa réserve, ses emplacements et ses dernières transactions.

Le journal complet reste secondaire. Les erreurs non résolues sont visibles
dans le résumé, sans une longue liste de logs par défaut.

## Livraison progressive et retour arrière

1. **Inventaire unifié en observation seule.** Normaliser les snapshots,
   distinguer complet/incomplet, ajouter les explications sans nouveaux mouvements.
2. **Réservations stand et équipements.** Migrer les protections actuelles,
   tester surplus/réassort et identité ambiguë avant les autres activités.
3. **Coordinateur bancaire pour dépôts et stand.** Une seule navigation,
   une visite planifiée, journal et récupération.
4. **Craft et Xyn.** Brancher les batches, scissions de stacks et budgets.
5. **Upgrade et compound.** Intégrer les lots, trios et résultats intermédiaires,
   sans réinitialiser les compteurs existants.
6. **Interface Banque et bilan des trajets.** Montrer les décisions validées,
   puis comparer les déplacements avant/après.

Chaque étape possède un mode d’observation ou un flag de migration. Un lot
est exécuté par l’ancien OU le nouveau système, jamais les deux. Les nouveaux
états sont versionnés et isolés. Avant retour arrière, terminer ou réconcilier
les mutations pendantes et restituer les protections ; désactiver un flag ne
suffit pas lorsqu’un stock retiré est encore engagé.

## Critères de validation

- Trois coats +9 et réserve 2 : un retrait, une publication, aucune boucle.
- Annonce existante et copie supplémentaire : dépôt du surplus, zéro réassort.
- Fermeture/réouverture du stand : aucune fausse absence ni double allocation.
- Un objet utilisé par craft et commerce : une seule allocation exclusive.
- Compound : un trio complet, résultats intermédiaires déposés, pas de ping-pong.
- Stack : retirer le besoin, rendre le reste sans swap accidentel.
- Plusieurs étages : visite regroupée et adresses revalidées après tri.
- Sac presque plein : batch réduit ou bloqué avec raison, pas de retrait excessif.
- Crash avant/après accusé de réception : aucune répétition sans réconciliation.
- Vente externe, objet déplacé manuellement ou télémétrie ancienne : décision prudente.
- Stockage de sauvegarde indisponible : état actif conservé et alerte de durabilité.
- Pauser ou changer une règle : compteurs conservés et matériaux expliqués.

Mesures : visites par heure, secondes de déplacement, visites sans mutation,
mouvements inverses du même stock sans activité intermédiaire, opérations
incertaines et temps avant leur résolution. Fixer les objectifs après une
mesure de référence ; ne pas promettre un gain chiffré sans observation.

## Recommandation finale

Commencer par les étapes 1 à 3. Elles traitent les causes des boucles actuelles
et rendent les décisions inspectables. Intégrer ensuite les activités une
par une. La banque centrale doit être un modèle commun de stock et de
transactions, pas une nouvelle série de conditions ajoutée aux boucles existantes.
