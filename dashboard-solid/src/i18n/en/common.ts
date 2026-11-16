/** Shared words used across screens. */
export const common = {
  loading: 'Loading…',
  language: 'Language',
  currentLanguage: (params: { readonly name: string }): string => `Language: ${params.name}`,
  screens: 'Screens',
  team: 'Team',
  merchant: 'Merchant',
};
