/**
 * What changed between two snapshots of G (items, monsters, maps): the source of "New this week".
 * The last 20 reports are kept in game-data/changes.json.
 */
import { randomUUID } from 'node:crypto';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ChangeReport, RecordChanges } from '../../shared/game.ts';
import { changeReportSchema } from '../../shared/game.ts';
import type { GameData } from './data-js.ts';

const KEPT_REPORTS = 20;

export function diffRecords(previous: Readonly<Record<string, unknown>>, next: Readonly<Record<string, unknown>>): RecordChanges {
  const added = Object.keys(next).filter((key) => !(key in previous)).sort();
  const removed = Object.keys(previous).filter((key) => !(key in next)).sort();
  const changed = Object.keys(next)
    .filter((key) => key in previous && JSON.stringify(previous[key]) !== JSON.stringify(next[key]))
    .sort();
  return { added, removed, changed };
}

export function buildReport(previous: GameData, next: GameData, at: string): ChangeReport {
  return {
    at,
    fromVersion: previous.version,
    toVersion: next.version,
    items: diffRecords(previous.items, next.items),
    monsters: diffRecords(previous.monsters, next.monsters),
    maps: diffRecords(previous.maps, next.maps),
  };
}

export async function readReports(directory: string): Promise<ChangeReport[]> {
  const text = await readFile(path.join(directory, 'changes.json'), 'utf8').catch(() => null);
  const parsed = changeReportSchema.array().safeParse(text === null ? [] : JSON.parse(text));
  return parsed.success ? parsed.data : [];
}

/** Newest first; older reports beyond the limit are dropped. */
export async function appendReport(directory: string, report: ChangeReport): Promise<void> {
  const reports = [report, ...await readReports(directory)].slice(0, KEPT_REPORTS);
  const file = path.join(directory, 'changes.json');
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(reports, null, 2)}\n`);
    await rename(temporary, file);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}
