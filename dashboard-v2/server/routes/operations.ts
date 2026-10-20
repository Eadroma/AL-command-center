import type { FastifyPluginAsync } from 'fastify';
import { operationsHistory } from './telemetry';

export const operationsRoute: FastifyPluginAsync = async app => {
  app.get<{ Querystring: { hours?: string } }>('/api/operations', async request => {
    const hours = Number(request.query?.hours || 168);
    return operationsHistory.view(Number.isFinite(hours) ? hours : 168);
  });
};
