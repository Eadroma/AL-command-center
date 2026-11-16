/**
 * The profile in SQLite (node:sqlite, built into Node 24: no native module to build). One row, one revision counter.
 * Every write names the revision it started from; if another window saved in between, nothing is written and the
 * caller gets the current profile to reload (optimistic concurrency, same rule as dashboard-v2).
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import type { Profile, SavedProfile } from '../../shared/profile.ts';
import { profileSchema } from '../../shared/profile.ts';

export type WriteResult =
  | { readonly ok: true; readonly saved: SavedProfile }
  | { readonly ok: false; readonly code: 'profile.conflict'; readonly current: SavedProfile | null };

export interface ProfileStore {
  readonly read: () => SavedProfile | null;
  /** Writes a new revision if `expected` is still the current one (null: there must be no profile yet). */
  readonly write: (profile: Profile, expected: number | null, origin: string) => WriteResult;
  readonly close: () => void;
}

const rowSchema = z.object({ revision: z.number(), updated_at: z.string(), origin: z.string(), payload: z.string() });

function toSaved(row: unknown): SavedProfile | null {
  const parsed = rowSchema.safeParse(row);
  if (!parsed.success) {
    return null;
  }
  const profile = profileSchema.safeParse(JSON.parse(parsed.data.payload));
  // A stored profile that no longer validates is reported as missing rather than half-read; the row stays on disk.
  return profile.success ? { revision: parsed.data.revision, updatedAt: parsed.data.updated_at, origin: parsed.data.origin, profile: profile.data } : null;
}

export function openProfileStore(file: string, now: () => Date = () => new Date()): ProfileStore {
  if (file !== ':memory:') {
    mkdirSync(path.dirname(file), { recursive: true });
  }
  const database = new DatabaseSync(file);
  database.exec(`CREATE TABLE IF NOT EXISTS profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    revision INTEGER NOT NULL,
    updated_at TEXT NOT NULL,
    origin TEXT NOT NULL,
    payload TEXT NOT NULL
  )`);
  const select = database.prepare('SELECT revision, updated_at, origin, payload FROM profile WHERE id = 1');
  const insert = database.prepare('INSERT OR IGNORE INTO profile (id, revision, updated_at, origin, payload) VALUES (1, 1, ?, ?, ?)');
  const update = database.prepare('UPDATE profile SET revision = revision + 1, updated_at = ?, origin = ?, payload = ? WHERE id = 1 AND revision = ?');
  const read = (): SavedProfile | null => toSaved(select.get());

  return {
    read,
    write: (profile, expected, origin) => {
      const values = [now().toISOString(), origin, JSON.stringify(profile)] as const;
      const changes = expected === null ? insert.run(...values).changes : update.run(...values, expected).changes;
      const current = read();
      return changes === 1 && current !== null ? { ok: true, saved: current } : { ok: false, code: 'profile.conflict', current };
    },
    close: () => { database.close(); },
  };
}
