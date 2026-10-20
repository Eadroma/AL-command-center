import { useState } from 'react';
import type { IncidentReplay as Capture } from '../../types/incident-replay';
import { SelectInput } from '../ui';
import styles from './IncidentReplay.module.scss';

function ReplayFrames({ capture }: { capture: Capture }) {
  const [index, setIndex] = useState(Math.max(0, capture.frames.length - 1));
  const frame = capture.frames[index];
  if (!frame) return <p>No reports available around this incident. Capture started after the event or telemetry was interrupted.</p>;
  return <>
    <p>{capture.detail}</p>
    <label className={styles.scrubber}>Report {index + 1} / {capture.frames.length} · {new Date(frame.at).toLocaleTimeString()}
      <input type="range" min={0} max={capture.frames.length - 1} value={index} onChange={event => setIndex(Number(event.target.value))} />
    </label>
    {index > 0 && frame.at - capture.frames[index - 1].at > 10000 ? <p className={styles.warning}>Telemetry gap before this report: {Math.round((frame.at - capture.frames[index - 1].at) / 1000)}s.</p> : null}
    <dl className={styles.details}>
      <div><dt>Position</dt><dd>{frame.map} · {Math.round(frame.x)}, {Math.round(frame.y)}</dd></div>
      <div><dt>HP / MP</dt><dd>{frame.hp}/{frame.maxHp} HP · {frame.mp}/{frame.maxMp} MP</dd></div>
      <div><dt>Target</dt><dd>{frame.target || 'None reported'}</dd></div>
      <div><dt>Intent</dt><dd>{frame.intent || 'Unavailable'}</dd></div>
      <div><dt>Decision</dt><dd>{frame.reason || 'Unavailable on this bundle'}</dd></div>
      <div><dt>Blocker</dt><dd>{frame.blockedBy || "None reported"}</dd></div>
      <div><dt>Transaction</dt><dd>{frame.transaction || "None reported"}</dd></div>
      <div><dt>Equipment</dt><dd>{frame.equipment?.map(item => `${item.slot}: ${item.name} +${item.level}`).join(" · ") || "Unavailable on this capture"}</dd></div>
      <div><dt>Server</dt><dd>{frame.server || "Unavailable"}</dd></div>
      <div><dt>Movement</dt><dd>{frame.movement || 'Unavailable'}</dd></div>
    </dl>
    {frame.actions.length ? <ol className={styles.actions}>{frame.actions.map((action, i) => <li key={`${action.at}:${i}`}><time>{new Date(action.at).toLocaleTimeString()}</time> · {action.action} · {action.result}</li>)}</ol> : <p>No action history in this report.</p>}
  </>;
}

export function IncidentReplay({ captures }: { captures: Capture[] }) {
  const [selected, setSelected] = useState('');
  const capture = captures.find(item => item.id === selected) ?? captures.at(-1);
  return <details className={styles.replay}><summary>Replay captured context ({captures.length})</summary>
    <p>Received reports, not a continuous recording. Captures are frozen when evidence arrives and can include the first report after the event.</p>
    {capture ? <>
      <SelectInput aria-label="Incident capture" value={capture.id} onChange={setSelected} options={[...captures].reverse().map(item => ({ value: item.id, label: `${new Date(item.at).toLocaleString()} · ${item.detail}` }))} />
      <ReplayFrames key={capture.id} capture={capture} />
    </> : <p>No capture available. New deaths and navigation stalls are collected by the updated local service.</p>}
  </details>;
}
