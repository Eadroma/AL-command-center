/**
 * @file telemetry.ts
 * In-game telemetry reporting endpoint.
 */

import type { FastifyPluginAsync } from 'fastify';
import path from 'node:path';
import { dataDir } from '../config';
import { Telemetry } from '../telemetry';
import { PerformanceHistory } from '../performance-history';
import { OperationsHistory } from '../operations-history';
import { PartyStatisticsHistory } from '../party-statistics';

export const performanceHistory = new PerformanceHistory(path.join(dataDir, 'performance-history.json'));
export const operationsHistory = new OperationsHistory(path.join(dataDir, 'operations-history.json'));
export const partyStatistics = new PartyStatisticsHistory(path.join(dataDir, 'party-statistics.json'));
export const telemetry = new Telemetry(path.join(dataDir, 'telemetry.json'), Date.now, sample => {
  performanceHistory.record(sample);
  operationsHistory.record(sample);
  partyStatistics.record(sample);
});

export const telemetryRoute: FastifyPluginAsync = async (app) => {
  app.get('/api/party-statistics', async () => partyStatistics.view());
  app.options('/api/telemetry', async (_req, reply) => {
    reply.code(204).send();
  });

  // Bank snapshots plus expedition history can exceed 100 KB. Keep a bounded
  // limit large enough for the validated account bank payload.
  app.post('/api/telemetry', { bodyLimit: 1000000 }, async (req, reply) => {
    try {
      const accepted = telemetry.ingest(req.body);
      const character = String((req.body as { character?: unknown })?.character ?? '');
      return { ok: true, commands: accepted ? telemetry.takeCommands(character) : [] };
    } catch {
      return reply.code(403).send({ error: 'Telemetry rejected.' });
    }
  });
};
