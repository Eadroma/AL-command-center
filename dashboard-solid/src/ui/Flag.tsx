/**
 * Round flag icons drawn locally (no external files). Colours are the official flag colours,
 * which is content, not theme. Decorative: the language name next to it carries the meaning.
 */
import type { JSX } from 'solid-js';
import { createUniqueId, Match, Switch } from 'solid-js';
import type { Locale } from '../i18n/i18n.ts';

function France(): JSX.Element {
  return (
    <>
      <rect width="10" height="30" fill="#0055a4" />
      <rect x="10" width="10" height="30" fill="#fff" />
      <rect x="20" width="10" height="30" fill="#ef4135" />
    </>
  );
}

/** Union Jack, cropped on its centre to fit a circle. */
function UnitedKingdom(): JSX.Element {
  const diagonalClip = createUniqueId();
  return (
    <g transform="translate(-15 0)">
      <clipPath id={diagonalClip}><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" /></clipPath>
      <rect width="60" height="30" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" stroke-width="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#c8102e" stroke-width="4" clip-path={`url(#${diagonalClip})`} />
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" stroke-width="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#c8102e" stroke-width="6" />
    </g>
  );
}

export function Flag(props: { readonly locale: Locale }): JSX.Element {
  const circle = createUniqueId();
  return (
    <svg class="flag" viewBox="0 0 30 30" width="20" height="20" aria-hidden="true">
      <clipPath id={circle}><circle cx="15" cy="15" r="15" /></clipPath>
      <g clip-path={`url(#${circle})`}>
        <Switch>
          <Match when={props.locale === 'fr'}><France /></Match>
          <Match when={props.locale === 'en'}><UnitedKingdom /></Match>
        </Switch>
      </g>
    </svg>
  );
}
