/**
 * @file security.ts
 * Security middleware: host verification and CORS headers.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { port, allowedOrigins } from '../config';

const ADVENTURE_LAND_ORIGIN_REGEX = /^https:\/\/(?:[a-z0-9-]+\.)?adventure\.land$/;

/**
 * Validates request Host and Origin headers to protect the local server.
 */
export async function securityMiddleware(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const origin = req.headers.origin;
  const host = req.headers.host;

  // 1. In-game client telemetry reporting from adventure.land iframe
  if (req.url === '/api/telemetry' && origin && ADVENTURE_LAND_ORIGIN_REGEX.test(origin)) {
    if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) {
      reply.code(403).send({ error: 'Invalid host.' });
      return;
    }

    reply
      .header('Access-Control-Allow-Origin', origin)
      .header('Vary', 'Origin')
      .header('Access-Control-Allow-Methods', 'POST, OPTIONS')
      .header('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      reply.code(204).send();
      return;
    }
    return;
  }

  // 2. Allow local dashboard frontend (Vite dev 5173 or server 9320)
  if (origin) {
    if (allowedOrigins.has(origin)) {
      reply
        .header('Access-Control-Allow-Origin', origin)
        .header('Vary', 'Origin')
        .header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        .header('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        reply.code(204).send();
        return;
      }
    } else {
      reply.code(403).send({ error: 'This local service only accepts its own dashboard.' });
      return;
    }
  }

  // 3. Host validation
  if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}` && host !== `127.0.0.1:5173` && host !== `localhost:5173`) {
    reply.code(403).send({ error: 'Invalid host.' });
    return;
  }
}
