/**
 * Merchant screen: the merchant's activities on the left (on / off as the profile says), the chosen one on the right.
 * Edits go to the shared profile draft (Save / Discard); they reach the game at the next deployment.
 * Bags and bank come from GET /api/stock, refreshed with the screen clock.
 */
import type { Accessor, JSX } from 'solid-js';
import { createResource, createSignal, For, Match, Show, Switch } from 'solid-js';
import { loadoutCatalogueSchema } from '../../../shared/loadouts.ts';
import type { LoadoutCatalogue } from '../../../shared/loadouts.ts';
import type { Stock } from '../../../shared/stock.ts';
import { stockSchema } from '../../../shared/stock.ts';
import type { TeamLive } from '../../../shared/telemetry.ts';
import { apiGet } from '../../api/http.ts';
import { formatAgo } from '../../i18n/format.ts';
import { locale, t } from '../../i18n/i18n.ts';
import type { ProfileState } from '../../profile/profile-state.ts';
import { SaveRow } from '../profile/SaveRow.tsx';
import { Consumables } from './Consumables.tsx';
import type { Activity } from './merchant-view.ts';
import { ACTIVITIES, activityOn, EDITABLE } from './merchant-view.ts';
import { ReservedGear } from './ReservedGear.tsx';
import './MerchantScreen.css';

export interface MerchantScreenProps {
  readonly profile: ProfileState;
  readonly team: Accessor<TeamLive | null>;
  readonly now: Accessor<number>;
}

function Supply(props: { readonly profile: ProfileState; readonly stock: Stock | null; readonly catalogue: LoadoutCatalogue | null; readonly now: number }): JSX.Element {
  const newest = (): number | null => {
    const times = [...(props.stock?.characters ?? []).map((entry) => entry.at), ...(props.stock?.bank === null || props.stock?.bank === undefined ? [] : [props.stock.bank.at])];
    return times.length === 0 ? null : Math.max(...times);
  };
  return (
    <>
      <p class="dim stock-age">
        <Show when={newest()} fallback={t('merchant.noStock')}>
          {(at) => t('merchant.stockAge', { when: formatAgo(Math.max(0, (props.now - at()) / 1000), locale()) })}
        </Show>
      </p>
      <ReservedGear profile={props.profile} items={props.catalogue?.items ?? []} stock={props.stock} />
      <Consumables profile={props.profile} supplies={props.catalogue?.supplies ?? []} stock={props.stock} />
    </>
  );
}

export function MerchantScreen(props: MerchantScreenProps): JSX.Element {
  const [activity, setActivity] = createSignal<Activity>('supply');
  const [stock] = createResource(() => props.now(), async () => apiGet('/api/stock', stockSchema));
  const [catalogue] = createResource(async () => apiGet('/api/game/loadout-catalogue', loadoutCatalogueSchema));
  const merchantName = (): string | null => props.profile.draft()?.profile.characters.find((character) => character.ctype === 'merchant')?.name ?? null;
  const live = (): boolean => props.team()?.characters.some((character) => character.name === merchantName() && character.freshness === 'live') === true;
  const stockValue = (): Stock | null => { const result = stock.latest; return result?.ok === true ? result.value : null; };
  const catalogueValue = (): LoadoutCatalogue | null => { const result = catalogue(); return result?.ok === true ? result.value : null; };
  return (
    <section class="merchant" aria-labelledby="merchant-title">
      <header class="merchant-head">
        <h2 id="merchant-title">{t('merchant.title')}</h2>
        <Show when={merchantName()}>{(name) => <span class="merchant-name" classList={{ live: live() }}>{name()}</span>}</Show>
      </header>
      <Show when={props.profile.draft()} fallback={<p class="dim">{props.profile.saved() === undefined ? t('common.loading') : t('merchant.noProfile')}</p>}>
        {(draft) => (
          <Show when={merchantName() !== null} fallback={<p class="dim">{t('merchant.none')}</p>}>
            <div class="merchant-body">
              <nav class="activities" aria-label={t('merchant.activities')}>
                <ul>
                  <For each={ACTIVITIES}>{(entry) => (
                    <li>
                      <button type="button" aria-current={activity() === entry ? 'true' : undefined} classList={{ readonly: !EDITABLE.has(entry) }} onClick={() => setActivity(entry)}>
                        <span>{t(`merchant.activity.${entry}`)}</span>
                        <span class="state" classList={{ on: activityOn(draft().profile, entry) }}>{activityOn(draft().profile, entry) ? t('merchant.on') : t('merchant.off')}</span>
                      </button>
                    </li>
                  )}</For>
                </ul>
              </nav>
              <div class="activity-detail">
                <h3 class="activity-title">{t(`merchant.activity.${activity()}`)}</h3>
                <Switch fallback={<p class="not-yet">{t('merchant.notYet')}</p>}>
                  <Match when={activity() === 'supply'}><Supply profile={props.profile} stock={stockValue()} catalogue={catalogueValue()} now={props.now()} /></Match>
                </Switch>
                <Show when={props.profile.dirty()}><SaveRow state={props.profile} /></Show>
              </div>
            </div>
          </Show>
        )}
      </Show>
    </section>
  );
}
