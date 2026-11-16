# 0002 — Vite + Solid + Hono dans un seul paquet

- **Statut** : acceptée, 26/10/2026
- **Contexte** : besoins serveur atypiques pour un site web : processus long, WebSocket permanent, tâches de fond,
  SQLite, esbuild, accès fichiers, un seul utilisateur en local. Next.js est React uniquement et pensé serverless ;
  SolidStart apporte un rendu serveur inutile ici, et ses WebSockets et tâches sont expérimentaux.
- **Décision** : interface Solid servie par Vite, serveur Hono sur Node 24, dans le même paquet. En développement,
  `pnpm dev` lance les deux et Vite relaie `/api` et `/live` ; en production, Hono sert l'interface compilée.
  Le serveur tourne sans compilation (type stripping de Node).
- **Conséquences** : deux processus en développement (le WebSocket Hono veut posséder le serveur HTTP, ce qui
  exclut `@hono/vite-dev-server`) ; imports en `.ts`, ni enum ni namespace (`erasableSyntaxOnly`).
