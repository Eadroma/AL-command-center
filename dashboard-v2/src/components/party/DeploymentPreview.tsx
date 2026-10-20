import { useState } from 'react';
import { api } from '../../api/client';
import { Badge, Button, Card } from '../ui';

interface Preview { version: number; characters: Array<{ name: string; runtime?: string; script?: string; sourceChanged?: boolean; comparison?: string; error?: string; changes?: Array<{ key: string; before: unknown; after: unknown }>; warnings?: string[] }> }
const value = (input: unknown) => input === undefined ? 'Unknown / absent' : JSON.stringify(input);

export function DeploymentPreview({ version, disabled, onDeploy }: { version?: number; disabled: boolean; onDeploy?: (name: string) => void }) {
  const [preview, setPreview] = useState<Preview>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = async () => { setBusy(true); setError(''); setPreview(undefined); try { setPreview(await api<Preview>('/api/deploy-preview', { version })); } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); } };
  const current = preview?.version === version && !disabled;
  return <Card title="Deployment preview">
    <p>Compare the saved profile with the saved game CODE slots before restarting characters. Source changes are indicated separately.</p>
    <Button disabled={disabled || busy || version === undefined} onClick={() => void load()}>{busy ? 'Inspecting CODE slots…' : 'Preview saved deployment'}</Button>
    {error && <p role="alert">{error}</p>}
    {preview && !current && <p>Save your edits and refresh this preview before deploying.</p>}
    {preview?.characters.map(character => <details key={character.name}><summary>{character.name} · {character.changes?.length ?? 0} changes {character.sourceChanged && <Badge variant="warning">Source changed</Badge>}</summary>
      <p>{character.error || `${character.script} · ${character.runtime} · ${character.comparison}`}</p>
      {character.changes?.map(change => <div key={change.key}><strong>{change.key}</strong><p style={{ overflowWrap: 'anywhere' }}>{value(change.before)} → {value(change.after)}</p></div>)}
      {character.warnings?.map(warning => <p key={warning}>{warning}</p>)}
      {onDeploy && <Button disabled={!current || busy || !!character.error} onClick={() => onDeploy(character.name)}>Deploy {character.name}</Button>}
    </details>)}
  </Card>;
}
