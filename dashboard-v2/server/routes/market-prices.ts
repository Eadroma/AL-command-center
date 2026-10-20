import type { FastifyPluginAsync } from 'fastify';
import { aggregateAskingPrices } from '../../shared/market-prices';
let cache:{fetchedAt:number;prices:ReturnType<typeof aggregateAskingPrices>}|undefined;
let pending:Promise<NonNullable<typeof cache>>|undefined;
async function readPrices(){
 if(cache&&Date.now()-cache.fetchedAt<300000)return cache;
 if(!pending)pending=(async()=>{const response=await fetch('https://aldata.earthiverse.ca/merchants',{signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error('ALData unavailable');const prices=aggregateAskingPrices(await response.json());cache={fetchedAt:Date.now(),prices};return cache;})().finally(()=>{pending=undefined;});
 return pending;
}
export const marketPricesRoute:FastifyPluginAsync=async app=>{
 app.get('/api/market-prices',async(_req,reply)=>{try{return {...await readPrices(),source:'ALData merchant asking prices',stale:false};}catch{if(cache)return {...cache,source:'ALData merchant asking prices',stale:true};return reply.code(503).send({error:'ALData prices unavailable. You can still enter a price manually.'});}});
};
