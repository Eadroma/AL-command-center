/**
 * @file profile.ts
 * Profile update and validation endpoint.
 */

import type { FastifyPluginAsync } from 'fastify';
import { profileSchema, ensureSellerBoards, ensureFarmingBoards, type Profile } from '../../shared/schema';
import { validateProfile } from '../builder';
import { saveProfile, log } from '../store';
import { wsManager } from '../ws';

interface UpdateProfileBody {
  profile: Profile;
  version: number;
}

export const profileRoute: FastifyPluginAsync = async (app) => {
  app.put<{ Body: UpdateProfileBody }>('/api/profile', async (req, reply) => {
    const body = req.body;
    if (!body || typeof body !== 'object') {
      return reply.code(400).send({ error: 'Request body is required.' });
    }

    const rawSeller = body.profile?.seller as Record<string, unknown> | undefined;
    const rawFarming = body.profile?.farming as Record<string, unknown> | undefined;
    const rawEvents = body.profile?.events as Record<string, unknown> | undefined;

    const incoming = ensureFarmingBoards(ensureSellerBoards(structuredClone(body.profile || {} as Profile)));
    if (typeof rawFarming?.dailyDungeon === 'boolean') incoming.farming.dailyDungeon = rawFarming.dailyDungeon;
    if (rawFarming?.loadouts && typeof rawFarming.loadouts === 'object') incoming.farming.loadouts = rawFarming.loadouts as any;
    if (rawFarming?.style && typeof rawFarming.style === 'object') incoming.farming.style = rawFarming.style as any;
    if (rawEvents?.style && typeof rawEvents.style === 'object') incoming.events.style = rawEvents.style as any;

    const parseResult = profileSchema.safeParse(incoming);
    if (!parseResult.success) {
      return reply.code(400).send({ error: parseResult.error.issues.map(x => x.message).join(' ') });
    }

    const profile = ensureFarmingBoards(ensureSellerBoards(parseResult.data));
    if (typeof rawFarming?.dailyDungeon === 'boolean') profile.farming.dailyDungeon = rawFarming.dailyDungeon;
    if (rawFarming?.loadouts && typeof rawFarming.loadouts === 'object') {
      try { profile.farming.loadouts = profileSchema.shape.farming.shape.loadouts.parse(rawFarming.loadouts); } catch {}
    }
    if (rawFarming?.style && typeof rawFarming.style === 'object') {
      try { profile.farming.style = profileSchema.shape.farming.shape.style.parse(rawFarming.style); } catch {}
    }
    if (rawEvents?.style && typeof rawEvents.style === 'object') {
      try { profile.events.style = profileSchema.shape.events.shape.style.parse(rawEvents.style); } catch {}
    }
    if (rawSeller?.ponty && typeof rawSeller.ponty === 'object') {
      try { profile.seller.ponty = profileSchema.shape.seller.shape.ponty.parse(rawSeller.ponty); } catch {}
    }
    if (rawSeller?.kit && typeof rawSeller.kit === 'object') {
      try { profile.seller.kit = profileSchema.shape.seller.shape.kit.parse(rawSeller.kit); } catch {}
    }
    if (rawSeller?.consumables && typeof rawSeller.consumables === 'object') {
      try { profile.seller.consumables = profileSchema.shape.seller.shape.consumables.parse(rawSeller.consumables); } catch {}
    }
    if (rawSeller?.gifts && typeof rawSeller.gifts === 'object') {
      try { profile.seller.gifts = profileSchema.shape.seller.shape.gifts.parse(rawSeller.gifts); } catch {}
    }

    validateProfile(profile);

    if (!Number.isInteger(body.version)) {
      return reply.code(400).send({ error: 'Profile version is required.' });
    }

    try {
      const saved = await saveProfile(profile, body.version);
      await log(`Saved ${saved.profile.name} · revision ${saved.version}`);
      wsManager.broadcastRefresh();
      return saved;
    } catch (e) {
      return reply.code(409).send({ error: (e as Error).message });
    }
  });
};
