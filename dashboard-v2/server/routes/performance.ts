import type { FastifyPluginAsync } from 'fastify';
import { performanceHistory } from './telemetry';

export const performanceRoute: FastifyPluginAsync = async app => {
  app.get<{ Querystring: { hours?: string } }>('/api/performance', async request => {
    const hours = Number(request.query?.hours || 24);
    return performanceHistory.view(Number.isFinite(hours) ? hours : 24);
  });
};
