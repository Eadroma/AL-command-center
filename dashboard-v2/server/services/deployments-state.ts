/**
 * @file deployments-state.ts
 * In-memory and persisted deployment status tracking.
 */

import fs from 'node:fs';
import { deploymentFile } from '../config';

export let deployments: Record<string, any> = {};

export function loadDeployments(): void {
  try {
    deployments = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
    for (const d of Object.values(deployments)) {
      if (d.busy) {
        d.busy = false;
        d.stage = 'Interrupted';
        d.message = 'Server restarted during deployment. Check the game before retrying.';
      }
    }
  } catch {
    deployments = {};
  }
}

export function persistDeployments(): void {
  fs.writeFileSync(deploymentFile + '.tmp', JSON.stringify(deployments, null, 2));
  fs.renameSync(deploymentFile + '.tmp', deploymentFile);
}

// Initial load
loadDeployments();
