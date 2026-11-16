/**
 * Current language and the typed translator shared by every screen.
 * The browser's choice is remembered locally; the settings.json default arrives with the Settings card.
 */
import * as i18n from '@solid-primitives/i18n';
import { createMemo, createRoot, createSignal } from 'solid-js';
import { en } from './en/index.ts';
import { fr } from './fr/index.ts';

export const LOCALES = ['fr', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

const storageKey = 'alcc.language';
const dictionaries = { en, fr } as const;

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && LOCALES.some((locale) => locale === value);
}

function readStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(storageKey);
    return isLocale(stored) ? stored : 'fr';
  } catch {
    return 'fr';
  }
}

const initialLocale = readStoredLocale();
const [locale, setLocaleSignal] = createSignal<Locale>(initialLocale);
// The page's lang must match the remembered choice from the first paint (screen readers, hyphenation).
if (typeof document !== 'undefined') {
  document.documentElement.lang = initialLocale;
}
// Lives as long as the page: owned by its own root so Solid does not warn about an undisposed computation.
const dictionary = createRoot(() => createMemo(() => i18n.flatten(dictionaries[locale()])));

export const t = i18n.translator(dictionary);
export { locale };

export function setLocale(next: Locale): void {
  setLocaleSignal(next);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = next;
  }
  try {
    localStorage.setItem(storageKey, next);
  } catch {
    // Storage can be unavailable (private window); the choice then lasts for this visit only.
  }
}
