/** One asynchronous route owner; completion requires an observed, stopped endpoint. */
var OwnedNavigation = (function () {
 var generation=0,active=null,last=null;
 function point(d){return {map:d.map||character.map,x:d.x,y:d.y,in:d.in,server:d.server};}
 function arrived(d,range){
  if(character.rip||character.moving||typeof smart!=='undefined'&&smart.moving||character.map!==d.map)return false;
  if(d.in!==undefined&&String(character.in)!==String(d.in))return false;
  if(d.server&&typeof parent!=='undefined'&&String(parent.server_region)+' '+String(parent.server_name)!==d.server)return false;
  return !Number.isFinite(d.x)||!Number.isFinite(d.y)||Math.hypot(character.x-d.x,character.y-d.y)<=range;
 }
 function cancel(reason){generation++;if(active){last={id:active.id,owner:active.owner,state:'cancelled',reason:reason||'cancelled',at:Date.now()};active=null;}try{if(typeof stop==='function')stop();}catch(e){}}
 function run(owner,destination,operation,range){
  var d=point(destination),key=JSON.stringify(d);range=range||45;
  if(active){if(active.owner===owner&&active.key===key)return active.promise;return Promise.reject({reason:'navigation_owned',owner:active.owner});}
  var id=++generation,row={id:id,owner:owner,key:key,destination:d,at:Date.now()};active=row;
  var timer;
  row.promise=Promise.race([Promise.resolve().then(operation),new Promise(function(_,reject){timer=setTimeout(function(){if(active===row)cancel('route_timeout');reject({reason:'route_timeout'});},180000);})]).then(async function(){
   var until=Date.now()+5000;
   while(active===row&&generation===id&&!arrived(d,range)&&Date.now()<until)await new Promise(function(resolve){setTimeout(resolve,100);});
   if(active!==row||generation!==id)throw {reason:'navigation_superseded'};
   if(!arrived(d,range))throw {reason:'arrival_unconfirmed',destination:d};
   last={id:id,owner:owner,state:'arrived',at:Date.now(),destination:d};return last;
  }).catch(function(error){if(active===row)last={id:id,owner:owner,state:'blocked',reason:error.reason||error.message||'travel_failed',at:Date.now(),destination:d};throw error;}).finally(function(){clearTimeout(timer);if(active===row)active=null;});
  return row.promise;
 }
 function install(){if(typeof walk_to!=='function')return;var original=walk_to;
  walk_to=function(destination,reason,range){var d=typeof destination==='string'?typeof SHOP_XY!=='undefined'&&SHOP_XY[destination]:destination;if(!d)return Promise.reject({reason:'unknown_destination'});return run('merchant:'+String(reason||'travel'),d,function(){return original(destination,reason,range);},range||45);};
 }
 install();
 return {run:run,cancel:cancel,arrived:arrived,snapshot:function(){return active?{id:active.id,owner:active.owner,state:'travelling',at:active.at,destination:active.destination}:last;}};
})();
