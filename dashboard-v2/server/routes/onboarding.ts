import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { remote, connectCredential } from '../deploy';

/** Read-only game discovery. No CODE upload, character start or profile mutation. */
export const onboardingRoute: FastifyPluginAsync = async app => {
  app.post('/api/onboarding/connect', async (req, reply) => {
    const parsed = z.object({ token: z.string().trim().min(1).max(512).optional() }).safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'Enter a valid MCP token.' });
    try {
      const result = parsed.data.token ? await connectCredential(parsed.data.token) : await remote('mainframe_list_characters');
      const characters = (result.characters ?? []).map((c: any) => ({ name: c.character, ctype: c.class, level: c.level })).filter((c: any) => typeof c.name === 'string' && ['warrior','priest','ranger','mage','rogue','merchant'].includes(c.ctype));
      return { connected: true, characters };
    } catch (error) { return reply.code(400).send({ error: (error as Error).message }); }
  });
};
