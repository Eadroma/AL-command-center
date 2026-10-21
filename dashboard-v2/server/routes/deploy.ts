/**
 * @file deploy.ts
 * Character and party deployment endpoints.
 */

import type { FastifyPluginAsync } from 'fastify';
import crypto from 'node:crypto';
import path from 'node:path';
import { dataDir, port } from '../config';
import { scripts, initialProfile } from '../scripts';
import { buildBundle, merchantPolicy } from '../builder';
import { getProfile, log } from '../store';
import { deployCode, credentialAvailable, remote } from '../deploy';
import { caracalAvailable, caracalStatus, startCaracal } from '../caracal';
import { deploymentStatus } from '../deployment-status';
import { fleetHealth } from '../fleet-health';
import { instrument } from '../telemetry';
import { wsManager } from '../ws';
import { telemetry } from './telemetry';
import { deployments, persistDeployments } from '../services/deployments-state';

export async function deploymentsPayload() {
  const current = await getProfile(initialProfile(scripts()));
  const list = scripts();
  const merchant = list.find(s => s.id === 'eadrosell-merchant-v2') || list.find(s => s.id.startsWith('eadrosell-merchant'));
  const characters = Object.fromEntries(
    Object.entries(deployments).map(([name, d]) => [
      name,
      { ...deploymentStatus(d, telemetry.view(d.telemetryId)), headless: caracalStatus(name) },
    ]),
  );

  return {
    configured: credentialAvailable(),
    caracalAvailable: caracalAvailable(),
    profileVersion: current.version,
    profileServer: current.profile.server,
    policy: merchantPolicy(current.profile, merchant),
    fleet: fleetHealth(current.profile, current.version, list, characters, id => telemetry.view(id)),
    characters,
  };
}

async function deployOne(characterName: string, profileVersion: number, prepareOnly = false) {
  const current = await getProfile(initialProfile(scripts()));
  if (profileVersion !== current.version) {
    throw new Error('Save and refresh your profile before deploying.');
  }

  const character = current.profile.characters.find(c => c.name === characterName);
  if (!character || !character.enabled) {
    throw new Error('Select an enabled character.');
  }

  if (prepareOnly && character.runtime !== 'browser') throw new Error('Offline preparation requires Browser CODE.');
  if (character.runtime === 'browser' && caracalStatus(character.name).managed) {
    throw new Error('Stop the dashboard-managed caracAL client before deploying Browser CODE.');
  }

  if (deployments[character.name]?.busy) {
    throw new Error(`${character.name} is already deploying.`);
  }

  const setStage = (stage: string) => {
    deployments[character.name] = {
      ...deployments[character.name],
      stage,
      busy: true,
      updatedAt: new Date().toISOString(),
    };
    persistDeployments();
    wsManager.broadcastRefresh();
  };

  setStage('Building saved profile');
  let telemetryId: string | undefined;

  try {
    const bundle = await buildBundle(current.profile, character.name);
    const session = telemetry.create(character.name, bundle.hash);
    telemetryId = session.id;
    bundle.code = instrument(bundle.code, character.name, session.ticket, port);

    const deployedHash = crypto.createHash('sha256').update(bundle.code).digest('hex');
    const result = character.runtime === 'caracal'
      ? await startCaracal(character.name, current.profile.server.region + current.profile.server.name, bundle.code, dataDir)
      : await deployCode(character.name, bundle.code, path.join(dataDir, 'code-backups'), undefined, setStage, prepareOnly);

    deployments[character.name] = {
      ...result,
      runtime: character.runtime,
      telemetryId,
      hash: deployedHash,
      sourceHash: bundle.sourceHash,
      script: character.script,
      profileVersion: current.version,
      profileServer: current.profile.server,
      busy: false,
      updatedAt: new Date().toISOString(),
    };

    telemetry.retire(character.name, session.id);
    await log(`${character.runtime}: deployment requested; waiting for telemetry.`, character.name);
    persistDeployments();
    wsManager.broadcastRefresh();
    return deployments[character.name];
  } catch (e) {
    const message = (e as Error).message;
    deployments[character.name] = {
      stage: 'Deployment failed',
      telemetryId,
      message,
      busy: false,
      updatedAt: new Date().toISOString(),
    };
    await log(`Deployment failed: ${message}`, character.name);
    persistDeployments();
    wsManager.broadcastRefresh();
    throw e;
  }
}

export const deployRoute: FastifyPluginAsync = async (app) => {
  app.get('/api/deployments', async () => {
    return deploymentsPayload();
  });

  app.post<{ Body: { character: string; version: number; prepareOnly?: boolean } }>('/api/deploy', async (req, reply) => {
    const body = req.body;
    try {
      return await deployOne(String(body.character), Number(body.version), body.prepareOnly === true);
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
  });

  app.post<{ Body: { version?: number } }>('/api/deploy-party', async (req, reply) => {
    const body = req.body || {};
    const current = await getProfile(initialProfile(scripts()));

    if (body.version !== current.version) {
      return reply.code(409).send({ error: 'Save and refresh your profile before deploying.' });
    }

    const enabled = current.profile.characters.filter(c => c.enabled);
    if (!enabled.length) {
      return reply.code(400).send({ error: 'Enable at least one character.' });
    }

    if (Object.values(deployments).some((d: any) => d.busy)) {
      return reply.code(409).send({ error: 'Wait for the current deployment to finish.' });
    }

    const results: any[] = [];
    const failures: { character: string; error: string }[] = [];

    for (const c of [...enabled].sort((a, b) => Number(a.ctype === 'merchant') - Number(b.ctype === 'merchant'))) {
      try {
        const worker = current.profile.events.expedition.enabled && ['warrior', 'priest'].includes(c.ctype);
        const offline = worker && !(await remote('browser_code_status', { character: c.name })).online;
        results.push(await deployOne(c.name, current.version, offline));
      } catch (e) {
        failures.push({ character: c.name, error: (e as Error).message });
      }
    }

    await log(`Party deploy finished · ${results.length} ok · ${failures.length} failed`);
    wsManager.broadcastRefresh();
    return { ok: failures.length === 0, deployed: results.map(r => r.character || r.name), failures, results };
  });
};
