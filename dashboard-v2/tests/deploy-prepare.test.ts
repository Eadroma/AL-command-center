import { expect, it } from 'vitest';
import { deployCode } from '../server/deploy';
it('prepares verified offline worker CODE without browser reload or startup', async () => {
  const calls: string[] = [];
  const result = await deployCode('Worker', 'source', 'unused', async method => {
    calls.push(method); if (method === 'list_codes') return { codes: [] }; if (method === 'get_code') return { code: { code: 'source' } }; return { success: true };
  }, undefined, true);
  expect(calls).toEqual(['list_codes', 'save_code', 'get_code']); expect(result.stage).toBe('Prepared'); expect(result.confirmed).toBe(false);
});
