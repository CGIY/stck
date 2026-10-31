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
const normal=collections.filter(c=>!c.special);
let markup=`        <section class="collection" aria-label="Banque de stickers"><div class="collection-tabs" role="tablist" aria-label="Planches">`;
for(const [index,c] of normal.entries())markup+=`<button class="collection-tab${index?'':' is-active'}" id="collection-tab-${c.id}" type="button" role="tab" aria-selected="${!index}" aria-controls="collection-window" data-collection="${c.id}" data-title="${esc(c.title)}" data-tone="${c.tone}">${esc(c.title)}</button>`;
markup+=`</div><section class="collection-window" id="collection-window" role="tabpanel" aria-labelledby="collection-tab-${normal[0].id}" data-collection="${normal[0].id}"><div class="collection-content"><h2 class="collection-heading" id="collectionTitle">${esc(normal[0].title)}</h2>`;
for(const c of normal){
 const items=catalog.filter(i=>i.active!==false && i.collection===c.id);
 markup+=`<div class="sticker-grid" data-sticker-collection="${c.id}" aria-label="Stickers de la planche ${esc(c.title)}">${items.filter(i=>!i.rare).map(sticker).join('')}</div><div class="rare-stickers" data-rare-collection="${c.id}" hidden>${items.filter(i=>i.rare).map(sticker).join('')}</div>`;
}
markup+='</div></section></section>\n';
const specials=collections.filter(c=>c.special);
if(specials.length)markup+='<section class="special-collection" aria-label="Planches spéciales"><h2>Planches spéciales</h2><div class="specials-grid">';
for(const c of specials){
 const logo=c.key==='monoprix'?'monoprix-rubber.webp':'rougegorge-rubber.webp';
 markup+=`<article class="sticker-sheet special-sheet is-front is-undiscovered" data-collection="${c.id}" data-title="${esc(c.title)}" aria-label="Planche spéciale ${esc(c.title)}"><header class="sheet-heading"><div class="special-title"><span class="special-kicker">Édition spéciale</span><h3><img class="special-brand" src="assets/${logo}" alt="${esc(c.title)}"></h3></div></header><div class="sticker-grid" data-sticker-collection="${c.id}">${catalog.filter(i=>i.active!==false&&i.collection===c.id).map(sticker).join('')}</div></article>`;
}
if(specials.length)markup+='</div></section>';
markup+='<div class="legacy-stickers" hidden aria-hidden="true">'+catalog.filter(i=>i.active===false).map(sticker).join('')+'</div>\n';
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
