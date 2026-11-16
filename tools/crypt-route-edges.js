// Visibility edges between crypt route nodes (clear segment with a wall margin), for crypt-run.js.
var fs=require('fs');var s=fs.readFileSync(process.argv[2],'utf8');var G;eval(s.replace(/^\s*var G\s*=/,'G='));
var g=G.geometry.crypt,PAD=14,MAX=700;
var geo=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
function segHits(ax,ay,bx,by){
  // sample the segment every 4 px and test the point against padded wall lines
  var n=Math.ceil(Math.hypot(bx-ax,by-ay)/4);
  for(var i=0;i<=n;i++){var x=ax+(bx-ax)*i/n,y=ay+(by-ay)*i/n;
    for(var j=0;j<g.x_lines.length;j++){var l=g.x_lines[j];if(Math.abs(x-l[0])<PAD&&y>=l[1]-PAD&&y<=l[2]+PAD)return true;}
    for(var k=0;k<g.y_lines.length;k++){var m=g.y_lines[k];if(Math.abs(y-m[0])<PAD&&x>=m[1]-PAD&&x<=m[2]+PAD)return true;}}
  return false;}
var nodes=[],idx={};
[geo.entry,geo.waypoints].forEach(function(line){line.forEach(function(p){var k=p[0]+','+p[1];if(!(k in idx)){idx[k]=nodes.length;nodes.push(p);}});});
var edges=nodes.map(function(){return [];}),count=0;
function link(a,b){if(edges[a].indexOf(b)<0){edges[a].push(b);edges[b].push(a);count++;}}
// consecutive points of each offline route are always linked (they came from the BFS grid)
[geo.entry,geo.waypoints].forEach(function(line){for(var i=1;i<line.length;i++){var a=idx[line[i-1][0]+','+line[i-1][1]],b=idx[line[i][0]+','+line[i][1]];if(a!==b)link(a,b);}});
for(var a=0;a<nodes.length;a++)for(var b=a+1;b<nodes.length;b++){var d=Math.hypot(nodes[a][0]-nodes[b][0],nodes[a][1]-nodes[b][1]);if(d<=MAX&&!segHits(nodes[a][0],nodes[a][1],nodes[b][0],nodes[b][1]))link(a,b);}
// connectivity check
var seen={0:1},q=[0];while(q.length){var c=q.shift();edges[c].forEach(function(n){if(!seen[n]){seen[n]=1;q.push(n);}});}
console.error('nodes',nodes.length,'edges',count,'connected',Object.keys(seen).length===nodes.length);
var near=function(x,y){return nodes.map(function(n,i){return [i,Math.hypot(n[0]-x,n[1]-y)];}).sort(function(p,q){return p[1]-q[1];})[0];};
var a=near(734,-1020),b=near(720,-1072);console.error('stuck spot near node',JSON.stringify(nodes[a[0]]),'links',JSON.stringify(edges[a[0]].map(function(i){return nodes[i];})));
process.stdout.write(JSON.stringify(edges));
