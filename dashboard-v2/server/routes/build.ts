/**
 * @file build.ts
 * Script bundle compilation and download endpoints.
 */

import type { FastifyPluginAsync } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import { bundlesDir } from '../config';
import { scripts, initialProfile } from '../scripts';
import { buildBundle } from '../builder';
import { getProfile, log } from '../store';
import { wsManager } from '../ws';

interface BuildBody {
  character: string;
  version: number;
}

interface BundleParams {
  file: string;
}

export const buildRoute: FastifyPluginAsync = async (app) => {
  app.post<{ Body: BuildBody }>('/api/build', async (req, reply) => {
    const body = req.body;
    if (!body || !body.character) {
      return reply.code(400).send({ error: 'Character name is required.' });
    }

    const current = await getProfile(initialProfile(scripts()));
    if (body.version !== current.version) {
      return reply.code(409).send({ error: 'Save and refresh your profile before building.' });
    }

    const result = await buildBundle(current.profile, String(body.character));
    fs.mkdirSync(bundlesDir, { recursive: true });
    fs.writeFileSync(path.join(bundlesDir, `${result.hash}.js`), result.code);

    await log(`Built ${result.filename} · ${result.hash.slice(0, 8)}. Not deployed.`, String(body.character));
    wsManager.broadcastRefresh();

    return {
      ...result,
      download: `/api/bundles/${result.hash}.js`,
      revision: current.version,
    };
  });

  app.get<{ Params: BundleParams }>('/api/bundles/:file', async (req, reply) => {
    const fileName = path.basename(req.params.file);
    const filePath = path.join(bundlesDir, fileName);

    if (!fs.existsSync(filePath)) {
      return reply.code(404).send({ error: 'Bundle not found' });
    }

    reply.header('Content-Type', 'application/javascript; charset=utf-8');
    return fs.readFileSync(filePath, 'utf8');
  });
};
