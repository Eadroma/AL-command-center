/**
 * The game data update job: one run at a time (in this process and across processes, see lock.ts),
 * started at boot, every 6 hours while the server runs, from the UI or from `pnpm game:update`.
 * The last run is kept in game-data/job.json so the server and the command share the same history.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { JobState } from '../../shared/game.ts';
import { jobStateSchema } from '../../shared/game.ts';
import { catchUpGameData, describeData, describeImages } from './catch-up.ts';
import { acquireLock } from './lock.ts';
import type { GameDataService } from './service.ts';

export type Trigger = NonNullable<JobState['trigger']>;

export interface JobOptions {
  readonly service: GameDataService;
  /** game-data folder: holds the lock and job.json. */
  readonly directory: string;
  readonly checkEveryHours: number;
  readonly log: (line: string) => void;
}

export interface GameDataJob {
  readonly state: () => JobState;
  /** Starts a run unless one is already going; manual and command-line runs always check. */
  readonly run: (trigger: Trigger) => Promise<JobState | 'busy'>;
  readonly isRunning: () => boolean;
  /** Runs every `intervalMs`; returns the function that stops the schedule. */
  readonly schedule: (intervalMs: number) => () => void;
}

const IDLE: JobState = { status: 'idle', trigger: null, startedAt: null, finishedAt: null, durationMs: null, summary: [] };

export async function readJobState(directory: string): Promise<JobState> {
  const text = await readFile(path.join(directory, 'job.json'), 'utf8').catch(() => null);
  const parsed = jobStateSchema.safeParse(text === null ? null : JSON.parse(text));
  return parsed.success ? parsed.data : IDLE;
}

/** One pass of the job; manual and command-line runs always check, scheduled ones only when stale. */
async function execute(options: JobOptions, trigger: Trigger, startedAt: Date): Promise<JobState> {
  const forced = trigger === 'manual' || trigger === 'cli';
  const result = await catchUpGameData(options.service, forced ? 0 : options.checkEveryHours);
  const summary = [...(result.data === null ? [] : [describeData(result.data)]), ...(result.images === null ? [] : [describeImages(result.images)])];
  const failed = result.data?.status === 'failed' || result.images?.status === 'failed';
  const finishedAt = new Date();
  return {
    status: failed ? 'failed' : 'succeeded', trigger, startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(), summary: summary.length > 0 ? summary : ['game data: up to date'],
  };
}

export async function createGameDataJob(options: JobOptions): Promise<GameDataJob> {
  let current = await readJobState(options.directory);
  let running = false;

  const run = async (trigger: Trigger): Promise<JobState | 'busy'> => {
    if (running) {
      return 'busy';
    }
    running = true;
    const previous = current;
    const startedAt = new Date();
    // Visible as running at once, so a manual start answers with the right state.
    current = { status: 'running', trigger, startedAt: startedAt.toISOString(), finishedAt: null, durationMs: null, summary: [] };
    try {
      await mkdir(options.directory, { recursive: true });
      const release = await acquireLock(path.join(options.directory, 'update.lock'));
      if (release === null) {
        current = previous;
        return 'busy';
      }
      try {
        current = await execute(options, trigger, startedAt);
        await writeFile(path.join(options.directory, 'job.json'), `${JSON.stringify(current, null, 2)}\n`);
        current.summary.forEach(options.log);
        return current;
      } finally {
        await release();
      }
    } finally {
      running = false;
    }
  };

  return {
    state: () => current,
    run,
    isRunning: () => running,
    schedule: (intervalMs) => {
      const timer = setInterval(() => { void run('schedule'); }, intervalMs);
      timer.unref();
      return () => { clearInterval(timer); };
    },
  };
}
