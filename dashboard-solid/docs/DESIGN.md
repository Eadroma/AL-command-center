# Identité visuelle

> Établie le 26/10/2026 avec le skill frontend-design (plan, relecture contre le brief, construction, critique).

## Brief

- **Sujet** : le poste de commande d'une équipe de bots dans Adventure Land, un MMO en pixel art qu'on programme.
- **Public** : un joueur-développeur, francophone, qui garde l'outil ouvert à côté du jeu, souvent sur un second écran.
- **Tâche principale** : voir en un coup d'œil si l'équipe va bien, et agir (régler, déployer) sans se tromper.

Le vocabulaire du jeu fournit les choix : la pièce d'or, la barre de vie rouge et la barre de mana bleue, les cases
d'inventaire carrées aux coins crantés, le texte en pixels des titres du jeu.

## Plan

### Couleurs (thème Nuit)

| Nom | Hex | Rôle |
| --- | --- | --- |
| Ardoise | `#1f2631` | Fond. Bleu-gris nocturne, pas un quasi-noir. |
| Pierre | `#2a3340` | Panneaux. |
| Case | `#343f50` | Cases (champs, cases de personnage). |
| Arête | `#56657c` | Bordures crantées des cases. |
| Parchemin | `#ece6d6` | Texte. |
| Or | `#f0bf4c` | Action principale (la pièce d'or du jeu). |
| Vie | `#e25b4f` | Erreurs, danger (la barre de vie). |
| Mana | `#5b93e6` | Information, en cours (la barre de mana). |
| Herbe | `#7cc26a` | Succès. |

Le thème Jour reprend la même logique sur un ciel clair (`#e8eef4`), pas sur un crème.

### Typographie

- **Pixelify Sans** pour la marque et les titres d'écran seulement : c'est la voix du jeu, utilisée avec retenue.
- **Atkinson Hyperlegible Next** pour tout le reste : très lisible en petit, sur un second écran.
- Polices hébergées dans le projet (`@fontsource`) : aucune requête externe.
- Échelle : 14 / 16 / 20 / 28 px, interlignage 1,5 pour le texte, lignes de moins de 75 caractères.

### Mise en page

Alignement à gauche, une colonne de 640 px pour les formulaires. L'écran Réglages est une vraie séquence
(connecter, choisir le serveur, options), donc des étapes numérotées s'y justifient.

```
ALCC ▮                                       Langue [Français ▾]  [Réglages]
──────────────────────────────────────────────────────────────────────────
Réglages
① Connecter ton compte      [jeton •••••••] [Afficher]  [Tester la connexion]
   ┌▚───────┐ ┌▚───────┐ ┌▚───────┐       ← cases crantées, une par personnage
   │Eadroma │ │Aedroma │ │Dromas  │
   │guerrier│ │prêtre  │ │voleur  │
   │  niv 73│ │  niv 70│ │  niv 67│
② Choisir ton serveur       [EU ▾] [III ▾]
③ Options                   (•) Navigateur  ( ) Mainframe   Langue [▾]   ▸ Avancé
                                                         [ Enregistrer ]
```

### Principes

1. **Une seule audace : la case crantée.** Les personnages s'affichent comme des cases d'inventaire du jeu.
   Le reste reste sobre.
2. **Les couleurs ont le sens qu'elles ont dans le jeu** : rouge = vie en danger, bleu = mana, or = action.
3. **Pas d'étiquettes décoratives** : pas de majuscules, pas de surtitres, pas de « A · B · C ».
4. **Un seul mouvement** : les cases de personnages apparaissent l'une après l'autre quand le test réussit
   (désactivé si l'utilisateur réduit les animations).

## Relecture contre le brief

Ce que j'ai changé après avoir comparé le plan aux choix génériques :

- **Thème Nuit de dashboard-v2 (encre quasi noire + or + IBM Plex Sans + Plex Mono pour les données)** : c'est
  presque exactement le défaut « fond quasi noir + un seul accent vif », avec la police mono des petites
  étiquettes. Remplacé par une ardoise bleutée et une palette tirée du jeu (vie, mana, herbe, or) où chaque couleur
  a un sens.
- **Liste des personnages en texte « Eadroma · warrior · 73 »** : chaîne à points médians, police mono. Remplacée
  par des cases, la seule audace de l'écran.
- **Police pixel partout** : tentante mais fatigante et peu lisible. Limitée à la marque et aux titres.
- **Thème Jour** : le crème chaud est un défaut connu ; ciel clair à la place.

## Critique après construction (26/10)

Captures bureau et téléphone (390 px) de l'écran Réglages, connexion testée avec le vrai compte :

- Corrigé : texte du champ jeton tronqué ; la consigne « laisse vide pour garder » passe sous le champ.
- Corrigé : le menu de langue s'étirait sur toute la largeur, contrairement aux autres menus.
- Vérifié : aucun débordement horizontal à 390 px ; cases à deux par ligne ; « III » lisible (le I à empattements
  d'Atkinson est voulu).
- Laissé : l'en-tête passe sur deux lignes en mobile, lisible.

Polices : Pixelify Sans et Atkinson Hyperlegible Next, licence SIL OFL 1.1, servies par `@fontsource`.

## Sélecteur de langue (26/10)

Inspiré du sélecteur de freeflags.org (bouton avec drapeau rond et nom de la langue dans sa propre langue, liste
déroulante), adapté à l'identité :

- liste en case crantée, langue active en or ; chevron en pixels plutôt qu'une flèche typographique ;
- drapeaux SVG dessinés dans le projet (aucun fichier externe), petits et cerclés d'un liseré, pour ne pas
  concurrencer les cases de personnages ; Union Jack pour l'anglais ;
- motif ARIA listbox : Entrée, Espace ou flèche bas ouvrent ; flèches, Début, Fin déplacent ; Entrée choisit ;
  Échap ferme et rend le focus au bouton ; un clic à l'extérieur ferme.

## Écran Équipe (26/10)

**Tâche** : voir en un coup d'œil qui tourne, qui souffre et qui ne répond plus. C'est l'écran d'accueil, souvent
laissé ouvert sur un second écran : il doit se lire de loin.

```
ALCC  ■ En direct                                    🇫🇷 Français ▾   Réglages
─────────────────────────────────────────────────────────────────────────────
Équipe            EU III
┌▚────────────────────────────┐ ┌▚────────────────────────────┐
│ [sprite]  Dromas   niveau 67│ │ [sprite]  EadroSell niveau 74│
│ ×2 pixel  Voleur   ■ en direct│ │          Marchand ■ en direct│
│ Vie  ██████████████ 3808/3808 │ │ Vie  ████████████▒ 6222/6715 │
│ Mana █████████████▒ 3315/3315 │ │ Mana ████████▒▒▒▒ 2169/3315  │
│ Crabs / Fan of Knives         │ │ town stand                   │
│ main                          │ │ bank                         │
└──────────────────────────────┘ └─────────────────────────────┘
▸ Sans télémétrie (1)          ← repli, avec l'aide « autorise l'accès au réseau local »
```

Choix, relus contre le brief :

- **Les cartes sont des cases crantées**, la même audace que les Réglages : l'écran garde une seule signature.
- **Barres de vie rouge et de mana bleue**, exactement le code du jeu ; les nombres en chiffres tabulaires.
- **Le sprite en pixels nets, agrandi ×2** (52×72), sans lissage ; pour les cosmétiques en couches, le sprite
  représentatif de la classe.
- **La fraîcheur se lit sans lire** : carré vert « en direct », texte atténué « vu il y a 6 min », carte estompée
  quand les données sont anciennes. Une donnée inconnue s'affiche « — », jamais inventée.
- **Ordre fixe** : celui du compte (du jeu). La fraîcheur ne déplace jamais une carte, elle change seulement son apparence ; seuls les personnages jamais entendus sont repliés. (Corrigé le 26/10 : trier par fraîcheur faisait sauter les cartes à chaque paquet.)
- Pas de « carte · serveur · cible » à points médians : chaque information sur sa ligne.

Critique après construction (vrais personnages, bureau + 390 px) : sprites nets, fraîcheur lisible de loin, aucun
débordement à 390 px, cartes sur une colonne. Corrigé : l'attribut `lang` de la page ne suivait pas la langue
mémorisée au chargement. À surveiller : les valeurs de vie/mana s'affichent en chiffres tabulaires, qui paraissent
proches d'une police mono ; à revoir si l'écran devient trop « technique ».

## Bandeau « À traiter » (26/10)

- En tête de l'écran Équipe, une ligne par signal ; la bordure gauche reprend le code du jeu : rouge PV = danger
  (mort dans les 30 dernières minutes, PV < 30 %), or = avertissement (personnage muet, mise à jour des données
  échouée), bleu PM = info (jamais reçu de télémétrie). Tri : gravité puis clé, donc un ordre stable.
- « Voir » mène à la carte du personnage et déplie la section repliée si besoin. « Masquer » enregistre la clé
  du signal côté serveur (`attention.json`, 500 dernières) : le même incident reste masqué, un nouveau (autre mort,
  nouveau silence) réapparaît. PV bas n'est pas masquable : il disparaît quand les PV remontent.
- Rien à traiter : une phrase en vert herbe, pas de bandeau vide.

## Carte du groupe (26/10)

- Le terrain est le vrai : dessiné dans le navigateur à partir de `G.geometry` (tuile par défaut, placements, groupes
  d'objets triés par leur bord bas, comme `js/game.js`) avec les tilesets déjà mirés. Aucune image pré-rendue à
  maintenir : une nouvelle carte du jeu apparaît après la mise à jour des données. Rendu une fois par carte dans un
  canvas hors écran (≤ 4096 px de côté), puis seulement recopié quand la caméra bouge.
- Personnages : sprite du jeu au-dessus d'un point, nom en dessous ; une couleur par personnage (or, bleu PM, vert
  herbe, rouge PV, texte) dans l'ordre fixe du compte. Traces des 10 dernières minutes, coupées aux changements de
  carte et aux trous de télémétrie (≥ 20 s), volontairement pâles : une boucle de farm devient vite un gribouillis.
- Caméra : ne bouge jamais seule. « Suivre » un personnage la centre sur lui (zoom ×3 minimum) ; glisser, flèches ou
  changer de carte arrêtent le suivi. Molette (sans faire défiler la page), + / −, « Carte entière ».
- Boutons de carte seulement quand le groupe est réparti sur plusieurs cartes. Sur téléphone, le canvas est moins
  haut (les cartes sont plus larges que hautes).
- Pas encore : explorer une carte vide, éviter le chevauchement des noms quand plusieurs personnages sont au même
  endroit (zoomer ou suivre suffit pour l'instant), destination et état de déplacement (carte « Panneau personnage »).

## Panneau personnage (27/10)

- Ouvert par « Détails » sur chaque carte (aussi pour les personnages jamais reçus). Un `<dialog>` modal natif :
  le focus entre dans le panneau, Échap ferme, le focus revient sur le bouton de la carte.
- Ordre : **Pourquoi** d'abord (c'est la question qu'on se pose), puis ce qu'il fait, le script, le journal récent
  (10 lignes, les plus récentes en haut). Bordure rouge PV quand l'explication est un blocage, bleu PM sinon.
- L'explication est un portage simplifié de celle de la v2 : blocages signalés par le script d'abord (connexion,
  mort, pause de sécurité, tâche suspendue, groupe pas prêt, chemin bloqué, blocage), puis l'activité (mission,
  combat, trajet, état du script). Une donnée périmée n'explique jamais une décision en direct. Les textes du
  script sont cités entre guillemets, sans traduction, avec une note seulement quand il y en a.
- Personnage muet : la section devient « Dernier état connu ».
- Pas encore : réglages propres au personnage (carte profil) et arrêter / redémarrer (carte déploiement MCP).

## Profil (27/10)

- Bandeau « Profil » en tête de l'écran Équipe, bordure or (c'est une action à faire au premier lancement).
  Sans profil : « Importer depuis le dashboard v2 » (bouton principal, c'est le cas pendant la migration) ou
  « Partir d'un profil prudent » (tous les personnages listés par le jeu, désactivés). Choix explicite plutôt
  qu'une création silencieuse au démarrage. Avec profil : nom, révision et origine ; « Réimporter depuis la v2 »
  demande une confirmation sur place.
- Réglages du personnage dans son panneau : actif, événements, qui il suit, exécution ; script du profil et cible
  affichés (choisis sur leurs propres écrans). Une modification fait apparaître « Modifications non enregistrées »
  avec Enregistrer / Annuler et le rappel « Enregistrer ne déploie rien ».
- Conflit (autre fenêtre plus rapide) : le texte saisi reste affiché, message en rouge PV et bouton « Recharger ».

## Barre Enregistrer → Prévisualiser → Déployer (27/10)

- Une vraie séquence, donc des étapes numérotées : faites en vert herbe, l'étape en cours en or (`aria-current`),
  les suivantes en gris. L'étape en cours porte son action (Enregistrer / Annuler, Prévisualiser la révision N,
  Déployer N personnages) ; ce qui bloque est dit à côté du bouton, dans l'ordre où il faut s'en occuper
  (modifications non enregistrées, pas d'aperçu, verrou, opération en cours).
- Épinglée en bas sur grand écran (bordure or) ; en fin de page sur téléphone, où elle couvrirait un quart de l'écran.
- Déployer demande une confirmation sur place, puis liste qui a été déployé et, personnage par personnage, qui a
  échoué et pourquoi : le déploiement d'équipe continue après un échec.
- La règle est aussi celle du serveur : seule la révision prévisualisée avec succès peut être déployée
  (`deploy.notPreviewed`), et une sauvegarde postérieure à l'aperçu est refusée (`deploy.staleProfile`).

## Cibles de farm (27/10)

- Bouton « Farming » dans le bandeau Profil : il ouvre un `<dialog>` (focus, Échap, retour du focus), puisque ces
  choix modifient le profil. Enregistrer / Annuler dans la boîte, comme dans le panneau personnage.
- Choix d'un monstre : liste déroulante accessible (motif combobox ARIA : ↑ ↓, Entrée, Échap) avec, pour chaque
  monstre, son sprite recadré comme dans le jeu (`G.dimensions`), son nom, ses PV, son XP et ses cartes d'apparition ;
  le sprite du choix actuel est dans une case à côté du champ, comme un objet d'inventaire. Le texte tapé filtre (nom
  exact d'abord, puis les noms qui commencent par le texte, puis ceux qui le contiennent). Seul un monstre connu est
  pris, sinon « Monstre inconnu » en rouge PV. (Remplace la `datalist` du 27/10, qui ne pouvait pas montrer d'images.) Choisir une cible sans style lui en donne un, comme la v2 (Mono pour les cibles mono du guerrier).
- Par personnage : sa propre cible, ou vide = « Cible de l'équipe : <nom> ». Un script qui fixe sa cible
  (`FIXED_FARM`) est signalé par une bordure bleu PM, avec la cible et ce que cela implique ; pas de champ.
- La liste garde ses lignes pendant l'édition (`<Index>`) : valider un monstre au clavier ne fait pas perdre le focus.

## Loadouts (27/10)

- Bouton « Loadouts » dans le bandeau Profil, à côté de « Farming » : `<dialog>` avec un personnage, un style
  (AOE, Mono, Tank, puis les styles personnalisés comme « Lucky ») et son équipement.
- **Grille d'équipement du jeu** : 4 colonnes comme la fiche du personnage (bijoux autour de l'armure, armes de
  chaque côté), une case crantée par pièce avec l'icône de l'objet (image sets du jeu) et son niveau minimum en
  badge or « +N ». Une case vide montre son nom. La case modifiée est cerclée d'or (`aria-pressed`).
- Éditeur de la case : liste déroulante des seuls objets qui vont dans cet emplacement (une arme va aussi en main
  gauche), avec icône et type traduit ; niveau minimum 0–15 ; « Vider l'emplacement ».
- Compétences : boutons à icône (`aria-pressed`), seulement celles que les scripts savent utiliser pour la classe ;
  l'ordre existant est gardé, une compétence ajoutée va à la fin. « Compte comme » (base AOE / Mono / Tank) pour
  les styles personnalisés.
- La liste déroulante est le composant commun `ChoiceField` (aussi pour les monstres) : image, nom, ligne de détail.
- Pas encore (V2) : créer ou supprimer un loadout, échanger l'équipement en jeu.

## Événements et boss (27/10)

- Bouton « Événements » dans le bandeau Profil : `<dialog>` en trois parties, modifiant le brouillon (Enregistrer /
  Annuler) sans toucher aux autres réglages ni à leur ordre (`src/profile/event-draft.ts`).
- Interrupteur général « Rejoindre les événements » et puces `aria-pressed` par personnage (`characters[].events`).
- **Tableau des événements** : deux colonnes Événements / Boss (listes de `shared/events.ts`, identiques à la v2),
  une ligne par événement avec le sprite du monstre, une case « autoriser » et, une fois autorisé, le **build** :
  AOE, Mono, Tank ou un loadout personnalisé de l'équipe (`events.style`). Un événement autorisé reçoit son style
  par défaut sans écraser un choix existant. Ligne interdite : grisée, sans bordure or.
- **Boss surveillés** (`farming.bossChecks`) : interrupteur, une règle par boss (sprite, boss, intervalle
  15 min – 24 h) ; un boss déjà surveillé n'est pas proposé deux fois.
- Duo d'événement (v2) retiré à la demande : des scripts dédiés le remplaceront. `events.expedition` reste stocké
  tel quel dans le profil et le builder le lit toujours.

## Écran Marchand : Ravitaillement (28/10)

- **Onglets Équipe / Marchand** sous l'en-tête, l'écran courant en or souligné ; `#marchand` dans l'adresse, donc un
  rechargement ou le bouton Retour y ramènent. Le brouillon du profil, l'aperçu et la barre Enregistrer →
  Prévisualiser → Déployer sont communs aux deux écrans (`src/Workspace.tsx`).
- **Activités à gauche** (comme le wireframe), chacune avec son état actif / arrêté lu dans le profil ; celles qui
  n'ont pas encore leur écran le disent (« Pas encore réglable ici… ») et restent telles qu'importées. Sur téléphone,
  la liste passe au-dessus du détail, en lignes.
- **Équipement réservé = loadouts + kit, une seule notion** : par personnage, chaque pièce gardée (jamais vendue ni
  déposée), avec son icône dans une case crantée, le badge « +N », pourquoi elle est gardée (« Loadout AOE, Mono »,
  « Kit : toujours portée, apportée par le marchand ») et **où elle est**, dans les couleurs du jeu : portée (herbe),
  dans ses sacs, en banque ou chez un autre personnage (bleu PM), introuvable (rouge PV), inconnue (atténué, sans
  relevé récent). Un kit qui contredit un loadout sur le même emplacement est signalé en rouge PV.
- **Consommables** : une ligne par règle, barre de stock (remplissage = stock tenu, repères minimum / cible en or /
  maximum, l'échelle va un quart au-delà du maximum), minimum / cible / maximum modifiables sur place. Une valeur hors
  ordre est refusée : le champ revient à la valeur du brouillon et le message dit pourquoi.
- Données : `GET /api/stock` (sacs, équipement, dernière banque relevée, de notre télémétrie et du relais v2),
  rafraîchi avec l'horloge de l'écran (15 s) ; jamais poussé par `/live`, trop gros pour chaque seconde.
- Vérifié dans Chrome avec les vrais personnages (bureau + 390 px, sans débordement) ; trouvé et corrigé : champ de
  quantité qui ne suivait plus le brouillon après « Annuler », marge en trop sous les noms.
