# 0003 — Réglages dans `settings.json`, dossier applicatif

- **Statut** : acceptée, 26/10/2026
- **Contexte** : v2 stockait le jeton dans `credentials.json` ou le lisait dans `.cursor/mcp.json`. L'utilisateur veut
  une configuration globale unique, remplie par un écran et préremplie.
- **Décision** : un seul `settings.json`, validé par Zod, dans le dossier applicatif de l'OS
  (`%LOCALAPPDATA%\ALCC`), chemin modifiable par `ALCC_SETTINGS`. Priorité : variable d'environnement, fichier,
  défaut. Écriture atomique après test du jeton auprès du jeu ; le jeton n'est jamais renvoyé au navigateur ni
  recopié depuis `AL_MCP_TOKEN`.
- **Conséquences** : le jeton ne vit plus dans le dossier du code. Un fichier absent ou invalide ne bloque pas le
  démarrage : l'écran Réglages s'ouvre avec les erreurs par champ.
