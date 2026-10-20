/**
 * @file bootstrap.ts
 * Initial dashboard bootstrap state endpoint.
 */

import type { FastifyPluginAsync } from 'fastify';
import fs from 'node:fs';
import { catalogPath, mapsCatalogPath } from '../config';
import { scripts, initialProfile, sourceDir } from '../scripts';
import { isManaged } from '../builder';
import { getProfile, activity } from '../store';
import { credentialAvailable } from '../deploy';

export const bootstrapRoute: FastifyPluginAsync = async (app) => {
  app.get('/api/bootstrap', async () => {
    const list = scripts();
    const assets = fs.existsSync(catalogPath)
      ? JSON.parse(fs.readFileSync(catalogPath, 'utf8'))
      : { assets: {}, monsters: [], items: [] };
    const mapCatalog = fs.existsSync(mapsCatalogPath)
      ? JSON.parse(fs.readFileSync(mapsCatalogPath, 'utf8'))
      : { maps: {} };

    const profileData = await getProfile(initialProfile(list));
    const managedKeys = Object.keys(list.reduce((acc, s) => ({ ...acc, ...s.config }), {})).filter(isManaged);
    const recentActivity = await activity();

    return {
      ...profileData,
      catalog: {
        ...assets,
        maps: mapCatalog.maps ?? {},
        scripts: list,
        sourceDirectory: sourceDir,
        importedAt: new Date().toISOString(),
      },
      managedKeys,
      activity: recentActivity,
      runtime: {
        browser: credentialAvailable() ? 'configured' : 'not-connected',
        caracal: 'not-connected',
        mainframe: 'planned',
      },
    };
  });
};
