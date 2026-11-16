/**
 * Header language switcher: a button showing the current flag and native language name, opening a listbox.
 * Inspired by freeflags.org's switcher, drawn in the app's notched-slot style (docs/DESIGN.md).
 * Keyboard: Enter/Space/ArrowDown open; arrows, Home, End move; Enter/Space choose; Escape/Tab close.
 */
import type { JSX } from 'solid-js';
import { For, Show } from 'solid-js';
import { locale, LOCALES, t } from '../i18n/i18n.ts';
import { Flag } from './Flag.tsx';
import { createLanguageMenu } from './language-menu.ts';
import './LanguageSwitcher.css';

export function LanguageSwitcher(): JSX.Element {
  const menu = createLanguageMenu();
  return (
    <div class="language-switcher" ref={(element) => { menu.setRoot(element); }}>
      <button
        ref={(element) => { menu.setButton(element); }}
        type="button"
        class="language-current"
        aria-haspopup="listbox"
        aria-expanded={menu.open()}
        aria-label={t('common.currentLanguage', { name: t(`languages.${locale()}`) })}
        onClick={() => { menu.toggle(); }}
        onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); menu.show(); } }}
      >
        <Flag locale={locale()} />
        <span>{t(`languages.${locale()}`)}</span>
        <span class="chevron" aria-hidden="true" />
      </button>
      <Show when={menu.open()}>
        <ul ref={(element) => { menu.setList(element); }} class="language-list slot" role="listbox" tabindex="-1"
          aria-label={t('common.language')} aria-activedescendant={`language-option-${LOCALES[menu.active()] ?? ''}`}
          onKeyDown={(event) => { menu.onListKey(event); }}>
          <For each={LOCALES}>
            {(code, index) => (
              <li id={`language-option-${code}`} role="option" aria-selected={code === locale()}
                classList={{ active: index() === menu.active() }}
                onMouseEnter={() => { menu.setActive(index()); }} onClick={() => { menu.choose(code); }}>
                <Flag locale={code} />
                <span>{t(`languages.${code}`)}</span>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
}
