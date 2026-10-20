/** Operator commands for the three-character Cave Dreams team. */
import type { FastifyPluginAsync } from 'fastify';
import { scripts, initialProfile } from '../scripts';
import { getProfile, log } from '../store';
import { telemetry } from './telemetry';
import { wsManager } from '../ws';

export const caveRoute: FastifyPluginAsync = async (app) => {
  app.post('/api/cave/exit', async (_request, reply) => {
    const current = await getProfile(initialProfile(scripts()));
    const farmers = current.profile.characters.filter(character => character.enabled && character.ctype !== 'merchant');
    const queued: string[] = [];
    const failures: Array<{ character: string; error: string }> = [];
    for (const farmer of farmers) {
      try { telemetry.enqueue(farmer.name, 'exit_cave'); queued.push(farmer.name); }
      catch (error) { failures.push({ character: farmer.name, error: (error as Error).message }); }
    }
    await log(`Cave exit queued · ${queued.length} character(s) · ${failures.length} unavailable`);
    wsManager.broadcastRefresh();
    if (!queued.length) return reply.code(409).send({ error: 'No farming character has fresh telemetry.' });
    return { ok: failures.length === 0, queued, failures };
  });
};
