# Scripts de personnages et interfaces

Les scripts s'exécutent dans Adventure Land CODE. Ils ne sont pas des scripts Node.js.

## Scripts privilégiés

- `eadroma-warrior-v2.js` : guerrier et gestion d'aggro.
- `aedroma-priest-v2.js` : prêtre et soutien.
- `droma-ranger-v2.js` : archer de groupe.
- `droma-ranger-crab-aoe-v2.js` : archer autonome spécialisé crabs.
- `dromas-rogue-v2.js` : rogue crabs, Fan of Knives, Mental Burst, Swiftness, gants et consommables.
- `eadrosell-merchant-v2.js` : marchand et orchestration logistique.

Les prérequis des sorts restent imposés par le jeu : une règle activée ne débloque pas un niveau, une statistique ou un équipement manquant.

## Modules et interfaces

Le builder ajoute les modules de timing, événements, sécurité, équipement, diagnostic et télémétrie. Les fichiers `merchant-*-gui.js` sont les panneaux intégrés au marchand. `gui.js` est le HUD XP/or/DPS chargé depuis un slot CODE nommé `gui` ; il doit être disponible dans le compte pour apparaître.

Utiliser de préférence le dashboard pour construire et charger les bundles. Charger un module partagé seul ne démarre pas un personnage complet. Les sources standalone et les anciens scripts sont conservés pour compatibilité et tests, mais ne sont pas les bundles instrumentés du dashboard.

Les crédits figurent dans les en-têtes et dans [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md). Certains éléments ont encore un statut de licence à clarifier avant publication publique.
