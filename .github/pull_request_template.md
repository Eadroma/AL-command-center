## Changement

Décrire le problème concret et le comportement obtenu.

## Vérification

- [ ] Build et lint
- [ ] Tests pertinents
- [ ] Aucun secret ou fichier runtime ajouté
- [ ] Crédits/licences conservés pour les éléments tiers

### Si la PR touche `dashboard-solid/`

- [ ] `pnpm --dir dashboard-solid check` passe (types, lint, langues, tests)
- [ ] Textes visibles ajoutés en français **et** en anglais, aucun texte en dur
- [ ] Données entrantes validées (Zod) ; aucun `as`, `any` ou `!` ajouté
- [ ] Doc mise à jour si le comportement change (`dashboard-solid/docs/`)
- [ ] Carte du Kanban mise à jour (colonne, critères)

Mentionner les limites ou vérifications non exécutées. Aucun déploiement de jeu ne doit être lancé par la CI.
