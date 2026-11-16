/** HP or MP bar in the game's colours; unknown values show a dash, never an invented number. */
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';
import { percent } from '../screens/team/team-view.ts';
import './Meter.css';

export interface MeterProps {
  readonly label: string;
  readonly value: number | null;
  readonly max: number | null;
  readonly tone: 'hp' | 'mp';
}

export function Meter(props: MeterProps): JSX.Element {
  const ratio = (): number | null => percent(props.value, props.max);
  return (
    <div class={`meter meter-${props.tone}`}>
      <span class="meter-label">{props.label}</span>
      <span class="meter-track" role="meter" aria-label={props.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={ratio() ?? undefined}>
        <span class="meter-fill" style={{ width: `${String(ratio() ?? 0)}%` }} />
      </span>
      <span class="meter-value">
        <Show when={props.value !== null && props.max !== null} fallback="—">{`${String(props.value)}/${String(props.max)}`}</Show>
      </span>
    </div>
  );
}
