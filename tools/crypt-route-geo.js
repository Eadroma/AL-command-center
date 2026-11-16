// Reachability grid + waypoint tour for the crypt map, from the game's data.js.
var fs=require('fs');var s=fs.readFileSync(process.argv[2],'utf8');var G;eval(s.replace(/^\s*var G\s*=/,'G='));
var g=G.geometry.crypt,M=G.maps.crypt,STEP=16,PAD=8;
function crossesX(ax,ay,bx,by){for(var i=0;i<g.x_lines.length;i++){var l=g.x_lines[i],x=l[0];if((ax-x)*(bx-x)>0&&Math.min(Math.abs(ax-x),Math.abs(bx-x))>PAD)continue;var lo=Math.min(ay,by),hi=Math.max(ay,by);if(hi<l[1]-PAD||lo>l[2]+PAD)continue;if(Math.min(ax,bx)<=x+PAD&&Math.max(ax,bx)>=x-PAD)return true;}return false;}
function crossesY(ax,ay,bx,by){for(var i=0;i<g.y_lines.length;i++){var l=g.y_lines[i],y=l[0];var lo=Math.min(ax,bx),hi=Math.max(ax,bx);if(hi<l[1]-PAD||lo>l[2]+PAD)continue;if(Math.min(ay,by)<=y+PAD&&Math.max(ay,by)>=y-PAD)return true;}return false;}
function ok(ax,ay,bx,by){return !crossesX(ax,ay,bx,by)&&!crossesY(ax,ay,bx,by);}
function k(x,y){return x+','+y}
var start=[0,0],seen={},q=[start],prev={};seen[k(0,0)]=1;
while(q.length){var c=q.shift();[[STEP,0],[-STEP,0],[0,STEP],[0,-STEP]].forEach(function(d){var nx=c[0]+d[0],ny=c[1]+d[1];if(nx<g.min_x||nx>g.max_x||ny<g.min_y||ny>g.max_y)return;var kk=k(nx,ny);if(seen[kk])return;if(!ok(c[0],c[1],nx,ny))return;seen[kk]=1;q.push([nx,ny]);});}
var cells=Object.keys(seen).map(function(t){return t.split(',').map(Number)});
function snap(p){var best=null,bd=1e18;cells.forEach(function(c){var d=(c[0]-p[0])**2+(c[1]-p[1])**2;if(d<bd){bd=d;best=c}});return {c:best,d:Math.sqrt(bd)};}
function bfs(a,b){var A=k(a[0],a[1]),B=k(b[0],b[1]),pr={},qq=[a];pr[A]=null;while(qq.length){var c=qq.shift(),ck=k(c[0],c[1]);if(ck===B)break;[[STEP,0],[-STEP,0],[0,STEP],[0,-STEP]].forEach(function(d){var n=[c[0]+d[0],c[1]+d[1]],nk=k(n[0],n[1]);if(!seen[nk]||nk in pr)return;if(!ok(c[0],c[1],n[0],n[1]))return;pr[nk]=ck;qq.push(n);});}
 if(!(B in pr))return null;var path=[],cur=B;while(cur){path.push(cur.split(',').map(Number));cur=pr[cur];}return path.reverse();}
function simplify(p){var out=[p[0]];for(var i=1;i<p.length-1;i++){var a=out[out.length-1],c=p[i+1];if(!ok(a[0],a[1],c[0],c[1]))out.push(p[i]);}out.push(p[p.length-1]);return out;}
var pts=[{id:'spawn',x:0,y:0}];M.monsters.forEach(function(m){var b=m.boundary;pts.push({id:m.type,x:(b[0]+b[2])/2,y:(b[1]+b[3])/2});});
pts.forEach(function(p){var s=snap([p.x,p.y]);p.cell=s.c;p.off=Math.round(s.d);});
// nearest-neighbour tour by BFS length, starting at vbat (static pack, natural rally point)
var order=[pts.find(function(p){return p.id==='vbat'})],left=pts.filter(function(p){return p.id!=='vbat'&&p.id!=='spawn'});
var legs=[];while(left.length){var cur=order[order.length-1],best=null,bp=null;left.forEach(function(p){var path=bfs(cur.cell,p.cell);if(path&&(!bp||path.length<bp.length)){best=p;bp=path}});if(!best){console.error('unreachable',left.map(function(p){return p.id}));break;}legs.push(simplify(bp));order.push(best);left.splice(left.indexOf(best),1);}
var back=bfs(order[order.length-1].cell,order[0].cell);if(back)legs.push(simplify(back));
var total=legs.reduce(function(s,l){for(var i=1;i<l.length;i++)s+=Math.hypot(l[i][0]-l[i-1][0],l[i][1]-l[i-1][1]);return s},0);
console.log(JSON.stringify({cells:cells.length,order:order.map(function(p){return p.id+'@'+p.cell+' off'+p.off}),legLens:legs.map(function(l){return l.length}),total:Math.round(total),door:M.doors}));
var entry=simplify(bfs(pts[0].cell,order[0].cell));console.log("entry",JSON.stringify(entry));var waypoints=[];legs.forEach(function(l){l.forEach(function(p,i){if(i===0&&waypoints.length)return;waypoints.push(p)})});
fs.writeFileSync(process.argv[3],JSON.stringify({bounds:[g.min_x,g.min_y,g.max_x,g.max_y],x_lines:g.x_lines,y_lines:g.y_lines,points:pts.map(function(p){return {id:p.id,x:Math.round(p.x),y:Math.round(p.y)}}),order:order.map(function(p){return p.id}),waypoints:waypoints,entry:entry,total:Math.round(total)}));
