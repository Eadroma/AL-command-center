/**
 * @file PageHeader.tsx
 * Global dashboard page header.
 *
 * Renders the application title (eyebrow + main heading) on the left,
 * and a slot for global actions (connection badge, refresh button…) on the right.
 * Built on top of SectionHead — provides the dashboard-specific wiring.
 */

import { ThemeSelector } from './ThemeSelector';
import type { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { SectionHead, Badge, Button } from '../ui';

// ---------------------------------------------------------------------------
// Props & Component
// ---------------------------------------------------------------------------

export interface PageHeaderProps {
  /** True when the WebSocket / API connection is live. */
  connected: boolean;
  /** Called when the user clicks the Refresh button. */
  onRefresh?: () => void;
  search?: ReactNode;
}

/**
 * PageHeader
 *
 * Pinned at the top of the page inside AppShell's sticky header region.
 * Connection status drives the badge colour (green = live, amber = reconnecting).
 */
export function PageHeader({ connected, onRefresh, search }: PageHeaderProps) {
  return (
    <SectionHead eyebrow="Adventure Land" title="Command Center">
      {search}
      <ThemeSelector />
      <Badge variant={connected ? 'success' : 'warning'}>
        {connected ? 'Live' : 'Reconnecting…'}
      </Badge>
      <Button variant="secondary" size="small" onClick={onRefresh}>
        <RefreshCw size={13} />
        Refresh
      </Button>
    </SectionHead>
  );
}

