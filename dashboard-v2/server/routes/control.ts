/**
 * @file control.ts
 * In-game process and browser CODE control endpoints.
 */

import type { FastifyPluginAsync } from 'fastify';
import { scripts, initialProfile } from '../scripts';
import { getProfile, log } from '../store';
import { remote } from '../deploy';
import { caracalStatus, stopCaracal } from '../caracal';
import { wsManager } from '../ws';
import { deployments, persistDeployments } from '../services/deployments-state';

export const controlRoute: FastifyPluginAsync = async (app) => {
  app.post<{ Body: { character: string; action: string } }>('/api/control', async (req, reply) => {
    const { character, action } = req.body || {};
    const current = await getProfile(initialProfile(scripts()));
    const selected = current.profile.characters.find(c => c.name === character);

    if (!selected || !['stop', 'status'].includes(action)) {
      return reply.code(400).send({ error: 'Invalid browser control.' });
    }

    if (deployments[character]?.busy) {
      return reply.code(409).send({ error: 'Wait for the current operation to finish.' });
    }

    const previous = deployments[character] || {};
    deployments[character] = { ...previous, busy: true };

    try {
      if (caracalStatus(character).managed || previous.runtime === 'caracal' || selected.runtime === 'caracal') {
        const result = action === 'stop'
          ? await stopCaracal(character)
          : { stage: caracalStatus(character).processRunning ? 'Headless process started' : 'Stopped', message: 'Local process status checked.' };
        deployments[character] = { ...previous, ...result, busy: false };
        persistDeployments();
        wsManager.broadcastRefresh();
        return deployments[character];
      }

      if (action === 'stop') {
        await remote('browser_code_stop', { character });
      }

      const status = await remote('browser_code_status', { character });
      deployments[character] = {
        ...previous,
        busy: false,
        browserStatus: status,
        checkedAt: new Date().toISOString(),
        ...(action === 'stop'
          ? { stage: status.code_running ? 'Stop requested' : 'Stopped', message: status.code_running ? 'Waiting for CODE to stop.' : 'Game reports CODE stopped.' }
          : {}),
      };

      if (action === 'stop') {
        await log(deployments[character].message, character);
      }

      persistDeployments();
      wsManager.broadcastRefresh();
      return deployments[character];
    } catch (e) {
      deployments[character] = { ...previous, busy: false };
      throw e;
    }
  });

  app.post<{ Body: { action: string } }>('/api/control-party', async (req, reply) => {
    const { action } = req.body || {};
    if (action !== 'stop') {
      return reply.code(400).send({ error: 'Invalid party control.' });
    }

    const current = await getProfile(initialProfile(scripts()));
    const stopped: string[] = [];
    const failures: { character: string; error: string }[] = [];

    for (const selected of current.profile.characters.filter(c => c.enabled)) {
      const character = selected.name;
      const previous = deployments[character] || {};

      if (previous.busy) {
        failures.push({ character, error: 'Operation already in progress.' });
        continue;
      }

      try {
        deployments[character] = { ...previous, busy: true };
        if (caracalStatus(character).managed || previous.runtime === 'caracal' || selected.runtime === 'caracal') {
          await stopCaracal(character);
        } else {
          await remote('browser_code_stop', { character });
        }
        deployments[character] = {
          ...previous,
          busy: false,
          stage: 'Stopped',
          message: 'Stopped from party controls.',
          updatedAt: new Date().toISOString(),
        };
        stopped.push(character);
      } catch (e) {
        deployments[character] = { ...previous, busy: false };
        failures.push({ character, error: (e as Error).message });
      }
    }

    persistDeployments();
    await log(`Party stop finished · ${stopped.length} stopped · ${failures.length} failed`);
    wsManager.broadcastRefresh();
    return { ok: failures.length === 0, stopped, failures };
  });
};
