/**
 * @file useLiveFeed.ts
 * WebSocket hook that connects to /live and triggers cache invalidation on server events.
 */

import { useEffect, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useLiveFeed() {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const reconnectTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let isDisposed = false;

    function connect() {
      if (isDisposed) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/live`;

      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          if (isDisposed) return;
          setConnected(true);
          // A reconnect may follow missed profile or deployment notifications.
          void queryClient.invalidateQueries({ queryKey: ['bootstrap'] });
          void queryClient.invalidateQueries({ queryKey: ['deployments'] });
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'refresh') {
              // Invalidate both bootstrap and deployments to re-fetch freshest state
              queryClient.invalidateQueries({ queryKey: ['bootstrap'] });
              queryClient.invalidateQueries({ queryKey: ['deployments'] });
            } else if (data.type === 'telemetry') {
              // New game telemetry only changes live runtime state, which lives in deployments.
              queryClient.invalidateQueries({ queryKey: ['deployments'] });
            }
          } catch {
            // Ignore non-json messages
          }
        };

        ws.onclose = () => {
          if (isDisposed) return;
          setConnected(false);
          // Reconnect after 3 seconds
          reconnectTimeoutRef.current = window.setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          if (ws) ws.close();
        };
      } catch {
        setConnected(false);
        reconnectTimeoutRef.current = window.setTimeout(connect, 3000);
      }
    }

    connect();

    return () => {
      isDisposed = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (ws) {
        ws.close();
      }
    };
  }, [queryClient]);

  return { connected };
}
