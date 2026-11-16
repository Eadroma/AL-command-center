/**
 * Farming targets, opened from the Team screen: the team target, rare visits, and each character's own target.
 * Characters whose script pins its target (FIXED_FARM) are marked and cannot be changed here. Edits go to the
 * profile draft (Save / Discard); they reach the game at the next deployment.
 */
import type { Accessor, JSX } from 'solid-js';
import { createEffect, createResource, Index, Show } from 'solid-js';
import type { MonsterSummary } from '../../../shared/game.ts';
import { monstersSchema } from '../../../shared/game.ts';
import type { ProfileCharacter } from '../../../shared/profile.ts';
import { field, text, truthy } from '../../../shared/raw.ts';
import type { ScriptsResponse } from '../../../shared/scripts.ts';
import { scriptsResponseSchema } from '../../../shared/scripts.ts';
import { apiGet } from '../../api/http.ts';
import type { Choice } from '../../ui/choices.ts';
import { t } from '../../i18n/i18n.ts';
import type { FarmingPatch } from '../../profile/draft.ts';
import { patchFarming, setCharacterTarget } from '../../profile/draft.ts';
import type { ProfileState } from '../../profile/profile-state.ts';
import { className } from '../settings/Roster.tsx';
import { SaveRow } from '../profile/SaveRow.tsx';
import { ChoiceField } from '../../ui/ChoiceField.tsx';
import { resolveChoice } from '../../ui/choices.ts';
import { monsterChoice } from './monsters.ts';
import './FarmingDialog.css';

export interface FarmingDialogProps {
  readonly open: boolean;
  readonly profile: ProfileState;
  readonly onClose: () => void;
}

interface Catalogues {
  readonly monsters: Accessor<readonly MonsterSummary[]>;
  /** The monsters as choice lines (sprite, name, HP / XP / maps), in the current language. */
  readonly choices: Accessor<readonly Choice[]>;
  readonly scripts: Accessor<ScriptsResponse>;
}

function createCatalogues(): Catalogues {
  const [monsters] = createResource(() => apiGet('/api/game/monsters', monstersSchema));
  const [scripts] = createResource(() => apiGet('/api/scripts', scriptsResponseSchema));
  return {
    monsters: () => { const result = monsters(); return result?.ok === true ? result.value.monsters : []; },
    choices: () => { const result = monsters(); return result?.ok === true ? result.value.monsters.map(monsterChoice) : []; },
    scripts: () => { const result = scripts(); return result?.ok === true ? result.value : { scripts: [], monoTargets: [] }; },
  };
}

function CharacterTarget(props: { readonly character: ProfileCharacter; readonly catalogues: Catalogues; readonly profile: ProfileState }): JSX.Element {
  const fixed = (): string | null => props.catalogues.scripts().scripts.find((script) => script.id === props.character.script)?.fixedFarm ?? null;
  const name = (key: string): string => resolveChoice(key, props.catalogues.monsters())?.name ?? key;
  const teamHint = (): string => `${t('farming.useTeam')} : ${name(text(field(props.profile.draft()?.profile['farming'], 'defaultMonster')))}`;
  return (
    <li class="farming-character">
      <div>
        <strong>{props.character.name}</strong>
        <span class="dim">{` ${className(props.character.ctype)} · ${props.character.script === '' ? t('profile.scriptNone') : props.character.script}`}</span>
      </div>
      <Show when={fixed()} fallback={
        <ChoiceField id={`farm-${props.character.name}`} label={t('farming.own')} value={props.character.farmMonster} choices={props.catalogues.choices()} allowEmpty emptyHint={teamHint()}
          searchHelp={t('farming.searchHelp')} unknownText={t('farming.unknown')}
          onChange={(key) => { const target = { name: props.character.name, monster: key }; const mono = props.catalogues.scripts().monoTargets; props.profile.edit((draft) => setCharacterTarget(draft, target, mono)); }} />
      }>
        {(monster) => <p class="farming-fixed"><strong>{t('farming.fixed', { monster: name(monster()) })}</strong><br /><span class="dim">{t('farming.fixedHelp')}</span></p>}
      </Show>
    </li>
  );
}

function TeamSettings(props: { readonly catalogues: Catalogues; readonly profile: ProfileState }): JSX.Element {
  const farming = (): unknown => props.profile.draft()?.profile['farming'];
  const teamTarget = (): string => text(field(farming(), 'defaultMonster'));
  const rareVisits = (): boolean => truthy(field(farming(), 'rareVisits'));
  const edit = (patch: FarmingPatch): void => { const mono = props.catalogues.scripts().monoTargets; props.profile.edit((draft) => patchFarming(draft, patch, mono)); };
  return (
    <section aria-labelledby="farming-team">
      <h3 id="farming-team">{t('farming.team')}</h3>
      <p class="dim">{t('farming.teamHelp')}</p>
      <ChoiceField id="farm-team" label={t('farming.search')} value={teamTarget()} choices={props.catalogues.choices()} allowEmpty={false}
        searchHelp={t('farming.searchHelp')} unknownText={t('farming.unknown')}
        onChange={(key) => { edit({ defaultMonster: key }); }} />
      <label class="farming-check">
        <input type="checkbox" checked={rareVisits()} aria-describedby="farming-rare-help"
          onChange={(event) => { edit({ rareVisits: event.currentTarget.checked }); }} />
        {t('farming.rareVisits')}
      </label>
      <p id="farming-rare-help" class="dim">{t('farming.rareVisitsHelp')}</p>
    </section>
  );
}

export function FarmingDialog(props: FarmingDialogProps): JSX.Element {
  const catalogues = createCatalogues();
  let dialog: HTMLDialogElement | undefined;
  createEffect(() => {
    if (props.open && dialog?.open === false) {
      dialog.showModal();
    }
    if (!props.open && dialog?.open === true) {
      dialog.close();
    }
  });
  return (
    <dialog ref={(element) => { dialog = element; }} class="farming-dialog slot" aria-labelledby="farming-title" onClose={() => { props.onClose(); }}>
      <header class="farming-head">
        <h2 id="farming-title">{t('farming.title')}</h2>
        <button type="button" class="quiet" onClick={() => { dialog?.close(); }}>{t('farming.close')}</button>
      </header>
      <p class="dim">{t('farming.intro')}</p>
      <Show when={props.profile.draft()} fallback={<p>{t('farming.noProfile')}</p>}>
        {(draft) => (
          <>
            <Show when={catalogues.monsters().length > 0} fallback={<p class="dim">{t('farming.loading')}</p>}>
              <TeamSettings catalogues={catalogues} profile={props.profile} />
              <section aria-labelledby="farming-characters">
                <h3 id="farming-characters">{t('farming.characters')}</h3>
                {/* Index keeps each row (and the field being typed in) while the draft changes; For would rebuild it. */}
                <ul class="farming-list"><Index each={draft().profile.characters}>{(character) => <CharacterTarget character={character()} catalogues={catalogues} profile={props.profile} />}</Index></ul>
              </section>
            </Show>
            <Show when={props.profile.dirty()}><SaveRow state={props.profile} /></Show>
          </>
        )}
      </Show>
    </dialog>
  );
}
