import fs from 'node:fs/promises';import sharp from 'sharp';
const catalog=JSON.parse(await fs.readFile('src/catalog.json','utf8')).filter(x=>x.active!==false),groups=JSON.parse(await fs.readFile('src/collections.json','utf8'));
const W=1400,cell=200;let y=62;const layers=[];const xml=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
function text(value,x,y,size=17,color='#3c4a3a'){return Buffer.from(`<svg width="1400" height="56"><text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${size}" fill="${color}">${xml(value)}</text></svg>`);}
layers.push({input:text(`STCK · ${catalog.length} stickers · ${groups.length} planches`,24,36,28),left:0,top:0});
for(const g of groups){
 const items=catalog.filter(x=>x.collection===g.id);layers.push({input:text(g.title+(g.special?' · Planche spéciale':''),24,30,25),left:0,top:y});y+=45;
 for(let i=0;i<items.length;i++){
  const item=items[i],x=(i%7)*cell,cy=y+Math.floor(i/7)*205;
  layers.push({input:await sharp('web/'+item.src).resize(162,162,{fit:'contain',background:'#00000000'}).png().toBuffer(),left:x+19,top:cy});
  const words=item.title.split(' ');let lines=[''];for(const word of words){if((lines.at(-1)+' '+word).length>24)lines.push(word);else lines[lines.length-1]+=(lines.at(-1)?' ':'')+word;}
  const label=Buffer.from(`<svg width="200" height="42">${lines.slice(0,2).map((line,n)=>`<text x="100" y="${17+n*17}" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" fill="#40503e">${xml(line)}${item.rare&&n===lines.length-1?' ★':''}</text>`).join('')}</svg>`);
  layers.push({input:label,left:x,top:cy+163});
 }y+=Math.ceil(items.length/7)*205+22;
}
await sharp({create:{width:W,height:y+16,channels:4,background:'#eee9db'}}).composite(layers).webp({quality:93}).toFile('art-direction/catalogue-55.webp');
console.log('art-direction/catalogue-55.webp');
