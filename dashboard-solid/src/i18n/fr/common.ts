/** Mots partagés entre les écrans. */
import type { RawDictionary } from '../en/index.ts';

export const common = {
  loading: 'Chargement…',
  language: 'Langue',
  currentLanguage: (params: { readonly name: string }): string => `Langue : ${params.name}`,
  screens: 'Écrans',
  team: 'Équipe',
  merchant: 'Marchand',
} satisfies RawDictionary['common'];
