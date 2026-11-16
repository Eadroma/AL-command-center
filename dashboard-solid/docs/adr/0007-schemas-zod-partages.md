# 0007 — Schémas Zod partagés, l'interface valide les réponses

- **Statut** : acceptée, 26/10/2026
- **Contexte** : la norme interdit `as`, `any` et `!`. `response.json()` renvoie `any` ; le client Hono typé ne voit
  pas les routes ajoutées hors de la chaîne de création de l'application.
- **Décision** : les formes échangées sont des schémas Zod dans `shared/` ; les types en sont déduits ; le serveur
  valide les entrées, l'interface valide chaque réponse avant usage (`src/api/http.ts`).
- **Conséquences** : une seule source de vérité ; une réponse inattendue devient une erreur affichée
  (`http.unexpectedResponse`), jamais un état faux silencieux.
