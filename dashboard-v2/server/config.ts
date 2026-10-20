/**
 * @file config.ts
 * Centralized server configuration and environment constants.
 */

import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Root directory of dashboard-v2 */
export const rootDir = path.resolve(__dirname, '..');

/** Server port (default: 9320) */
export const port = Number(process.env.ALCC_PORT || 9320);

/** Local data directory for SQLite database, telemetry cache, and bundle exports */
export const dataDir = process.env.ALCC_DATA_DIR || path.join(process.env.LOCALAPPDATA || os.homedir(), 'AdventureLandDashboard');

/** Path to JSON deployments state file */
export const deploymentFile = path.join(dataDir, 'deployments.json');

/** Path to SQLite database file */
export const sqliteFile = path.join(dataDir, 'command-center.sqlite');

/** Path to catalog JSON containing game assets and monsters */
export const catalogPath = path.join(rootDir, 'public/assets/catalog.json');

/** Path to rendered game maps and their world-coordinate bounds. */
export const mapsCatalogPath = path.join(rootDir, 'public/assets/maps/index.json');

/** Directory containing generated script bundles */
export const bundlesDir = path.join(dataDir, 'bundles');

/** Origins allowed to interact with the API */
export const allowedOrigins = new Set([
  `http://127.0.0.1:${port}`,
  `http://localhost:${port}`,
  'http://127.0.0.1:5173',
  'http://localhost:5173',
]);
