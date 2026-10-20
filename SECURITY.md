# Sécurité

Le dashboard est conçu pour un usage local sur la boucle locale. Il contient des actions de déploiement et de gestion de compte : ne pas le publier sur un serveur accessible depuis Internet sans une conception d'authentification et d'autorisation dédiée.

Ne pas inclure dans une issue publique : token MCP, clé API, cookie, fichier de configuration MCP, base SQLite, télémétrie brute, sauvegarde CODE instrumentée ou export de compte.

Pour signaler un problème, utiliser le canal privé de signalement du dépôt s'il est activé. Sinon, contacter le mainteneur par un moyen privé déjà connu. Aucun canal de sécurité public n'est encore configuré.

Si un secret est publié, le révoquer ou le renouveler auprès du service concerné et traiter l'historique Git ; supprimer le fichier du dernier commit ne suffit pas.

`pnpm audit:public` recherche certaines signatures et des chemins personnels dans le périmètre publiable. Il ne remplace pas une revue humaine ni un outil spécialisé de détection de secrets sur l'historique Git.
