import { useState } from 'react';
import { profileSchema, type Profile } from '../../../shared/schema';
import { applyTeamComposition, type TeamMode } from '../../models/team-composition';
import { Button, Card, Field, SelectInput, TextInput } from '../ui';

const STORAGE = 'alcc:team-compositions:v1';
interface Preset { name: string; profile: Profile; }

export function TeamComposition({ profile, disabled, onChange }: { profile?: Profile; disabled: boolean; onChange: (profile: Profile) => void }) {
  const [mode, setMode] = useState<TeamMode>('solo');
  const [target, setTarget] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [presets, setPresets] = useState<Preset[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE) || '[]').filter((entry: Preset) => typeof entry.name === 'string' && profileSchema.safeParse(entry.profile).success); } catch { return []; }
  });
  const farmers = profile?.characters.filter(character => character.ctype !== 'merchant') ?? [];
  const selected = target || farmers.find(character => character.enabled && profile?.seller.teamSupervisor.characters.includes(character.name))?.name || farmers.find(character => character.enabled)?.name || farmers[0]?.name || '';
  const stage = () => { if (!profile) return; try { onChange(applyTeamComposition(profile, mode, selected)); setError(''); } catch (cause) { setError((cause as Error).message); } };
  const save = () => {
    if (!profile || !name.trim()) return;
    const next = [...presets.filter(entry => entry.name !== name.trim()), { name: name.trim(), profile: structuredClone(profile) }].slice(-12);
    try { localStorage.setItem(STORAGE, JSON.stringify(next)); setPresets(next); setName(''); setError(''); } catch { setError('Unable to save this preset in browser storage.'); }
  };
  const restore = (preset: Preset) => {
    if (!profile) return;
    // Restore composition policy only: equipment, commerce and server stay current.
    const next = structuredClone(profile);
    next.characters = next.characters.map(character => {
      const saved = preset.profile.characters.find(entry => entry.name === character.name);
      return saved ? { ...character, enabled: saved.enabled, follow: saved.follow, events: saved.events } : character;
    });
    next.seller.teamSupervisor = structuredClone(preset.profile.seller.teamSupervisor);
    next.farming.dailyDungeon = preset.profile.farming.dailyDungeon;
    next.farming.hunts = preset.profile.farming.hunts;
    next.farming.rareVisits = preset.profile.farming.rareVisits;
    next.farming.bossChecks.enabled = preset.profile.farming.bossChecks.enabled;
    next.events.enabled = preset.profile.events.enabled;
    try { onChange(profileSchema.parse(next)); setError(''); } catch (cause) { setError((cause as Error).message); }
  };
  return <Card title="Team composition">
    <p>Stage changes, inspect the roster, then save and preview deployment. Excluded characters already online must be stopped from the roster.</p>
    <Field label="Mode" htmlFor="team-mode"><SelectInput id="team-mode" value={mode} disabled={disabled} onChange={value => setMode(value as TeamMode)} options={[{ value: 'solo', label: 'Solo farmer' }, { value: 'team', label: 'Full farming team' }, { value: 'cave', label: 'Cave Dreams · three farmers' }]} /></Field>
    <Field label="Solo character" htmlFor="team-solo"><SelectInput id="team-solo" value={selected} disabled={disabled || mode !== 'solo'} onChange={setTarget} options={farmers.map(character => ({ value: character.name, label: `${character.name} · ${character.ctype}` }))} /></Field>
    <Button disabled={disabled || !profile} onClick={stage}>Stage composition</Button>
    <p>{profile?.characters.filter(character => character.enabled).map(character => `${character.name}${character.follow ? ` → ${character.follow}` : ''}`).join(' · ')}</p>
    <Field label="Save current composition as" htmlFor="team-preset"><TextInput id="team-preset" value={name} onChange={setName} /></Field>
    <Button disabled={disabled || !name.trim()} onClick={save}>Save local preset</Button>
    {presets.map(preset => <Button key={preset.name} variant="ghost" disabled={disabled} onClick={() => restore(preset)}>{preset.name}</Button>)}
    {error && <p role="alert">{error}</p>}
  </Card>;
}
