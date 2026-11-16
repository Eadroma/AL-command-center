# 0009 — Télémétrie compatible v2 et relais pendant la migration

- **Statut** : acceptée, 26/10/2026
- **Contexte** : les scripts en jeu ont été construits par dashboard-v2 et envoient leur télémétrie au port 9320.
  La conception prévoyait un ticket « signé (HMAC) ». v2 utilise un ticket aléatoire de 256 bits dont le serveur ne
  garde que le SHA-256.
- **Décision** :
  - Réception `POST /api/telemetry` compatible avec les paquets v2 (schéma souple : champs utilisés exigés, le reste
    accepté), même schéma de ticket que v2 plutôt qu'un HMAC : sécurité équivalente (secret aléatoire, seule
    l'empreinte est stockée) et bundles v2 réutilisables par le futur builder.
  - Séquence croissante, un paquet par seconde au plus, commandes renvoyées jusqu'à leur accusé (protocole 2).
  - Pendant la migration, `migration.relayV2Url` fait lire au serveur `GET /api/deployments` de v2, en lecture seule.
    Notre télémétrie l'emporte quand elle est en direct.
  - L'interface reçoit l'équipe uniquement par le WebSocket `/live` (plus d'interrogation régulière côté navigateur).
- **Conséquences** : l'écran Équipe fonctionne avant la réécriture du builder ; le relais disparaît à la bascule.
