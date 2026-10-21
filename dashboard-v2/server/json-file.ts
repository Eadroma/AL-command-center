import fs from 'node:fs';

const pending = new Set<() => void>();
process.once('exit', () => { for (const flush of [...pending]) flush(); });

/**
 * Returns a `persist()` that writes `data()` atomically at most once per interval.
 * Telemetry arrives every few seconds; rewriting multi-MB files on each packet blocked the server.
 * shortcut: a hard kill (Windows `tsx watch` restart) loses up to one interval of history, upgrade to an append log if that matters.
 */
export function throttledJsonWriter(file: string | undefined, data: () => unknown, intervalMs = 15_000) {
  let timer: NodeJS.Timeout | undefined;
  const flush = () => {
    clearTimeout(timer);
    timer = undefined;
    pending.delete(flush);
    try {
      fs.writeFileSync(`${file}.tmp`, JSON.stringify(data()));
      fs.renameSync(`${file}.tmp`, file!);
    } catch (error) {
      console.error(`[Command Center] Failed to write ${file}:`, error);
    }
  };
  return () => {
    if (!file || timer) return;
    pending.add(flush);
    timer = setTimeout(flush, intervalMs);
    timer.unref();
  };
}
