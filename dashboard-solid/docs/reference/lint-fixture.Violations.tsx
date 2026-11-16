/** Deliberately wrong file: every line below must be reported by the linter. */
import type { JSX } from 'solid-js';
import { fetchGameData } from '../../server/game-data.ts';

declare function notify(message: string): void;

export interface BadProps {
  readonly name: string;
  readonly items: readonly string[];
  readonly loose: any;
}

export default function Violations({ name, items }: BadProps): JSX.Element {
  const maybe: string | undefined = items[0];
  fetch('/api/health');
  notify('Saved!');
  if (maybe) {
    console.log(maybe!.length == 3);
  }
  const value = maybe as string;
  return (
    <div class="violations" title="Hover text">
      Hello {name} {value}
      {items.length > 0 && <span>Has items</span>}
      {items.map((item) => <i>{item}</i>)}
      <img src="x.png" alt="Character portrait" />
      <p>{String(fetchGameData)}</p>
    </div>
  );
}
