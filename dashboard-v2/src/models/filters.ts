import type { LogEntry, ScriptInfo } from '../types';

export interface ActivityFilters { search: string; level: string; source: string; }

/** Combine all activity constraints without mutating chronological order. */
export function filterActivity(entries: LogEntry[], filters: ActivityFilters): LogEntry[] {
  const query = filters.search.trim().toLowerCase();
  return entries.filter(entry =>
    (!filters.level || entry.level === filters.level)
    && (!filters.source || entry.source === filters.source)
    && `${entry.source} ${entry.message}`.toLowerCase().includes(query),
  );
}

/** Search catalog metadata only; private CONFIG values are not search-indexed. */
export function filterScripts(scripts: ScriptInfo[], search: string, ctype: string): ScriptInfo[] {
  const query = search.trim().toLowerCase();
  return scripts.filter(script => (!ctype || script.ctype === ctype)
    && `${script.label} ${script.filename} ${script.kind}`.toLowerCase().includes(query));
}
