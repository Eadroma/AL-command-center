# Provenance et licences

État de revue : 20 octobre 2026. Ce document n'attribue pas une licence globale aux sources.

| Élément | Provenance | État |
| --- | --- | --- |
| Données et images du jeu dans `dashboard-v2/public/assets/` | [kaansoral/adventureland_mongodb](https://github.com/kaansoral/adventureland_mongodb) | Licence `AdventureLandOnlyUse` conservée dans [LICENSE.txt](dashboard-v2/public/assets/LICENSE.txt). Métadonnées dans `sources.json`. Ce n'est pas une licence MIT. |
| HUD `code/gui.js` | [Crowns3bc/AdventureLand](https://github.com/Crowns3bc/AdventureLand), dossier Gui | L'en-tête indique une reprise des overlays DPS, or et XP. Aucune licence racine explicite n'a été identifiée dans l'arborescence consultée. Obtenir une clarification ou remplacer le code repris avant publication publique. |
| `code/merchant-party-gui.js` | [adventureland-community/userinterface](https://github.com/adventureland-community/userinterface) | L'en-tête indique une inspiration/adaptation de `enhance-comm-ui`. Vérifier la frontière entre inspiration et code repris et les autorisations correspondantes. |
| Algorithmes crédités dans les scripts | Références à Crowns3bc, FreezePhoenix et albot-js dans les en-têtes/commentaires | Distinguer idées réimplémentées et extraits copiés ; conserver les crédits et clarifier les licences des reprises effectives. |
| caracAL | [numbereself/caracAL](https://github.com/numbereself/caracAL) | Intégration externe optionnelle, non incluse dans l'export public. La copie locale dispose d'une licence MIT. |
| Dépendances npm | Déclarées dans `dashboard-v2/package.json` et le lockfile | Leurs licences s'appliquent séparément. Les dépendances installées ne sont pas exportées. |

Le dashboard contient un lien d'attribution vers [Adventure Land](https://adventure.land). Le code complet du jeu et ses médias non utilisés ne sont pas inclus dans le périmètre du dépôt.

Il reste à choisir la licence des contributions originales du projet. Ne pas ajouter une licence permissive globale en supposant qu'elle couvre les ressources ou les reprises tierces. La présence d'un dépôt accessible publiquement n'est pas utilisée ici comme preuve de licence.
