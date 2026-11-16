/** Header badge for the /live connection: green square live, blue connecting, red offline (game colours). */
import type { Accessor, JSX } from 'solid-js';
import type { Connection } from '../api/live.ts';
import { t } from '../i18n/i18n.ts';
import './ConnectionBadge.css';

const labels = {
  open: () => t('team.connectionOpen'),
  connecting: () => t('team.connectionConnecting'),
  closed: () => t('team.connectionClosed'),
} as const;

export function ConnectionBadge(props: { readonly connection: Accessor<Connection> }): JSX.Element {
  return (
    <span class={`connection connection-${props.connection()}`} role="status">
      {labels[props.connection()]()}
    </span>
  );
}
