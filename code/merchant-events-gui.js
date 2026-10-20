/** Server events HUD inspired by enhance-comm-ui ServerInfo/BossBar.
 * Local server announcements only; no joins, switches or combat commands. */
var MerchantEventsGUI=(function(){
 var root,body,timer,icons={};
 function model(now){
  var server=typeof parent!=='undefined'&&parent.S;
  if(!server)return null;
  return Object.keys(server).filter(function(id){var event=server[id];return event&&typeof event==='object'&&(event.live===true||event.active===true||Number(event.hp)>0||event.spawn!=null);}).map(function(id){
   var event=server[id],def=typeof G!=='undefined'&&G.monsters&&G.monsters[id];
   var active=event.live===true||event.active===true||(event.live!==false&&event.active!==false&&Number(event.hp)>0);
   var spawn=null;
   if(!active&&event.spawn!=null){var parsed=typeof event.spawn==='number'?event.spawn:Date.parse(event.spawn);if(isFinite(parsed)&&parsed>100000000000)spawn=Math.max(0,parsed-now);}
   return {id:id,name:def&&def.name||id,active:active,hp:typeof event.hp==='number'&&isFinite(event.hp)?event.hp:null,maxHp:typeof event.max_hp==='number'&&isFinite(event.max_hp)?event.max_hp:null,map:typeof event.map==='string'?event.map:'',remaining:spawn};
  }).sort(function(a,b){return Number(b.active)-Number(a.active)||(a.remaining===null?Infinity:a.remaining)-(b.remaining===null?Infinity:b.remaining)||a.name.localeCompare(b.name);}).slice(0,25);
 }
 function el(tag,text){var node=parent.document.createElement(tag);if(text!==undefined)node.textContent=text;return node;}
 function bossIcon(row){
  if(icons[row.id])return icons[row.id];
  var frame=el('div');frame.style.cssText='position:relative;flex:0 0 48px;width:48px;height:52px;overflow:hidden;image-rendering:pixelated';frame.setAttribute('role','img');frame.setAttribute('aria-label',row.name+' sprite');
  try{
   if(typeof parent.sprite==='function'&&typeof G!=='undefined'&&G.monsters&&G.monsters[row.id]){
    var html=parent.sprite(row.id,{full:true,scale:1});
    if(typeof html==='string'&&html.indexOf('<div')>=0){
     frame.innerHTML=html;var sprite=frame.firstElementChild;
     var width=parseFloat(sprite.style.width)||48,height=parseFloat(sprite.style.height)||52,scale=Math.min(1,48/width,52/height);
     sprite.style.position='absolute';sprite.style.left=(48-width*scale)/2+'px';sprite.style.top=(52-height*scale)/2+'px';sprite.style.transformOrigin='top left';sprite.style.transform='scale('+scale+')';
     icons[row.id]=frame;return frame;
    }
   }
  }catch(e){}
  frame.textContent='?';frame.style.color='#a7b5c7';frame.setAttribute('aria-label',row.name+' · sprite unavailable');return frame;
 }
 function render(){
  if(typeof parent==='undefined'||!parent.document||typeof MerchantMissionGUI==='undefined')return;
  if(!root||!root.isConnected){
   var old=parent.document.getElementById('alcc-merchant-events');if(old)old.remove();root=el('details');root.id='alcc-merchant-events';root.open=true;
   root.style.cssText='position:fixed;left:675px;top:88px;width:300px;max-height:65vh;overflow:auto;z-index:2100;background:#101722f5;color:#eaf0f8;border:1px solid #394759;border-radius:12px;padding:12px;font:13px/1.5 Arial,sans-serif;box-shadow:0 8px 28px #0006;box-sizing:border-box';
   var title=el('summary','World events · current server');root.appendChild(title);body=el('div');body.style.cssText='display:grid;gap:8px;margin-top:12px';root.appendChild(body);parent.document.body.appendChild(root);MerchantMissionGUI.makeMovable(root,title);MerchantMissionGUI.makeCloseable(root,title,'World events');
  }
  if(root.style.display==='none'||!root.open)return;
  var scroll=root.scrollTop;body.replaceChildren();var rows=model(Date.now());
  if(rows===null)body.appendChild(el('p','Server announcements unavailable.'));
  else if(!rows.length)body.appendChild(el('p','No active or scheduled events announced by this server.'));
  else rows.forEach(function(row){var card=el('section');card.style.cssText='padding:10px;background:#1b2533;border-radius:8px;border-left:3px solid '+(row.active?'#65d3b4':'#e4b85d');var heading=el('div');heading.style.cssText='display:flex;align-items:center;gap:10px';heading.appendChild(bossIcon(row));heading.appendChild(el('strong',row.name));card.appendChild(heading);
   var state=el('div',row.active?'Active':row.remaining!==null?'Announced in '+Math.ceil(row.remaining/60000)+' min':'Inactive · spawn time unavailable');state.style.cssText='color:#a7b5c7;font-size:11px';card.appendChild(state);
   if(row.map)card.appendChild(el('div',row.map));
   if(row.hp!==null)card.appendChild(el('div','HP '+Math.round(row.hp).toLocaleString()+(row.maxHp!==null?' / '+Math.round(row.maxHp).toLocaleString():'')));
   body.appendChild(card);
  });
  var note=el('small','Current server only · announced HP can lag behind combat. Disappearance does not prove a kill. No automatic participation changes.');note.style.cssText='color:#a7b5c7';body.appendChild(note);root.scrollTop=scroll;if(root.__alccClamp)root.__alccClamp();
 }
 function safeRender(){try{render();}catch(e){}}
 function stop(){if(timer)clearInterval(timer);if(root)root.remove();}
 function install(){if(typeof parent==='undefined'||!parent.document)return;var old=parent.__alccEventsHud;if(old&&old.stop)old.stop();parent.__alccEventsHud={stop:stop};safeRender();timer=setInterval(safeRender,2000);}
 return {model:model,bossIcon:bossIcon,install:install,stop:stop};
})();
MerchantEventsGUI.install();
