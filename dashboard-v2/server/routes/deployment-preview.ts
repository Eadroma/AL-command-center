import type { FastifyPluginAsync } from 'fastify';
import { buildBundle } from '../builder';
import { initialProfile, scripts } from '../scripts';
import { getProfile } from '../store';
import { remote } from '../deploy';
import { deployments } from '../services/deployments-state';
import { injectedSettings, settingsChanges } from '../deployment-preview';

/** Build and inspect current slots; never upload, restart or create telemetry tickets. */
export const deploymentPreviewRoute: FastifyPluginAsync = async app => {
  app.post<{ Body: { version: number } }>('/api/deploy-preview', async (request, reply) => {
    const current = await getProfile(initialProfile(scripts()));
    if (request.body?.version !== current.version) return reply.code(409).send({ error: 'Save and refresh before previewing deployment.' });
    const characters = [];
    for (const character of current.profile.characters.filter(entry => entry.enabled)) {
      try {
        const bundle = await buildBundle(current.profile, character.name);
        const previous = deployments[character.name];
        let settings: Record<string, unknown> = {};
        let comparison = 'No previous slot available';
        if (previous?.slot && character.runtime === 'browser') {
          const result = await remote('get_code', { slot: String(previous.slot) });
          settings = injectedSettings(String(result.code?.code || ''));
          comparison = Object.keys(settings).length ? 'Compared with saved game CODE slot' : 'Legacy settings could not be parsed';
        }
        characters.push({ name: character.name, runtime: character.runtime, script: character.script, sourceChanged: previous?.sourceHash !== bundle.sourceHash, comparison, changes: settingsChanges(settings, injectedSettings(bundle.code)), warnings: bundle.warnings });
      } catch (error) { characters.push({ name: character.name, error: (error as Error).message }); }
    }
    return { version: current.version, characters };
  });
};
