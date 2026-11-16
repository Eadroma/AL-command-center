/**
 * State and behaviour of the language switcher: open/close, active option, keyboard, outside click.
 * Kept out of the component so the component only lays out the button and the list.
 */
import type { Accessor } from 'solid-js';
import { createSignal, onCleanup } from 'solid-js';
import type { Locale } from '../i18n/i18n.ts';
import { locale, LOCALES, setLocale } from '../i18n/i18n.ts';
import { listboxAction } from './listbox-keys.ts';

export interface LanguageMenu {
  readonly open: Accessor<boolean>;
  readonly active: Accessor<number>;
  readonly setActive: (index: number) => void;
  readonly toggle: () => void;
  readonly show: () => void;
  readonly choose: (code: Locale) => void;
  readonly onListKey: (event: KeyboardEvent) => void;
  readonly setRoot: (element: HTMLElement) => void;
  readonly setButton: (element: HTMLButtonElement) => void;
  readonly setList: (element: HTMLUListElement) => void;
}

export function createLanguageMenu(): LanguageMenu {
  const [open, setOpen] = createSignal(false);
  const [active, setActive] = createSignal(0);
  const elements: { root?: HTMLElement; button?: HTMLButtonElement; list?: HTMLUListElement } = {};

  const show = (): void => {
    setActive(Math.max(LOCALES.indexOf(locale()), 0));
    setOpen(true);
    queueMicrotask(() => elements.list?.focus());
  };
  const hide = (refocus: boolean): void => {
    setOpen(false);
    if (refocus) {
      elements.button?.focus();
    }
  };
  const choose = (code: Locale): void => {
    setLocale(code);
    hide(true);
  };
  const onListKey = (event: KeyboardEvent): void => {
    const action = listboxAction(event.key, active(), LOCALES.length);
    if (action.kind === 'none') {
      return;
    }
    event.preventDefault();
    const code = LOCALES[active()];
    if (action.kind === 'move') {
      setActive(action.index);
    } else if (action.kind === 'select' && code !== undefined) {
      choose(code);
    } else if (action.kind === 'close') {
      hide(event.key === 'Escape');
    }
  };
  const onDocumentClick = (event: MouseEvent): void => {
    if (open() && event.target instanceof Node && elements.root?.contains(event.target) === false) {
      hide(false);
    }
  };
  document.addEventListener('click', onDocumentClick);
  onCleanup(() => { document.removeEventListener('click', onDocumentClick); });

  return {
    open, active, setActive, show, choose, onListKey,
    toggle: () => { if (open()) { hide(false); } else { show(); } },
    setRoot: (element) => { elements.root = element; },
    setButton: (element) => { elements.button = element; },
    setList: (element) => { elements.list = element; },
  };
}
