import { useState } from 'react';
import type { Profile, Catalog, Character } from '../../../shared/schema';
import { profileSchema } from '../../../shared/schema';
import { cautiousProfile } from '../../../shared/onboarding';
import { api } from '../../api/client';
import { Button, Field, SelectInput, TextInput, Toggle } from '../ui';
import styles from './FirstRunWizard.module.scss';

type Owned = { name: string; ctype: Character['ctype']; level: number };
type Choice = Owned & { enabled: boolean; script: string; follow: string };
/** Stage a reviewable draft using account-owned characters; saving/deploying stays explicit. */
export function FirstRunWizard({ profile, catalog, dirty, pending, onChange }: { profile: Profile; catalog: Catalog; dirty: boolean; pending: boolean; onChange: (p: Profile) => void }) {
  const [open, setOpen] = useState(!profile.onboardingComplete);
  const [step, setStep] = useState(1), [secret, setSecret] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [choices, setChoices] = useState<Choice[]>([]);
  const [server, setServer] = useState<Profile['server']>({region:'EU',name:'I'});
  const [monster, setMonster] = useState('goo');
  function scriptsFor(ctype: string) { return catalog.scripts.filter(s => s.ctype === ctype); }
  async function connect() {
    setBusy(true); setError('');
    try {
      const result = await api<{connected: boolean; characters: Owned[]}>('/api/onboarding/connect', secret.trim() ? {token:secret.trim()} : {});
      setChoices(result.characters.map(c => ({ ...c, enabled:false, follow:'', script:scriptsFor(c.ctype).find(s => s.id.endsWith('-v2') && !s.id.includes('crab'))?.id ?? scriptsFor(c.ctype)[0]?.id ?? '' })));
      setSecret(''); setStep(2);
    } catch (e) { setError(e instanceof Error ? e.message : 'Connection failed'); } finally { setBusy(false); }
  }
  function patch(name: string, change: Partial<Choice>) { setChoices(rows => rows.map(c => c.name === name ? {...c,...change}:c)); }
  function stage() {
    try {
      const p = cautiousProfile(profile);
      p.onboardingComplete = true; p.server = server; p.farming.defaultMonster = monster;
      p.characters = choices.filter(c => c.enabled).map(c => ({name:c.name,ctype:c.ctype,script:c.script,follow:c.follow,enabled:true,runtime:'browser',events:false,job:'hunt',farmMonster:'',overrides:{}}));
      onChange(profileSchema.parse(p)); setOpen(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Check the team configuration'); }
  }
  const selected = choices.filter(c => c.enabled);
  const validTeam = selected.length > 0 && selected.every(c => scriptsFor(c.ctype).some(s => s.id === c.script) && (!c.follow || selected.some(other => other.name === c.follow && other.name !== c.name)));
  return <section className={styles.panel} aria-label="First farming setup">
    <div className={styles.heading}><h2>First farming setup</h2><Button size="small" variant="ghost" disabled={pending} onClick={() => setOpen(!open)}>{open ? 'Close setup' : 'Open setup assistant'}</Button></div>
    {open && <>
      <p>Connect → choose team → review a cautious draft. Existing settings stay intact until you stage and save the replacement. This assistant never deploys CODE.</p>
      <ol className={styles.steps}><li aria-current={step===1?'step':undefined}>Account</li><li aria-current={step===2?'step':undefined}>Team & server</li><li aria-current={step===3?'step':undefined}>Review</li></ol>
      {dirty && <p role="alert">Save or discard your existing edits before staging a starter profile.</p>}
      {step === 1 && <div className={styles.grid}>
        <p>Create or reveal your Adventure Land MCP token in <a href="https://adventure.land/mainframe" target="_blank" rel="noreferrer">Mainframe</a>. Use a token, not your game password. Leave this field empty to test the server's existing credential.</p>
        <Field label="MCP token (optional if already configured)" htmlFor="setup-token"><TextInput id="setup-token" type="password" autoComplete="off" value={secret} onChange={setSecret} disabled={busy} /></Field>
        <p>A verified token is saved in the local dashboard data directory, outside the profile and repository. Keep that directory private; Windows file permissions follow your user account. AL_MCP_TOKEN takes priority.</p>
        <Button disabled={busy || pending} onClick={connect}>{busy?'Checking account…':'Connect and discover characters'}</Button>
      </div>}
      {step === 2 && <>
        <div className={styles.grid}>
          <Field label="Home region" htmlFor="setup-region"><SelectInput id="setup-region" value={server.region} onChange={v=>setServer({...server,region:v as Profile['server']['region']})} options={['EU','US','ASIA'].map(v=>({value:v,label:v}))} /></Field>
          <Field label="Home server" htmlFor="setup-server"><SelectInput id="setup-server" value={server.name} onChange={v=>setServer({...server,name:v as Profile['server']['name']})} options={['I','II','III'].map(v=>({value:v,label:v}))} /></Field>
          <Field label="First farming monster" htmlFor="setup-monster"><SelectInput id="setup-monster" value={monster} onChange={setMonster} options={catalog.monsters.filter(m => ['goo','crab','bee'].includes(m.id)).map(m=>({value:m.id,label:m.name}))} /></Field>
        </div>
        <p>Select only characters you want to deploy. Roles follow their actual game classes. Open them manually on this server before deployment. Dedicated crab scripts keep their own target; select a general v2 script to use the monster above.</p>
        {!choices.length && <p>No supported characters found on this account.</p>}
        <div className={styles.roster}>{choices.map(c=><article key={c.name}>
          <Toggle label={`${c.name} · ${c.ctype} · level ${c.level}`} value={c.enabled} onChange={enabled=>patch(c.name,{enabled})} />
          <Field label="Script" htmlFor={`setup-script-${c.name}`}><SelectInput id={`setup-script-${c.name}`} value={c.script} disabled={!c.enabled} onChange={script=>patch(c.name,{script})} options={scriptsFor(c.ctype).map(s=>({value:s.id,label:s.label}))} /></Field>
          {c.ctype !== 'merchant' && <Field label="Follow / leader" htmlFor={`setup-follow-${c.name}`}><SelectInput id={`setup-follow-${c.name}`} value={c.follow} disabled={!c.enabled} onChange={follow=>patch(c.name,{follow})} options={[{value:'',label:'Independent / leader'},...selected.filter(other=>other.name!==c.name && other.ctype!=='merchant').map(other=>({value:other.name,label:other.name}))]} /></Field>}
        </article>)}</div>
        <div className={styles.actions}><Button variant="ghost" onClick={()=>setStep(1)}>Back</Button><Button disabled={!validTeam} onClick={()=>setStep(3)}>Review starter profile</Button></div>
      </>}
      {step === 3 && <>
        <p><strong>{selected.map(c=>c.name).join(' · ')}</strong> on {server.region} {server.name}; farm target: {monster}.</p>
        <p>Disabled: wishlist buys, NPC sales, stand, upgrades, crafting, Ponty, exchanges, bank deposits, equipment delivery and auto-start. Hunts, world events, rare bosses and Cave Dreams are also disabled. Potion use and script safety routines remain active; this is not a guarantee of zero spending or zero risk.</p>
        <p>Staging replaces the team and automation settings in the editor. Save profile next, inspect Deployment preview, then deploy explicitly. Existing running CODE is unaffected until you deploy or stop it.</p>
        <div className={styles.actions}><Button variant="ghost" onClick={()=>setStep(2)}>Back</Button><Button disabled={dirty||pending||!validTeam} onClick={stage}>Stage cautious profile</Button></div>
      </>}
      {error && <p role="alert">{error}</p>}
    </>}
  </section>;
}

