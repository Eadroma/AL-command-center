/** Persistent acknowledgement state for incidents derived from live telemetry. */
import type { FastifyPluginAsync } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { dataDir } from '../config';
import { wsManager } from '../ws';

const file = path.join(dataDir, 'incident-resolutions.json');
const bodySchema = z.object({ id: z.string().min(1).max(120), resolved: z.boolean() });

function read(): Record<string, number> {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}

function write(value: Record<string, number>) {
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value));
  fs.renameSync(temporary, file);
}

export const incidentsRoute: FastifyPluginAsync = async (app) => {
  app.get('/api/incidents/resolutions', async () => ({ resolutions: read() }));
  app.post('/api/incidents/resolutions', async (request) => {
    const command = bodySchema.parse(request.body);
    const resolutions = read();
    if (command.resolved) resolutions[command.id] = Date.now();
    else delete resolutions[command.id];
    write(resolutions);
    wsManager.broadcastRefresh();
    return { ok: true, resolutions };
  });
};
