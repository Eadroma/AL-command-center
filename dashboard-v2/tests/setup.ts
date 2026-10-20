import path from 'node:path';
import fs from 'node:fs';

// A test import of store.ts must never open the user's active game database.
const base = process.env.ALCC_TEST_DATA_ROOT ||= process.env.ALCC_DATA_DIR || path.resolve(import.meta.dirname, '../.tmp/test-data');
process.env.ALCC_DATA_DIR = path.join(base, `worker-${process.pid}`);
fs.mkdirSync(process.env.ALCC_DATA_DIR, { recursive: true });
process.env.AL_CODE_DIR = path.resolve(import.meta.dirname, '../../code');
