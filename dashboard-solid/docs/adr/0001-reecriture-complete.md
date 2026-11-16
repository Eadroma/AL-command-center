# 0001 — Réécriture complète, dashboard-v2 comme cahier des charges

- **Statut** : acceptée, 26/10/2026
- **Contexte** : dashboard-v2 (React) a accumulé des pages et des modules surdimensionnés (`builder.ts` 56 Ko,
  `MerchantPage.tsx` 34 Ko). Trois options étudiées : reprendre le serveur v2, SolidStart, réécrire tout.
- **Décision** : tout réécrire (option C). Le comportement de v2 sert de cahier des charges exécutable :
  golden tests du builder, faux serveur MCP rejouant de vraies réponses, rejeu de télémétrie anonymisée.
- **Conséquences** : code neuf et lisible ; risque de perdre des cas limites, couvert par les tests de référence.
  L'inventaire des 79 fonctionnalités de v2 (artefact de proposition) fixe ce qui est gardé, simplifié ou retiré.
