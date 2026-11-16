/**
 * Game data routes: status, item search, image index and the images themselves.
 * Projections only, never the full `G`. Images are content-addressed, so they are cached forever.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Hono } from 'hono';
import { z } from 'zod';
import { readReports } from '../game-data/changes.ts';
import { isAssetFileName } from '../game-data/images.ts';
import type { GameDataJob } from '../game-data/job.ts';
import type { GameDataService } from '../game-data/service.ts';

const searchQuerySchema = z.object({
  q: z.string().max(100).default(''),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export interface GameRouteOptions {
  readonly gameData: GameDataService;
  readonly job: GameDataJob;
  readonly assetsDirectory: string;
}

export function gameRoutes(app: Hono, { gameData, job, assetsDirectory }: GameRouteOptions): void {
  app.get('/api/game/status', (context) => context.json(gameData.status()));

  app.get('/api/game/items', (context) => {
    const query = searchQuerySchema.safeParse(context.req.query());
    if (!query.success) {
      return context.json({ error: { code: 'game.invalidQuery' } }, 400);
    }
    return context.json({ items: gameData.searchItems(query.data.q, query.data.limit) });
  });

  app.get('/api/game/monsters', async (context) => context.json({ monsters: await gameData.monsters() }));

  app.get('/api/game/loadout-catalogue', (context) => {
    const catalogue = gameData.loadoutCatalogue();
    return catalogue === null ? context.json({ error: { code: 'game.noData' } }, 404) : context.json(catalogue);
  });

  app.get('/api/game/assets', (context) => context.json({ files: gameData.assetUrls() }));

  app.get('/api/game/character-sprites', async (context) => context.json(await gameData.characterSprites()));

  app.get('/api/game/maps/:id', (context) => {
    const terrain = gameData.terrain(context.req.param('id'));
    return terrain === null ? context.json({ error: { code: 'game.unknownMap' } }, 404) : context.json(terrain);
  });

  app.get('/api/game/job', (context) => context.json(job.state()));

  // Starts a manual update in the background; the UI follows it through GET /api/game/job.
  app.post('/api/game/refresh', (context) => {
    if (job.isRunning()) {
      return context.json({ error: { code: 'game.updateRunning' } }, 409);
    }
    void job.run('manual');
    return context.json(job.state(), 202);
  });

  app.get('/api/game/changes', async (context) => context.json({ reports: await readReports(gameData.directories().data) }));

  app.get('/game-assets/:file', async (context) => {
    const name = context.req.param('file');
    if (!isAssetFileName(name)) {
      return context.json({ error: { code: 'game.unknownAsset' } }, 404);
    }
    const bytes = await readFile(path.join(assetsDirectory, name)).catch(() => null);
    if (bytes === null) {
      return context.json({ error: { code: 'game.unknownAsset' } }, 404);
    }
    return context.body(bytes, 200, { 'content-type': 'image/png', 'cache-control': 'public, max-age=31536000, immutable' });
  });
}
