/**
 * One catch-up pass: refresh stale game data, then mirror the images when the data changed
 * or were never mirrored. Returns what happened; the caller decides how to report it.
 */
import type { SyncResult } from './image-sync.ts';
import type { GameDataService } from './service.ts';
import type { UpdateResult } from './store.ts';

export interface CatchUpResult {
  readonly data: UpdateResult | null;
  readonly images: SyncResult | null;
}

export function describeData(result: UpdateResult): string {
  const version = result.meta === null ? '?' : String(result.meta.version);
  const reason = result.status === 'failed' ? ` ${result.code}${result.issues === undefined ? '' : `: ${result.issues.join(', ')}`}` : '';
  return `game data: ${result.status} (version ${version})${reason}`;
}

export function describeImages(result: SyncResult): string {
  const detail = result.status === 'synced'
    ? `${String(result.downloaded)}/${String(result.total)} downloaded, ${String(result.failed.length)} failed`
    : result.code;
  return `game images: ${result.status} (${detail})`;
}

/** Images need syncing when the data just changed, or when they were never mirrored. */
export function needsImages(dataResult: UpdateResult | null, hasImages: boolean): boolean {
  if (dataResult?.status === 'failed') {
    return false;
  }
  return !hasImages || dataResult?.status === 'updated' || dataResult?.status === 'versionOnly';
}

/** `maxAgeHours: 0` forces a check (manual update). */
export async function catchUpGameData(service: GameDataService, maxAgeHours: number): Promise<CatchUpResult> {
  const data = service.isStale(maxAgeHours) ? await service.refresh() : null;
  const images = needsImages(data, service.hasImages()) ? await service.refreshImages() : null;
  return { data, images };
}
