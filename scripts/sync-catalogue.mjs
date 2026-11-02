import fs from 'node:fs/promises';
import sharp from 'sharp';
const catalog=JSON.parse(await fs.readFile('src/catalog.json','utf8'));
const collections=JSON.parse(await fs.readFile('src/collections.json','utf8'));
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function sticker(item){
 const label=esc(item.title+(item.rare?' · rare':'')+', décoller et déplacer');
 const sparkles=item.rare?'<span class="sparkle-ring" aria-hidden="true">'+Array(8).fill('<i></i>').join('')+'</span>':'';
 return `<div class="${item.rare?'rare-slot':'sticker-slot'} is-unowned"><button class="peel-sticker${item.rare?' rare-sticker':''}" data-sticker-id="${item.id}" type="button" disabled aria-label="${label}">${sparkles}<img src="${item.src}" alt="" data-rect="${(item.rect||[0,0,1,1]).join(',')}"></button></div>`;
}
const active=catalog.filter(item=>item.active!==false);
const collectionIds=new Set(collections.map(group=>String(group.id)));
if(active.some(item=>!collectionIds.has(String(item.collection))))throw Error('Un sticker actif ne possède pas de planche.');
let markup=`        <section class="collection" aria-label="Banque de stickers"><div class="collection-tabs" role="tablist" aria-label="Choisir une planche">`;
for(const [index,c] of collections.entries()){
 const logo=c.logo||'';
 const subtitle=c.subtitle||(c.title.includes('—')?c.title.split('—').slice(1).join('—').trim():'');
 const family=c.family||subtitle||(c.special?'Édition spéciale':'Collection');
 const items=active.filter(item=>String(item.collection)===String(c.id));
 if(items.length!==4)throw Error(`La planche ${c.title} doit contenir exactement quatre stickers.`);
 markup+=`<button class="collection-tab${index?'':' is-active'}" id="collection-tab-${esc(c.id)}" type="button" role="tab" aria-selected="${!index}" aria-controls="collection-window" data-collection="${esc(c.id)}" data-key="${esc(c.key)}" data-title="${esc(c.title)}" data-tone="${esc(c.tone||'#b8c0ae')}" data-family="${esc(family)}" data-special="${Boolean(c.special)}" data-logo="${esc(logo)}">${esc(c.title)}</button>`;
}
const first=collections[0];
markup+=`</div><section class="collection-window" id="collection-window" role="tabpanel" aria-labelledby="collection-tab-${esc(first.id)}" data-collection="${esc(first.id)}"><div class="collection-content"><h2 class="collection-heading" id="collectionTitle">${esc(first.title)}</h2>`;
for(const c of collections){
 const items=active.filter(item=>String(item.collection)===String(c.id));
 const ordered=[...items.filter(item=>!item.rare),...items.filter(item=>item.rare)];
 markup+=`<div class="sticker-grid" data-sticker-collection="${esc(c.id)}" aria-label="Stickers de la planche ${esc(c.title)}">${ordered.map(sticker).join('')}</div>`;
}
markup+='</div></section></section>\n';
markup+='<div class="legacy-stickers" hidden aria-hidden="true">'+catalog.filter(item=>item.active===false).map(sticker).join('')+'</div>\n';
let html=await fs.readFile('web/index.html','utf8');
const start=html.indexOf('        <section class="collection"');
const end=html.lastIndexOf('      </div>\n    </section>\n  </main>');
if(start<0||end<0)throw Error('Catalogue insertion point missing');
html=html.slice(0,start)+markup+html.slice(end);await fs.writeFile('web/index.html',html);
let pouch=await fs.readFile('web/pochette.html','utf8');
pouch=pouch.replace(/(<script type="application\/json" id="sticker-pool">)[\s\S]*?(<\/script>)/,(_,a,b)=>a+JSON.stringify(catalog.filter(i=>i.active!==false))+b);
await fs.writeFile('web/pochette.html',pouch);
// Trace each new alpha silhouette for the same die-cut empty slot treatment.
for(const item of catalog){
 const target='web/'+item.src.replace(/\.webp$/,'.outline.svg');
 try{await fs.access(target);continue;}catch{}
 let raw;try{raw=await sharp('web/'+item.src).resize(96,96,{fit:'fill'}).ensureAlpha().raw().toBuffer();}catch{continue;}
 const size=96,inside=(x,y)=>x>=0&&y>=0&&x<size&&y<size&&raw[(y*size+x)*4+3]>70;
 const edges=new Map();const add=(x,y,a,b)=>{const key=x+','+y;if(!edges.has(key))edges.set(key,[]);edges.get(key).push([a,b]);};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(inside(x,y)){
  if(!inside(x,y-1))add(x,y,x+1,y);
  if(!inside(x+1,y))add(x+1,y,x+1,y+1);
  if(!inside(x,y+1))add(x+1,y+1,x,y+1);
  if(!inside(x-1,y))add(x,y+1,x,y);
 }
 let path='';
 while(edges.size){
  const start=edges.keys().next().value;let current=start,points=[];
  do{const [x,y]=current.split(',').map(Number);points.push([x,y]);const next=edges.get(current)?.pop();if(!edges.get(current)?.length)edges.delete(current);if(!next)break;current=next.join(',');}while(current!==start&&points.length<40000);
  if(points.length<10)continue;
  const simple=points.filter((p,i)=>{const a=points[(i+points.length-1)%points.length],b=points[(i+1)%points.length];return (p[0]-a[0])*(b[1]-p[1])!==(p[1]-a[1])*(b[0]-p[0]);});
  path+='M'+simple.map(p=>p.map(n=>(n/size*100).toFixed(2)).join(',')).join('L')+'Z';
 }
 await fs.writeFile(target,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="${path}" fill="#9a9f95" fill-opacity=".2" stroke="#8e9789" stroke-width=".65" stroke-dasharray="1 1.4" fill-rule="evenodd"/></svg>`);
}
console.log(`Catalogue synchronisé : ${catalog.filter(i=>i.active!==false).length} stickers, ${collections.length} planches.`);
