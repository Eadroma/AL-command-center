import { marketPricesRoute } from './routes/market-prices';
/**
 * @file index.ts
 * Command Center Server Entrypoint (Fastify 5 + WebSockets).
 *
 * Responsibilities:
 * - Bootstraps the Fastify HTTP and WebSocket server.
 * - Applies security & CORS policies for dashboard, Vite dev, and game clients.
 * - Registers modular route plugins.
 * - Manages WebSocket live streaming via wsManager.
 * - Serves static assets and fallback SPA routing in production.
 */

import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import staticFiles from '@fastify/static';
import fs from 'node:fs';
import path from 'node:path';

import { port, rootDir } from './config';
import { wsManager } from './ws';
import { securityMiddleware } from './middleware/security';

// Route plugins
import { bootstrapRoute } from './routes/bootstrap';
import { onboardingRoute } from './routes/onboarding';
import { profileRoute } from './routes/profile';
import { buildRoute } from './routes/build';
import { deployRoute } from './routes/deploy';
import { controlRoute } from './routes/control';
import { telemetryRoute } from './routes/telemetry';
import { healthRoute } from './routes/health';
import { bankRoute } from './routes/bank';
import { incidentsRoute } from './routes/incidents';
import { caveRoute } from './routes/cave';
import { performanceRoute } from './routes/performance';
import { deploymentHistoryRoute } from './routes/deployment-history';
import { deploymentPreviewRoute } from './routes/deployment-preview';
import { operationsRoute } from './routes/operations';

export async function createServer() {
  const app = Fastify({
    logger: true,
    bodyLimit: 1024 * 1024,
  });

  // Global error handler
  app.setErrorHandler((err, req, reply) => {
    req.log.error(err);
    reply.code(400).send({
      error: err instanceof Error ? err.message : 'Request failed',
    });
  });

  // Security & CORS validation
  app.addHook('onRequest', securityMiddleware);

  // WebSocket support
  await app.register(websocket);

  // Live WebSocket feed for dashboard clients
  app.get('/live', { websocket: true }, (socket) => {
    wsManager.add(socket as any);
  });

  // Register API route plugins
  await app.register(bootstrapRoute);
  await app.register(onboardingRoute);
  await app.register(profileRoute);
  await app.register(buildRoute);
  await app.register(deployRoute);
  await app.register(controlRoute);
  await app.register(telemetryRoute);
  await app.register(healthRoute);
  await app.register(bankRoute);
  await app.register(marketPricesRoute);
  await app.register(incidentsRoute);
  await app.register(caveRoute);
  await app.register(performanceRoute);
  await app.register(deploymentHistoryRoute);
  await app.register(operationsRoute);
  await app.register(deploymentPreviewRoute);

  // Serve static assets from public/assets
  const assetsDir = path.join(rootDir, 'public/assets');
  if (fs.existsSync(assetsDir)) {
    await app.register(staticFiles, {
      root: assetsDir,
      prefix: '/assets/',
      decorateReply: false,
    });
  }

  // SPA fallback in production (when dist/ exists)
  const distDir = path.join(rootDir, 'dist');
  const isDev = process.env.npm_lifecycle_event === 'dev' || process.env.NODE_ENV === 'development';

  if (!isDev && fs.existsSync(path.join(distDir, 'index.html'))) {
    await app.register(staticFiles, {
      root: distDir,
      decorateReply: true,
    });

    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/')) {
        reply.code(404).send({ error: 'Endpoint not found' });
      } else {
        reply.sendFile('index.html');
      }
    });
  }

  return app;
}

// Start server when executed directly
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  createServer()
    .then((app) => app.listen({ port, host: '127.0.0.1' }))
    .then((address) => {
      console.log(`[Command Center] Server listening at ${address}`);
    })
    .catch((err) => {
      console.error('[Command Center] Failed to start server:', err);
      process.exit(1);
    });
}
