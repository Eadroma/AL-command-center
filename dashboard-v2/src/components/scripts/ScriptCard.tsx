import type { Character, ScriptInfo } from '../../types';
import { Badge, Card } from '../ui';
import styles from './ScriptCard.module.scss';

export interface ScriptCardProps { script: ScriptInfo; characters: Character[]; }

/** Read-only imported metadata and defaults; no source code is executed by this view. */
export function ScriptCard({ script, characters }: ScriptCardProps) {
  const assigned = characters.filter(character => character.script === script.id);
  return (
    <Card title={script.label} headerActions={<Badge variant="info">{script.ctype}</Badge>}>
      <dl className={styles.metadata}>
        <dt>File</dt><dd>{script.filename}</dd>
        <dt>Type</dt><dd>{script.kind}</dd>
        <dt>Size</dt><dd>{(script.bytes / 1024).toFixed(1)} KiB</dd>
        <dt>Saved assignments</dt><dd>{assigned.length ? assigned.map(character => `${character.name}${character.enabled ? '' : ' (disabled)'}`).join(', ') : 'Unassigned'}</dd>
        <dt>SHA-256</dt><dd><code>{script.hash}</code></dd>
      </dl>
      <details className={styles.details}>
        <summary>Imported CONFIG ({Object.keys(script.config).length} keys)</summary>
        <pre>{JSON.stringify(script.config, null, 2)}</pre>
      </details>
      <details className={styles.details}>
        <summary>Detected variables ({Object.keys(script.variables).length} keys)</summary>
        <pre>{JSON.stringify(script.variables, null, 2)}</pre>
      </details>
    </Card>
  );
}
