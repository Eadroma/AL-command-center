# 0008 — Garde-fous du mode local

- **Statut** : acceptée, 26/10/2026
- **Contexte** : écouter sur 127.0.0.1 ne suffit pas : toute page web ouverte dans le navigateur peut envoyer des
  requêtes au serveur local (CSRF, DNS rebinding) et déclencher, à terme, un déploiement.
- **Décision** : en-tête Host loopback obligatoire ; jeton CSRF par processus, lisible seulement par les pages de la
  même origine, exigé sur toute écriture ; Origin loopback exigée quand le navigateur l'envoie ; seule
  `/api/telemetry` accepte `https://adventure.land` (CORS) et s'appuie sur son propre ticket. Le mode `hosted` est
  refusé au démarrage tant que l'authentification et HTTPS n'existent pas.
- **Conséquences** : les outils locaux sans Origin (curl) restent possibles avec le jeton.
