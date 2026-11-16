/** Region and server pickers, filled from the live server list once the connection is tested. */
import type { JSX } from 'solid-js';
import { For, Show } from 'solid-js';
import type { GameServer } from '../../../shared/account.ts';
import { t } from '../../i18n/i18n.ts';
import { regionsOf, serversIn } from './settings-form.ts';

export interface ServerFieldsProps {
  readonly servers: readonly GameServer[];
  readonly region: string;
  readonly server: string;
  readonly onChange: (region: string, server: string) => void;
}

export function ServerFields(props: ServerFieldsProps): JSX.Element {
  const regions = (): string[] => (props.servers.length > 0 ? regionsOf(props.servers) : [props.region]);
  const names = (): GameServer[] => {
    const list = serversIn(props.servers, props.region);
    return list.length > 0 ? list : [{ region: props.region, name: props.server, online: true, players: 0 }];
  };
  return (
    <>
      <div class="row">
        <label class="stacked">
          <span>{t('settings.region')}</span>
          <select id="settings-region" onChange={(event) => {
            const region = event.currentTarget.value;
            props.onChange(region, serversIn(props.servers, region)[0]?.name ?? props.server);
          }}>
            <For each={regions()}>{(region) => <option value={region} selected={region === props.region}>{region}</option>}</For>
          </select>
        </label>
        <label class="stacked">
          <span>{t('settings.server')}</span>
          <select id="settings-server" onChange={(event) => { props.onChange(props.region, event.currentTarget.value); }}>
            <For each={names()}>
              {(server) => (
                <option value={server.name} selected={server.name === props.server}>
                  {server.online ? server.name : t('settings.serverOffline', { name: server.name })}
                </option>
              )}
            </For>
          </select>
        </label>
      </div>
      <Show when={props.servers.length === 0}><p class="help">{t('settings.serverHint')}</p></Show>
    </>
  );
}
