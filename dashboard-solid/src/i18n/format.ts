/** Locale-aware number and time formatting. Never format numbers or durations by hand. */
import type { Locale } from './i18n.ts';

const intlLocale: Record<Locale, string> = { fr: 'fr-FR', en: 'en-GB' };

/** Gold amounts, grouped the way the language expects (1 250 000 / 1,250,000). */
export function formatGold(amount: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale[locale], { maximumFractionDigits: 0 }).format(amount);
}

/** Percentages from 0..100 values. */
export function formatPercent(value: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale[locale], { style: 'percent', maximumFractionDigits: 0 }).format(value / 100);
}

/** "3 seconds ago" / "il y a 3 secondes", in the largest fitting unit. */
export function formatAgo(seconds: number, locale: Locale): string {
  const format = new Intl.RelativeTimeFormat(intlLocale[locale], { numeric: 'auto' });
  if (seconds < 60) {
    return format.format(-Math.round(seconds), 'second');
  }
  if (seconds < 3600) {
    return format.format(-Math.round(seconds / 60), 'minute');
  }
  if (seconds < 86_400) {
    return format.format(-Math.round(seconds / 3600), 'hour');
  }
  return format.format(-Math.round(seconds / 86_400), 'day');
}

/** Clock time of a timestamp (14:05:09), for log lines. */
export function formatClock(at: number, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale[locale], { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(at);
}
