/**
 * @file ws.ts
 * Type-safe WebSocket connection manager for live dashboard updates.
 */

import type { WebSocket } from 'ws';

export interface RefreshEvent {
  type: 'refresh';
}

export interface TelemetryEvent {
  type: 'telemetry';
  data: unknown;
}

export type LiveEvent = RefreshEvent | TelemetryEvent;

export class WebSocketManager {
  private peers = new Set<WebSocket>();

  /**
   * Registers a newly connected client socket.
   */
  public add(socket: WebSocket): void {
    this.peers.add(socket);

    socket.on('close', () => this.peers.delete(socket));
    socket.on('error', () => this.peers.delete(socket));
  }

  /**
   * Unregisters a client socket.
   */
  public remove(socket: WebSocket): void {
    this.peers.delete(socket);
  }

  /**
   * Broadcasts a JSON-serialized event to all connected ready clients.
   */
  public broadcast(event: LiveEvent): void {
    const payload = JSON.stringify(event);
    for (const socket of this.peers) {
      if (socket.readyState === 1) { // WebSocket.OPEN
        try {
          socket.send(payload);
        } catch {
          this.peers.delete(socket);
        }
      }
    }
  }

  /**
   * Tells all connected dashboards to refresh their local store / query caches.
   */
  public broadcastRefresh(): void {
    this.broadcast({ type: 'refresh' });
  }

  /**
   * Returns current active peer count.
   */
  public get peerCount(): number {
    return this.peers.size;
  }
}

export const wsManager = new WebSocketManager();
