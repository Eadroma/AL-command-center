/** Classes de personnage, avec les clés du jeu (G.classes). */
import type { RawDictionary } from '../en/index.ts';

export const classes = {
  warrior: 'Guerrier',
  priest: 'Prêtre',
  rogue: 'Voleur',
  ranger: 'Rôdeur',
  mage: 'Mage',
  paladin: 'Paladin',
  merchant: 'Marchand',
  unknown: 'Classe inconnue',
} satisfies RawDictionary['classes'];
