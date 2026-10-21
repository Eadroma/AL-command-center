import fs from 'node:fs';
import vm from 'node:vm';
import { expect, it } from 'vitest';
it('stops repeated rejected destinations, permits alternatives and resets on real movement', async () => {
 let calls=0;
 const c={character:{name:'Ranger',map:'main',x:0,y:0,moving:false,q:{}},Date,Math,setInterval:()=>0,game_log:()=>{},smart_move:async (destination:string)=>{calls++;if(destination==='bad')throw {reason:'invalid'};return {success:true};}};
 const context=vm.createContext(c);vm.runInContext(fs.readFileSync(new URL('../../code/movement-watchdog.js', import.meta.url),'utf8'),context);
 for(let i=0;i<3;i++)await expect(context.smart_move('bad')).rejects.toMatchObject({reason:'invalid'});
 await expect(context.smart_move('bad')).rejects.toMatchObject({reason:'route_suspended'});expect(calls).toBe(3);
 expect(context.MovementWatchdog.snapshot().state).toBe('blocked');
 await expect(context.smart_move('main')).resolves.toMatchObject({success:true});expect(calls).toBe(4);
 c.character.x=10;await expect(context.smart_move('bad')).rejects.toMatchObject({reason:'invalid'});expect(calls).toBe(5);
});
it('never treats cancellation or network interruption as an inaccessible destination',async()=>{
 let calls=0;const c={character:{name:'Ranger',map:'main',x:0,y:0},Date,Math,setInterval:()=>0,game_log:()=>{},smart_move:async()=>{calls++;throw {reason:'interrupted'};}};
 const context=vm.createContext(c);vm.runInContext(fs.readFileSync(new URL('../../code/movement-watchdog.js', import.meta.url),'utf8'),context);
 for(let i=0;i<5;i++)await expect(context.smart_move('boss')).rejects.toMatchObject({reason:'interrupted'});
 expect(calls).toBe(5);
});
