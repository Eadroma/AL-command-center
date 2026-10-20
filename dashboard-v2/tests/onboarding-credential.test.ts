import { afterEach, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alcc-onboarding-'));
vi.stubEnv('ALCC_DATA_DIR', dir);
vi.stubEnv('AL_MCP_TOKEN', '');
const { connectCredential, remote } = await import('../server/deploy');
afterEach(() => vi.unstubAllGlobals());
it('does not replace a stored credential when verification fails', async () => {
 fs.writeFileSync(path.join(dir,'credentials.json'), JSON.stringify({token:'previous-test-token'}));
 vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"failed":true,"reason":"invalid_token"}')));
 await expect(connectCredential('rejected-test-token')).rejects.toThrow('invalid_token');
 expect(JSON.parse(fs.readFileSync(path.join(dir,'credentials.json'),'utf8')).token).toBe('previous-test-token');
});
it('persists only a verified credential and reuses it for subsequent calls', async () => {
 const fetch=vi.fn().mockResolvedValue(new Response('{"success":true,"characters":[]}'));
 vi.stubGlobal('fetch',fetch);
 await connectCredential('verified-test-token');
 expect(JSON.parse(fs.readFileSync(path.join(dir,'credentials.json'),'utf8')).token).toBe('verified-test-token');
 fetch.mockResolvedValue(new Response('{"success":true,"codes":[]}'));
 await remote('list_codes');
 expect(JSON.parse(fetch.mock.calls[1][1].body).token).toBe('verified-test-token');
});
