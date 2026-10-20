/**
 * @file TelemetryPanel.tsx
 * Persisted server activity console.
 *
 * Displays a scrollable list of log entries received from the Command Center
 * bootstrap API, refreshed by WebSocket notifications. Each entry carries a severity level (info, warn, error)
 * which is mapped to a colour class. The panel auto-scrolls to the latest
 * entry and caps the visible history to avoid unbounded memory growth.
 *
 * Clearing the console hides existing entries in this browser session;
 * persisted server activity is never deleted.
 */

import { useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';
import { Card, Button, Badge } from '../ui';
import type { LogLevel, LogEntry } from '../../types/activity';
import styles from './TelemetryPanel.module.scss';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** CSS class name per log level, mapped to colour variants in the SCSS module. */
const LEVEL_CLASS: Record<LogLevel, string> = {
  info:  styles.levelInfo,
  warn:  styles.levelWarn,
  error: styles.levelError,
  debug: styles.levelDebug,
};

/** Badge variant per log level (used in the panel header count). */
const LEVEL_BADGE_VARIANT: Record<LogLevel, 'info' | 'warning' | 'danger' | 'neutral'> = {
  info:  'info',
  warn:  'warning',
  error: 'danger',
  debug: 'neutral',
};

// ---------------------------------------------------------------------------
// Props & Component
// ---------------------------------------------------------------------------

export interface TelemetryPanelProps {
  /** Log entries to display. Pass `[]` for an idle/empty state. */
  entries: LogEntry[];
  /** Maximum number of entries to render (oldest are clipped). Defaults to 50. */
  maxEntries?: number;
  /** Called when user clicks "Clear Logs". */
  onClear?: () => void;
}

/**
 * TelemetryPanel
 *
 * Scrollable log console. Automatically scrolls to the bottom when new
 * entries are appended. Clips history at `maxEntries` to keep the DOM light.
 */
export function TelemetryPanel({
  entries,
  maxEntries = 50,
  onClear,
}: TelemetryPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const visibleEntries = entries.slice(-maxEntries);
  const errorCount = visibleEntries.filter(e => e.level === 'error').length;

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries]);

  return (
    <Card
      title="Activity Console"
      variant={errorCount > 0 ? 'alert' : 'default'}
      headerActions={
        <>
          {errorCount > 0 && (
            <Badge variant={LEVEL_BADGE_VARIANT.error}>{errorCount} err</Badge>
          )}
          <Button variant="ghost" size="small" onClick={onClear}>
            <Terminal size={12} />
            Clear
          </Button>
        </>
      }
    >
      <div ref={scrollRef} className={styles.console}>
        {visibleEntries.length === 0 && (
          <p className={styles.idle}>No activity — waiting for events…</p>
        )}
        {visibleEntries.map(entry => (
          <div key={entry.id} className={`${styles.line} ${LEVEL_CLASS[entry.level]}`}>
            <span className={styles.ts}>
              {new Date(entry.timestamp).toLocaleTimeString('en-GB')}
            </span>
            <span className={styles.source}>[{entry.source}]</span>
            <span className={styles.msg}>{entry.message}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

