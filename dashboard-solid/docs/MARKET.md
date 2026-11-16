# Market (prix des objets)

> **Statut : conception.** Décrit le fonctionnement visé, rien n'est codé.

Partie **Market** de l'écran Marchand : prix de tes objets, valeur de ton stock, et prix affichés au survol
dans les formulaires d'annonce de stand et d'ordre d'achat, avec pré-remplissage.

## Sources

| Source | Contenu | Limite |
| --- | --- | --- |
| `https://aldata.earthiverse.ca/merchants` | Stands vus par les bots de la communauté, tous serveurs. Par emplacement : `name`, `level`, `price`, `q` (quantité), `b` (ordre d'achat). Relevé du 26/10/2026 : 180 marchands, 1 772 annonces, 346 ordres d'achat. | Instantané sans historique, stands jusqu'à une semaine d'ancienneté, service tiers. |
| Ton marchand | Stands croisés en jeu, envoyés dans la télémétrie. | Seulement là où il passe. |
| `G.items[…].g` | Prix PNJ. | Ne reflète pas le marché entre joueurs. |
| Tes ventes | Prix réellement obtenus par ton stand. | Peu de volume au début. |

## Calcul

- Collecte toutes les `market.refreshMinutes` minutes (15 par défaut), chaque relevé gardé en base : historique local.
- Clé de prix : objet + niveau ; prix ramené à l'unité pour les objets empilables.
- Médiane, 25e et 75e centiles, nombre d'annonces, sur 7 jours. Prix au-delà de 10 fois la médiane écartés.
- Portée : ton serveur, puis ta région, puis tous les serveurs ; la portée utilisée est affichée.
- Donnée trop ancienne ou absente : prix inconnu, jamais deviné.

## Dans l'interface

- **Recherche** : prix de vente et d'achat par niveau et serveur, historique 30 jours, stands actuels.
- **Valeur de tes objets** : inventaires + banque + stand au prix du marché.
- **Survol** (ou focus clavier, ou appui sur ⓘ sur téléphone) d'un champ objet du marchand : médiane, fourchette,
  meilleur ordre d'achat, prix PNJ, ton dernier prix.
- **Pré-remplissage** : « Médiane », « Moins cher − 1 % », « Achat + 1 % ». Remplit le brouillon uniquement ;
  rien n'atteint le jeu avant Enregistrer → Prévisualiser → Déployer.
- **Alertes** : annonce 30 % au-dessus du marché, vente sous le prix PNJ, ordre d'achat dépassé.
