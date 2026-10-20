const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const {parse} = require('node:module').createRequire(path.resolve(__dirname, '../dashboard-v2/package.json'))('acorn');
const root = path.resolve(__dirname, '..');
function context(type = 'warrior', overrides = {}) {
  const moves = [], timers = [];
  const target = {id:'mob',type:'monster',mtype:'goo',hp:1000,x:30,y:0,range:25,target:'Eadroma'};
  const character = {name:'Eadroma',ctype:type,hp:1000,max_hp:1000,range:type==='warrior'?35:160,speed:60,x:0,y:0,map:'main',in:'main',s:{}};
  const players = {};
  const c = {CONFIG:{KITE_ENABLED:true,PRIEST:'Aedroma'},character,G:{monsters:{goo:{range:25}},skills:{}},
    parent:{entities:{mob:target},next_skill:{attack:Date.now()+900}},smart:{moving:false},
    get_entity:id=>c.parent.entities[id],get_player:name=>players[name],
    can_move_to:()=>true,is_on_cooldown:()=>true,stop_smart:()=>{c.smart.moving=false;},
    move:(x,y)=>{moves.push({x,y});return Promise.resolve();},game_log:()=>{},setInterval:fn=>{timers.push(fn);},
    ...overrides};
  vm.createContext(c);
  vm.runInContext(fs.readFileSync(path.join(root,'combat/formation.js'),'utf8'),c);
  return {c,target,character,players,moves,timers};
}
function extract(file, names, c) {
  const source = fs.readFileSync(path.join(root,'code',file),'utf8');
  const ast = parse(source,{ecmaVersion:'latest'});
  for(const name of names) {
    const node=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);
    assert.ok(node, name);
    vm.runInContext(source.slice(node.start,node.end), c);
  }
}
test('warrior retreats during attack cooldown',()=>{
  const {c,target,moves}=context(); c.ALCombat.engage(target,null);
  assert.ok(moves.length); assert.ok(moves[0].x<0);
  assert.ok(Math.hypot(moves[0].x-target.x,moves[0].y-target.y)>30);
});
test('warrior waits for first aggro or damage before handing movement to kiting',()=>{
  const {c,target}=context();Object.assign(c,{is_party_member:n=>n==='Aedroma'});
  extract('eadroma-warrior.js',['fight_engaged'],c);
  target.target=null;target.max_hp=1000;assert.equal(c.fight_engaged(target),false);
  target.target='Aedroma';assert.equal(c.fight_engaged(target),true);
  target.target=null;target.hp=999;assert.equal(c.fight_engaged(target),true);
});
test('warrior farm and event paths gate kiting behind the kite phase',()=>{
  const source=fs.readFileSync(path.join(root,'code','eadroma-warrior.js'),'utf8');
  assert.equal((source.match(/(?:phase|eventPhase)\s*===\s*"kite"\s*&&\s*ALCombat\.engage/g)||[]).length,2);
});
test('tank state machine approaches, secures aggro, then allows kiting',()=>{
  const {c,target}=context();Object.assign(c,{is_party_member:n=>n==='Aedroma'});
  c.tank_combat={id:null,phase:'idle',since:0,lostAt:0};
  extract('eadroma-warrior.js',['set_tank_phase','tank_phase'],c);
  target.target=null;target.hp=target.max_hp=1000;assert.equal(c.tank_phase(target),'approach');
  target.target='Eadroma';assert.equal(c.tank_phase(target),'secure');
  c.tank_combat.since=Date.now()-700;assert.equal(c.tank_phase(target),'kite');
  target.target='Aedroma';assert.equal(c.tank_phase(target),'engage');
});
test('warrior approaches when attack is ready without walking through target',()=>{
  const {c,target,moves}=context(); target.x=85;c.parent.next_skill.attack=0;
  c.ALCombat.engage(target,null);assert.ok(moves[0].x>0&&moves[0].x<target.x);
});
test('blocked retreat issues no unsafe destination',()=>{
  const {c,target,moves}=context('warrior',{can_move_to:()=>false});
  c.ALCombat.engage(target,null);assert.equal(moves.length,0);
});
test('retreat never leaves healer coverage',()=>{
  const {c,target,players,moves}=context();
  players.Aedroma={name:'Aedroma',hp:100,range:100,x:75,y:0,map:'main'};
  c.ALCombat.engage(target,null);
  for(const p of moves) assert.ok(Math.hypot(p.x-75,p.y)<=82.001);
});
test('outside healer range does not move farther away',()=>{
  const {c,target,players,moves}=context();
  players.Aedroma={name:'Aedroma',hp:100,range:100,x:150,y:0,map:'main'};
  c.ALCombat.engage(target,null);
  for(const p of moves) assert.ok(Math.hypot(p.x-150,p.y)<=151);
});
test('stoneworm retreat remains west of spawn and inside corridor',()=>{
  const {c,target,character,moves}=context();
  character.map='spookytown';character.x=490;character.y=130;
  target.mtype='stoneworm';target.x=515;target.y=130;
  c.ALCombat.engage(target,null);
  assert.ok(moves.length);for(const p of moves){assert.ok(p.x<=500);assert.ok(p.y>=37&&p.y<=221);}
});
test('nearby second attacker cannot be crossed during retreat',()=>{
  const {c,target,moves}=context();
  c.parent.entities.other={...target,id:'other',x:-35,y:0};
  c.ALCombat.engage(target,null);
  for(const p of moves) assert.ok(Math.hypot(p.x+35,p.y)>=33);
});
test('ranger reacts to an attacker other than selected target',()=>{
  const {c,target,moves}=context('ranger');target.x=140;
  c.parent.entities.other={...target,id:'other',x:15,target:'Eadroma'};
  c.ALCombat.engage(target,null);assert.ok(moves.length);
  assert.ok(Math.hypot(moves[0].x-15,moves[0].y)>15);
});
test('long-range enemies do not provoke a retreat beyond weapon range',()=>{
  const {c,target,moves}=context();target.range=420;
  c.ALCombat.engage(target,null);
  for(const p of moves) assert.ok(Math.hypot(p.x-target.x,p.y-target.y)<100);
});
test('disabled kiting and dead targets release movement ownership',()=>{
  const {c,target,moves}=context();c.CONFIG.KITE_ENABLED=false;
  assert.equal(c.ALCombat.engage(target,null),false);assert.equal(moves.length,0);
  c.CONFIG.KITE_ENABLED=true;c.ALCombat.engage(target,null);target.hp=0;
  c.ALCombat.update();assert.ok(!c.ALCombat.active());
});
test('instance transition invalidates a previous combat target',()=>{
  const {c,target}=context();c.ALCombat.engage(target,null);c.character.in='other';assert.ok(!c.ALCombat.active());
});
test('shared snapshot caches entity scans and can be refreshed explicitly',()=>{
  const {c,target}=context();const first=c.ALCombat.snapshot();c.parent.entities.second={...target,id:'second'};
  assert.equal(c.ALCombat.snapshot().monsters.length,1);assert.equal(c.ALCombat.snapshot(true).monsters.length,2);
});
test('hitbox distance measures edge clearance instead of center distance',()=>{
  const {c}=context();
  assert.equal(c.ALCombat.hitboxDistance({x:0,y:0,width:20,height:20},{x:30,y:0,width:20,height:20}),10);
});
test('target scoring favors threats to the party over untouched mobs',()=>{
  const {c,target}=context();const idle={...target,id:'idle',x:5,target:null};target.x=30;
  const picked=c.ALCombat.bestTarget([idle,target],{preferredType:'goo'});assert.equal(picked.id,'mob');
});
test('target scoring avoids a monster already covered by an incoming projectile',()=>{
  const {c,target}=context();const fresh={...target,id:'fresh',x:32,target:'Eadroma'};
  c.parent.projectiles={p1:{target:'mob',damage:target.hp}};
  assert.equal(c.ALCombat.bestTarget([target,fresh],{preferredType:'goo'}).id,'fresh');
});
test('movement timer is independent of pending communication',async()=>{
  const {c,target,moves,timers}=context();
  const background=c.ALCombat.background([()=>new Promise(()=>{})]);
  c.ALCombat.engage(target,null);timers[0]();assert.ok(moves.length);
});
test('priest does not move toward an in-range ally merely on cooldown',async()=>{
  const {c}=context('priest');let walks=0;
  Object.assign(c,{needs_heal:()=>true,is_in_range:()=>true,can_heal:()=>false,walk_to:()=>{walks++;},point_away:()=>({x:0,y:0})});
  extract('aedroma-priest.js',['close_to_heal'],c);
  assert.equal(await c.close_to_heal({name:'tank'},null),false);assert.equal(walks,0);
});
test('priest still approaches a wounded out-of-range ally',async()=>{
  const {c}=context('priest');let walks=0;
  Object.assign(c,{needs_heal:()=>true,is_in_range:()=>false,walk_to:()=>{walks++;},point_away:()=>({x:0,y:0})});
  extract('aedroma-priest.js',['close_to_heal'],c);
  assert.equal(await c.close_to_heal({name:'tank'},null),true);assert.equal(walks,1);
});
test('controlled burst preserves mana reserve including base cost',async()=>{
  const {c,character,target}=context('mage');let call;
  character.mp=1000;character.max_mp=1000;c.G.skills.cburst={mp:80};
  Object.assign(c,{two_shot:()=>false,can_use:()=>true,is_in_range:()=>true,use_skill:async(...args)=>{call=args;}});
  extract('tonerre-mage.js',['maybe_burst'],c);assert.equal(await c.maybe_burst(target),true);
  assert.equal(call[0],'cburst');assert.equal(call[1][0][1],420);
});
test('mage without controlled burst keeps reserve and basic attacks available',async()=>{
  const {c,character,target}=context('mage');character.mp=1000;character.max_mp=1000;
  Object.assign(c,{two_shot:()=>false,can_use:()=>false,is_in_range:()=>true,use_skill:()=>assert.fail('cast')});
  extract('tonerre-mage.js',['maybe_burst'],c);assert.equal(await c.maybe_burst(target),false);
});
test('Crypt safety rejects a path through a unique even with safe endpoint',()=>{
  const {c}=context();c.parent.entities={boss:{id:'boss',type:'monster',mtype:'a2',hp:100,x:50,y:0}};
  Object.assign(c,{dist2:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),is_unique:()=>true,unique_radius:()=>20});
  vm.runInContext(fs.readFileSync(path.join(root,'combat/crypt-safety.js'),'utf8'),c);
  assert.equal(c.crypt_segment_safe(0,0,100,0,null),false);
  assert.equal(c.crypt_segment_safe(0,0,0,50,null),true);
});
test('Crypt safety allows escape from inside danger but never moves deeper',()=>{
  const {c}=context();c.parent.entities={boss:{id:'boss',type:'monster',mtype:'a2',hp:100,x:10,y:0}};
  Object.assign(c,{dist2:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),is_unique:()=>true,unique_radius:()=>20});
  vm.runInContext(fs.readFileSync(path.join(root,'combat/crypt-safety.js'),'utf8'),c);
  assert.equal(c.crypt_segment_safe(0,0,-30,0,null),true);assert.equal(c.crypt_segment_safe(0,0,8,0,null),false);
});
test('merchant safety and urgent potions precede optional tasks',async()=>{
  const {c}=context('merchant');const calls=[];
  Object.assign(c,{maybe_self_pot:async()=>calls.push('pot'),flee_if_danger:async()=>{calls.push('flee');return true;}});
  extract('eadrosell-merchant.js',['tick'],c);await c.tick();assert.deepEqual(calls,['pot','flee']);
});
test('ready gathering claims the merchant tick before stand maintenance',()=>{
  const source=fs.readFileSync(path.join(root,'code','eadrosell-merchant.js'),'utf8');
  const ast=parse(source,{ecmaVersion:'latest'}),node=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='tick');
  const body=source.slice(node.start,node.end),fish=body.indexOf('await maybe_fish()'),shop=body.indexOf('await maybe_keep_shop()');
  assert.ok(fish>=0&&shop>=0&&fish<shop,'fishing must run before the first stand-maintenance call');
});
test('merchant restores its previous mainhand after fishing',()=>{
  const source=fs.readFileSync(path.join(root,'code','eadrosell-merchant.js'),'utf8');
  assert.match(source,/remember_fishing_mainhand\(\)/);
  assert.match(source,/await restore_fishing_mainhand\(\);\s*return true;/);
});
