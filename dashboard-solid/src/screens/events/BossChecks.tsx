/** Recurring boss checks: which timed world bosses the party walks to, and how often. */
import type { JSX } from 'solid-js';
import { For, Index, Show } from 'solid-js';
import type { MonsterSummary } from '../../../shared/game.ts';
import { WORLD_BOSSES } from '../../../shared/events.ts';
import { t } from '../../i18n/i18n.ts';
import type { BossRule } from '../../profile/event-draft.ts';
import { setBossChecks } from '../../profile/event-draft.ts';
import type { ProfileState } from '../../profile/profile-state.ts';
import { FrameImage } from '../../ui/FrameImage.tsx';
import type { EventLook } from './event-names.ts';
import { eventLook } from './event-names.ts';
import type { EventsView } from './event-view.ts';
import { intervalsWith, nextBossRule, replaceRule } from './event-view.ts';

export interface BossChecksProps {
  readonly view: EventsView;
  readonly monsters: ReadonlyMap<string, MonsterSummary>;
  readonly profile: ProfileState;
}

function Rule(props: BossChecksProps & { readonly rule: BossRule; readonly index: number }): JSX.Element {
  const look = (): EventLook => eventLook(props.rule.boss, props.monsters);
  const replace = (rule: BossRule | null): void => {
    const rules = replaceRule(props.view.checks.rules, props.index, rule);
    props.profile.edit((draft) => setBossChecks(draft, { rules }));
  };
  // A boss already checked by another rule is not offered twice.
  const bosses = (): string[] => [props.rule.boss, ...WORLD_BOSSES.filter((id) => id !== props.rule.boss && !props.view.checks.rules.some((rule) => rule.boss === id))];
  return (
    <li class="boss-rule">
      <FrameImage frame={look().sprite} box={32} />
      <select aria-label={t('events.boss')} value={props.rule.boss} onChange={(event) => { replace({ ...props.rule, boss: event.currentTarget.value }); }}>
        <For each={bosses()}>{(id) => <option value={id}>{eventLook(id, props.monsters).name}</option>}</For>
      </select>
      <label class="boss-every">
        <span>{t('events.every')}</span>
        <select value={props.rule.everyMinutes} onChange={(event) => { replace({ ...props.rule, everyMinutes: Number(event.currentTarget.value) }); }}>
          <For each={intervalsWith(props.rule.everyMinutes)}>{(minutes) => <option value={minutes}>{t('events.duration', minutes)}</option>}</For>
        </select>
      </label>
      <button type="button" class="quiet" aria-label={t('events.remove', { name: look().name })} onClick={() => { replace(null); }}>{t('events.removeShort')}</button>
    </li>
  );
}

export function BossChecks(props: BossChecksProps): JSX.Element {
  const add = (): void => {
    const rule = nextBossRule(props.view.checks.rules);
    if (rule !== null) {
      const rules = [...props.view.checks.rules, rule];
      props.profile.edit((draft) => setBossChecks(draft, { rules }));
    }
  };
  return (
    <section aria-labelledby="events-checks">
      <h3 id="events-checks">{t('events.checks')}</h3>
      <label class="events-check">
        <input type="checkbox" checked={props.view.checks.enabled} aria-describedby="events-checks-help"
          onChange={(event) => { const enabled = event.currentTarget.checked; props.profile.edit((draft) => setBossChecks(draft, { enabled })); }} />
        {t('events.checksToggle')}
      </label>
      <p id="events-checks-help" class="dim">{t('events.checksHelp')}</p>
      <Show when={props.view.checks.rules.length > 0} fallback={<p class="dim">{t('events.noRules')}</p>}>
        <ul class="boss-rules"><Index each={props.view.checks.rules}>{(rule, index) => <Rule {...props} rule={rule()} index={index} />}</Index></ul>
      </Show>
      <Show when={nextBossRule(props.view.checks.rules) !== null}>
        <div class="events-actions"><button type="button" onClick={add}>{t('events.add')}</button></div>
      </Show>
    </section>
  );
}
