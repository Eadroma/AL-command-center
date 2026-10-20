/** Supported display severities; unknown server levels are normalized to info. */
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  id: number;
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
}
