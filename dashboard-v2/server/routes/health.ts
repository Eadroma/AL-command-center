/**
 * @file health.ts
 * Health check endpoint.
 */

import type { FastifyPluginAsync } from 'fastify';
import { credentialAvailable } from '../deploy';

export const healthRoute: FastifyPluginAsync = async (app) => {
  app.get('/api/health', async () => ({
    ok: true,
    mode: 'local',
    adapters: {
      browser: credentialAvailable() ? 'configured' : 'not-connected',
      caracal: 'not-connected',
    },
  }));
};
