import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { throttledJsonWriter } from '../server/json-file';

afterEach(() => vi.useRealTimers());

it('coalesces writes into one atomic write per interval with the latest data', () => {
  vi.useFakeTimers();
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'alcc-json-')), 'state.json');
  let state = { n: 1 };
  const persist = throttledJsonWriter(file, () => state, 1000);
  persist(); state = { n: 2 }; persist();
  expect(fs.existsSync(file)).toBe(false);
  vi.advanceTimersByTime(1000);
  expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({ n: 2 });
  expect(fs.existsSync(`${file}.tmp`)).toBe(false);
});
