import fs from 'node:fs/promises';
import path from 'node:path';

/** Refresh the checked-in game catalog used by selectors and sprite previews. */
const root=path.resolve(import.meta.dirname,'..');
const localDataPath=path.join(root,'../caracAL/game_files/6732/data.js');
const dataUrl=process.env.AL_GAME_DATA_URL||'https://adventure.land/data.js';
let text;
try{
 const response=await fetch(dataUrl,{signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error(`${response.status} ${dataUrl}`);
 text=await response.text();
 console.log(`Fetched game data from ${dataUrl}`);
}catch(error){
 if(process.env.AL_GAME_DATA_URL)throw error;
 text=await fs.readFile(localDataPath,'utf8');
 console.warn(`Could not fetch ${dataUrl}; using ${localDataPath}`);
}
const g=JSON.parse(text.split('\n')[0].replace(/^var G=/,'').replace(/;\s*$/,''));
const directory=path.join(root,'public/assets');
const catalog=JSON.parse(await fs.readFile(path.join(directory,'catalog.json'),'utf8'));
const skinIndex=new Map();
for(const [sheet,s] of Object.entries(g.sprites))for(let row=0;row<s.matrix.length;row++)for(let col=0;col<s.matrix[row].length;col++)if(s.matrix[row][col])skinIndex.set(s.matrix[row][col],{sheet,...s,row,col});
const needed=new Map();
for(const [id,m] of Object.entries(g.monsters)){const s=skinIndex.get(m.skin||id);if(s)needed.set(s.sheet,{...s,kind:'monster'});else console.log('Missing skin metadata',id,m.skin);}
// Full character sheets contain legacy skins that can be displayed as a single
// frame. Modern layered cosmetics are intentionally excluded: rendering only a
// body or armour layer would misrepresent the character.
for(const [sheet,s] of Object.entries(g.sprites))if(s.file.split('?')[0].startsWith('/images/tiles/characters/')){
 if(!needed.has(sheet))needed.set(sheet,{sheet,...s,kind:'character'});
}
const downloaded=new Map();const queue=[...needed.values()];
await Promise.all(Array.from({length:6},async()=>{
 while(queue.length){const s=queue.shift();const filename=`${s.kind}-${s.sheet}.png`,local=path.join(directory,filename);
 const url='https://raw.githubusercontent.com/kaansoral/adventureland_mongodb/main'+s.file.split('?')[0];
 let bytes;try{if(s.kind==='character')throw Error('Refresh character sheets');bytes=await fs.readFile(local);}catch{
  const res=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!res.ok)throw Error(`${res.status} ${url}`);
  bytes=Buffer.from(await res.arrayBuffer());if(bytes.toString('hex',0,8)!=='89504e470d0a1a0a')throw Error(`Not PNG: ${url}`);
  await fs.writeFile(local,bytes);
 }
 downloaded.set(s.sheet,{file:filename,width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),url});
 }
}));
for(const [id,m] of Object.entries(g.monsters)){
 const s=skinIndex.get(m.skin||id);if(!s)continue;
 const image=downloaded.get(s.sheet),frameWidth=image.width/(s.columns*3),frameHeight=image.height/(s.rows*4);
 // Match Adventure Land's sprite_image crop: center horizontally and bottom-align,
 // using G.dimensions so small monsters are not lost in transparent frame padding.
 const dim=g.dimensions[m.skin||id]||[frameWidth,frameHeight];
 const w=dim[0],h=dim[1];
 catalog.assets[id]={file:image.file,x:(s.col*3+1)*frameWidth+(dim[2]||0)+(frameWidth-w)/2,y:s.row*4*frameHeight+frameHeight-h,w,h,sheetWidth:image.width,sheetHeight:image.height};
}
for(const [id,s] of skinIndex){
 if(!s.file.split('?')[0].startsWith('/images/tiles/characters/'))continue;
 const image=downloaded.get(s.sheet);if(!image)continue;
 const frameWidth=image.width/(s.columns*3),frameHeight=image.height/(s.rows*4);
 const dim=g.dimensions[id]||[frameWidth,frameHeight],w=dim[0],h=dim[1];
 catalog.assets['skin:'+id]={file:image.file,x:(s.col*3+1)*frameWidth+(dim[2]||0)+(frameWidth-w)/2,y:s.row*4*frameHeight+frameHeight-h,w,h,sheetWidth:image.width,sheetHeight:image.height};
}
// Joinable event keys may differ from their representative monster key.
if(!catalog.assets.goobrawl)catalog.assets.goobrawl=catalog.assets.bgoo||catalog.assets.goo;
if(!catalog.assets.abtesting)catalog.assets.abtesting=catalog.assets.targetron||catalog.assets.target;
const itemSheets=new Map();
const itemLocations=new Map();
for(const [id,item] of Object.entries(g.items)) {
 const pos=g.positions[item.skin||id]||g.positions[id];if(!pos)continue;
 const sheet=pos[0]||'pack_20';if(!g.imagesets[sheet])continue;
 itemLocations.set(id,{sheet,pos});itemSheets.set(sheet,g.imagesets[sheet]);
}
for(const [key,sheet] of itemSheets){
 const file=`items-${key}.png`,local=path.join(directory,file),url='https://raw.githubusercontent.com/kaansoral/adventureland_mongodb/main'+sheet.file.split('?')[0];
 // Item sheets change when the game adds art while keeping the same filename.
 // Always refresh them; reusing a local file produces valid coordinates over stale pixels.
 const res=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!res.ok)throw Error(`${res.status} ${url}`);
 const bytes=Buffer.from(await res.arrayBuffer());if(bytes.toString('hex',0,8)!=='89504e470d0a1a0a')throw Error(`Not PNG: ${url}`);
 await fs.writeFile(local,bytes);
 downloaded.set('items-'+key,{file,width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),url});
}
for(const [id,{sheet,pos}] of itemLocations){const image=downloaded.get('items-'+sheet),size=g.imagesets[sheet].size;catalog.assets['item:'+id]={file:image.file,x:pos[1]*size,y:pos[2]*size,w:size,h:size,sheetWidth:image.width,sheetHeight:image.height};if(!g.monsters[id])catalog.assets[id]=catalog.assets['item:'+id];}
const existingItems=new Map(catalog.items.map(item=>[item.id,item]));
catalog.items=Object.entries(g.items).filter(([id,item])=>!item.ignore||catalog.assets['item:'+id]).map(([id,item])=>({...existingItems.get(id),id,name:item.name||existingItems.get(id)?.name||id,upgrade:!!item.upgrade,compound:!!item.compound,exchange:!!item.e,goldValue:Number(item.g)||0,stackSize:Number(item.s)||1,grades:item.grades,npcShops:Object.entries(g.npcs||{}).filter(([,npc])=>npc.role==='merchant'&&!item.cash&&npc.items?.includes(id)).map(([shop])=>shop)}));
const dropRows=(id,homeServer=false)=>(g.drops?.[homeServer?'monsters_home_server':'monsters']?.[id]||[])
 .filter(row=>Array.isArray(row)&&Number.isFinite(Number(row[0]))&&typeof row[1]==='string')
 .map(row=>({rate:Number(row[0]),item:row[1],...(Number.isFinite(Number(row[2]))?{argument:Number(row[2])}:{}),...(homeServer?{homeServer:true}:{})}));
catalog.monsters=Object.entries(g.monsters).filter(([,monster])=>!monster.unlist).map(([id,monster])=>({
 id,name:monster.name||id,hp:Number(monster.hp)||0,xp:Number(monster.xp)||0,attack:Number(monster.attack)||0,
 frequency:Number(monster.frequency)||0,damageType:['physical','magical','pure'].includes(monster.damage_type)?monster.damage_type:'physical',
 armorPiercing:Number(monster.apiercing)||0,resistancePiercing:Number(monster.rpiercing)||0,
 armor:Number(monster.armor)||0,resistance:Number(monster.resistance)||0,respawn:Number(monster.respawn)||0,
 baseGold:Number(g.monster_gold?.[id])||0,drops:[...dropRows(id),...dropRows(id,true)],
})).sort((a,b)=>a.name.localeCompare(b.name));
catalog.goldDrops={base:Number(g.drops?.gold?.base)||0,random:Number(g.drops?.gold?.random)||0,x10:Number(g.drops?.gold?.x10)||0,x50:Number(g.drops?.gold?.x50)||0};
catalog.recipes=Object.fromEntries(Object.entries(g.craft||{}).map(([id,recipe])=>[id,{
 cost:Number(recipe.cost)||0,
 ingredients:(recipe.items||[]).filter(row=>Array.isArray(row)&&typeof row[1]==='string').map(row=>({quantity:Number(row[0])||1,item:row[1],level:Number(row[2])||0})),
}]));
catalog.importedAt=new Date().toISOString();
await fs.writeFile(path.join(directory,'catalog.json'),JSON.stringify(catalog));
await fs.writeFile(path.join(directory,'sources.json'),JSON.stringify({gameVersion:g.version,source:'https://github.com/kaansoral/adventureland_mongodb',license:'https://github.com/kaansoral/adventureland_mongodb/blob/main/LICENSE',sheets:[...downloaded.values()]},null,2));
console.log(`Imported ${downloaded.size} sprite sheets; ${Object.keys(g.monsters).filter(k=>catalog.assets[k]).length}/${Object.keys(g.monsters).length} monsters have sprites.`);
console.log(`Character sprite coverage: ${[...skinIndex.keys()].filter(id=>catalog.assets['skin:'+id]).length} legacy skins.`);
console.log(`Item sprite coverage: ${catalog.items.filter(item=>catalog.assets['item:'+item.id]).length}/${catalog.items.length}`);
