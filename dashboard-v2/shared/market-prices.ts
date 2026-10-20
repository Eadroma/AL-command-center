/** Indicative asking prices, never completed-sale valuations. */
export interface MarketPrice { item:string; level:number; average:number; median:number; minimum:number; maximum:number; offers:number; }
export function aggregateAskingPrices(merchants:unknown, now=Date.now()):MarketPrice[] {
 if(!Array.isArray(merchants)) throw new Error('Invalid ALData response');
 const groups=new Map<string,number[]>(), seen=new Set<string>();
 for(const m of merchants) {
  if(!m || typeof m.id!=='string' || !Number.isFinite(Date.parse(m.lastSeen)) || now-Date.parse(m.lastSeen)>7*86400000) continue;
  for(const [slot,it] of Object.entries(m.slots??{}) as [string,any][]) {
   if(!/^trade\d+$/.test(slot)||!it||it.b||it.buy||it.give||it.receive||typeof it.name!=='string'||!Number.isFinite(it.price)||it.price<=0||it.price>2e12) continue;
   const level=it.level??0; if(!Number.isInteger(level)||level<0||level>20)continue;
   const key=it.name+':'+level, offer=m.id+':'+key+':'+it.price;
   if(seen.has(offer))continue; seen.add(offer);
   const prices=groups.get(key)??[];prices.push(it.price);groups.set(key,prices);
  }
 }
 return [...groups].map(([key,prices])=>{prices.sort((a,b)=>a-b);const split=key.lastIndexOf(':');return {item:key.slice(0,split),level:Number(key.slice(split+1)),average:Math.round(prices.reduce((a,b)=>a+b,0)/prices.length),median:Math.round((prices[Math.floor((prices.length-1)/2)]+prices[Math.floor(prices.length/2)])/2),minimum:prices[0],maximum:prices[prices.length-1],offers:prices.length};});
}
