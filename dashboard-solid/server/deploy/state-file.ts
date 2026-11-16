/** Deployment states on disk (deployments.json in the data folder), so the Team screen keeps them after a restart. */
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { Deployment } from '../../shared/deploy.ts';
import { deploymentSchema } from '../../shared/deploy.ts';

export interface DeploymentFile {
  readonly read: () => Readonly<Record<string, Deployment>>;
  readonly write: (deployments: Readonly<Record<string, Deployment>>) => void;
}

const fileSchema = z.record(z.string(), deploymentSchema);

export function deploymentFile(file: string): DeploymentFile {
  return {
    read: () => {
      try {
        const parsed = fileSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')));
        // An operation cut short by a restart is not running any more.
        return parsed.success ? Object.fromEntries(Object.entries(parsed.data).map(([name, entry]) => [name, { ...entry, busy: false }])) : {};
      } catch {
        return {};
      }
    },
    write: (deployments) => {
      mkdirSync(path.dirname(file), { recursive: true });
      const temporary = `${file}.${randomUUID()}.tmp`;
      try {
        writeFileSync(temporary, `${JSON.stringify(deployments, null, 2)}\n`);
        renameSync(temporary, file);
      } finally {
        rmSync(temporary, { force: true });
      }
    },
  };
}

/** In memory only, for tests. */
export function memoryDeploymentFile(): DeploymentFile {
  let stored: Readonly<Record<string, Deployment>> = {};
  return { read: () => stored, write: (deployments) => { stored = deployments; } };
}
