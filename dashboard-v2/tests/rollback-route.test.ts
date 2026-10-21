import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { dataDir } from '../server/config';
import { deploymentHistoryRoute } from '../server/routes/deployment-history';
import { deployments } from '../server/services/deployments-state';
import { telemetry } from '../server/routes/telemetry';
import { deploymentStatus } from '../server/deployment-status';
import { instrument, withoutTelemetry } from '../server/telemetry';

const stats = {hp:10,max_hp:20,mp:5,max_mp:10,gold:100,xp:3,level:1,map:'main',target:''};
let stored = '', failReload = false;
const calls: string[] = [];
beforeEach(() => {
  vi.stubEnv('AL_MCP_TOKEN', 'synthetic-test-token');
  calls.length = 0; failReload = false;
  delete deployments.Test;
  vi.spyOn(globalThis,'fetch').mockImplementation(async (url, options) => {
    const method = String(url).split('/').at(-1)!;
    calls.push(method);
    const body = JSON.parse(String(options?.body));
    let result = {};
    if (method === 'browser_code_status') result = {online:true};
    else if (method === 'get_code') result = {code:{code:stored,name:'CC_Test'}};
    else if (method === 'save_code') stored = body.code;
    else if (method === 'browser_code_reload' && failReload) throw Error('lost reply');
    else if (method !== 'browser_code_reload') throw Error('Unexpected remote method');
    return new Response(JSON.stringify({success:true,...result}));
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
async function fixture() {
  const old = telemetry.create('Test','old');
  const current = telemetry.create('Test','current');
  telemetry.ingest({ticket:current.ticket,character:'Test',sequence:1,stats,logs:[]});
  deployments.Test = {telemetryId:current.id,hash:'current',profileVersion:7,runtime:'browser'};
  stored = 'var currentVersion = true;';
  const directory = path.join(dataDir,'code-backups'); fs.mkdirSync(directory,{recursive:true});
  const id = crypto.randomUUID();
  fs.writeFileSync(path.join(directory,id+'.json'),JSON.stringify({character:'Test',slot:'42',code:instrument('var restoredVersion = true;','Test',old.ticket,9320)}));
  const app = Fastify(); await app.register(deploymentHistoryRoute);
  return {app,url:`/api/deployment-history/${id}/rollback`,old,current};
}
describe('rollback operation ownership and runtime identity', () => {
  it('blocks a rollback while the same character is busy without touching game CODE', async () => {
    const f = await fixture(); deployments.Test.busy = true;
    try { expect((await f.app.inject({method:'POST',url:f.url,payload:{}})).statusCode).toBe(409); expect(calls).toEqual([]); expect(deployments.Test.busy).toBe(true); }
    finally { await f.app.close(); }
  });
  it('replaces old telemetry, clears replaced metadata and waits for the new session receipt', async () => {
    const f = await fixture();
    try {
      const result = await f.app.inject({method:'POST',url:f.url,payload:{}});
      expect(result.statusCode).toBe(200);
      expect(stored).toContain('var restoredVersion = true;');
      expect(stored).not.toContain(f.old.ticket);
      expect(stored.match(/\/api\/telemetry/g)).toHaveLength(1);
      expect(deployments.Test.telemetryId).not.toBe(f.current.id);
      expect(deployments.Test.profileVersion).toBeUndefined();
      expect(deployments.Test.hash).toBe(crypto.createHash('sha256').update(stored).digest('hex'));
      expect(deploymentStatus(deployments.Test,telemetry.view(deployments.Test.telemetryId)).confirmed).toBe(false);
      const ticket = stored.match(/ticket="([a-f0-9]{64})"/)![1];
      telemetry.ingest({ticket,character:'Test',sequence:1,stats,logs:[]});
      expect(deploymentStatus(deployments.Test,telemetry.view(deployments.Test.telemetryId)).stage).toBe('Running');
      expect(deployments.Test.busy).toBe(false);
    } finally { await f.app.close(); }
  });
  it('releases ownership on a lost reload response without restoring false confirmation', async () => {
    const f = await fixture(); failReload = true;
    try { expect((await f.app.inject({method:'POST',url:f.url,payload:{}})).statusCode).toBe(409); expect(deployments.Test).toMatchObject({busy:false,confirmed:false,stage:'Rollback unconfirmed'}); expect(deployments.Test.telemetryId).not.toBe(f.current.id); }
    finally { await f.app.close(); }
  });
  it('does not strip ordinary user code or another character telemetry', () => {
    expect(withoutTelemetry('var a = 1;', 'Test')).toBe('var a = 1;');
    const other = instrument('var a = 1;','Other','a'.repeat(64),9320);
    expect(withoutTelemetry(other,'Test')).toBe(other);
  });
});
