import { describe, expect, it } from 'vitest';
import { dragoldBoard } from '../src/models/dragold';
import type { DeploymentsResponse } from '../src/types';

const base = { configured: true, caracalAvailable: false, profileVersion: 1, profileServer: { region: 'EU', name: 'III' }, policy: {}, fleet: { ready: true, issues: [], summary: '' } };

describe('Dragold intelligence board', () => {
  it('selects the freshest scanner and puts current live observations first', () => {
    const deployments = { ...base, characters: {
      Eadroma: { telemetry: { live: true, dragold: { scanner: 'Eadroma', currentShard: 'EUIII', startedAt: 1, observations: [
        { shard: 'USI', live: false, spawnAt: 900_000, seenAt: 90_000 },
        { shard: 'EUII', live: true, spawnAt: 0, seenAt: 99_000 },
      ] } } },
    } } satisfies DeploymentsResponse;
    const board = dragoldBoard(deployments, 100_000);
    expect(board?.observations.map(row => [row.shard, row.live, row.stale])).toEqual([
      ['EUII', true, false], ['USI', false, false],
    ]);
  });
});
