import {expect,it} from 'vitest';
import {aggregateAskingPrices} from '../shared/market-prices';
it('separates levels, excludes buys, stale offers and duplicate merchant asks',()=>{
 const now=Date.now(), fresh=new Date(now).toISOString();
 const prices=aggregateAskingPrices([{id:'A',lastSeen:fresh,slots:{trade1:{name:'coat',level:0,price:100},trade2:{name:'coat',price:100},trade3:{name:'coat',level:1,price:500},trade4:{name:'coat',price:999,b:true}}},{id:'B',lastSeen:fresh,slots:{trade1:{name:'coat',price:300},trade2:{name:'coat',price:-5}}},{id:'old',lastSeen:new Date(now-8*86400000).toISOString(),slots:{trade1:{name:'coat',price:9999}}}],now);
 expect(prices.find(p=>p.level===0)).toMatchObject({average:200,median:200,offers:2,minimum:100,maximum:300});
 expect(prices.find(p=>p.level===1)).toMatchObject({average:500,offers:1});
 expect(()=>aggregateAskingPrices({})).toThrow();
});
