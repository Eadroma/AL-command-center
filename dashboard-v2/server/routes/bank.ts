import { remote } from '../deploy';
import { upgradeResolutionSchema } from '../../shared/upgrade-history';
/**
 * @file bank.ts
 * Explicit operator commands for the merchant's bank maintenance worker.
 */

import type { FastifyPluginAsync } from 'fastify';
import { scripts, initialProfile } from '../scripts';
import { getProfile, log } from '../store';
import { telemetry } from './telemetry';
import { wsManager } from '../ws';

export const bankRoute: FastifyPluginAsync = async (app) => {
  app.post<{Body:{slot:number;name:string;level:number;quantity:number}}>('/api/bank/deposit',async(req,reply)=>{
    const selection=req.body;
    if(!selection||!Number.isInteger(selection.slot)||selection.slot<0||selection.slot>255||typeof selection.name!=='string'||selection.name.length>80||!Number.isInteger(selection.level)||selection.level<0||!Number.isInteger(selection.quantity)||selection.quantity<1)return reply.code(400).send({error:'Select an inventory item.'});
    const current=await getProfile(initialProfile(scripts()));const merchant=current.profile.characters.find(c=>c.enabled&&c.ctype==='merchant');
    if(!merchant)return reply.code(400).send({error:'An enabled merchant is required.'});
    try{const command=telemetry.enqueueDeposit(merchant.name,selection);await log('Manual bank deposit queued: '+selection.name,merchant.name);return {ok:true,command};}
    catch(e){return reply.code(409).send({error:(e as Error).message});}
  });
  app.post<{Body:{item:string;paused:boolean}}>('/api/merchant/upgrade/pause',async(req,reply)=>{
    const current=await getProfile(initialProfile(scripts()));
    const merchant=current.profile.characters.find(c=>c.enabled&&c.ctype==='merchant');
    const item=req.body?.item,paused=req.body?.paused;
    if(!merchant||typeof paused!=='boolean'||!current.profile.seller.upgrade.rules.some(r=>r.item===item))return reply.code(400).send({error:'Select a configured upgrade rule.'});
    const code=`var pauses=get('alcc:upgrade-pauses:'+character.name)||{};pauses[${JSON.stringify(item)}]=${paused};set('alcc:upgrade-pauses:'+character.name,pauses);(__ALCC.upgrade.rules||[]).forEach(function(r){if(r.item===${JSON.stringify(item)})r.paused=${paused};});game_log('Upgrade ${paused?'paused':'resumed'}: '+${JSON.stringify(item)});`;
    const result=await remote('browser_code_eval',{character:merchant.name,code});
    return {ok:true,result};
  });
  app.post<{Body:{item:string;paused:boolean}}>('/api/merchant/craft/pause',async(req,reply)=>{
    const current=await getProfile(initialProfile(scripts()));
    const merchant=current.profile.characters.find(c=>c.enabled&&c.ctype==='merchant');
    const item=req.body?.item,paused=req.body?.paused;
    if(!merchant||typeof paused!=='boolean'||!current.profile.seller.craft.rules.some(r=>r.item===item))return reply.code(400).send({error:'Select a configured craft rule.'});
    const code=`var pauses=get('alcc:craft-pauses:'+character.name)||{};pauses[${JSON.stringify(item)}]=${paused};set('alcc:craft-pauses:'+character.name,pauses);(__ALCC.craft.rules||[]).forEach(function(r){if(r.item===${JSON.stringify(item)})r.paused=${paused};});if(${paused}&&typeof craft_batch!=='undefined'&&craft_batch&&craft_batch.item===${JSON.stringify(item)}){var batches=get('alcc:craft-batches:'+character.name)||{};batches[craft_batch.item]=craft_batch.remaining;set('alcc:craft-batches:'+character.name,batches);}game_log('Craft ${paused?'paused':'resumed'}: '+${JSON.stringify(item)});`;
    const result=await remote('browser_code_eval',{character:merchant.name,code});return {ok:true,result};
  });
  app.post<{ Body: { character?: string } }>('/api/bank/sort', async (req, reply) => {
    const current = await getProfile(initialProfile(scripts()));
    const merchant = current.profile.characters.find(character => character.enabled && character.ctype === 'merchant');
    const requested = String(req.body?.character || merchant?.name || '');
    if (!merchant || requested !== merchant.name) {
      return reply.code(400).send({ error: 'Select the enabled merchant to sort the bank.' });
    }
    try {
      const command = telemetry.enqueue(merchant.name, 'sort_bank');
      await log(`Bank sort queued · command ${command.id.slice(0, 8)}`, merchant.name);
      wsManager.broadcastRefresh();
      return { ok: true, command };
    } catch (error) {
      return reply.code(409).send({ error: (error as Error).message });
    }
  });
  app.post('/api/merchant/upgrade/resolve', async (req, reply) => {
    const parsed = upgradeResolutionSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Select an outcome and explicitly verify the inventory and bank evidence.' });
    const current = await getProfile(initialProfile(scripts()));
    const merchant = current.profile.characters.find(c => c.enabled && c.ctype === 'merchant');
    if (!merchant) return reply.code(400).send({ error: 'An enabled merchant is required.' });
    try {
      const command = telemetry.enqueue(merchant.name, 'resolve_upgrade', parsed.data);
      await log(`Upgrade resolution queued · ${parsed.data.item} · ${parsed.data.outcome}`, merchant.name);
      wsManager.broadcastRefresh();
      return { ok: true, command };
    } catch (error) { return reply.code(409).send({ error: (error as Error).message }); }
  });};
