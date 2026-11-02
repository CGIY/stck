import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../web/forest-discovery.js',import.meta.url),'utf8');

// Exercise the actual controller with a small DOM/canvas adapter. Pixel painting
// is stubbed; these checks protect paid draws, free empty rooms and progression.
function forest({daily=false,reduced=true,random=[.1],width=390,height=844}={}){
  let randomIndex=0,now=0,serial=0,coverage=0,draws=0,reveals=0,mushrooms=0;
  const frames=new Map(),timers=new Map(),elements=new Map();
  class Element{
    constructor(id='',tag='DIV'){
      this.id=id;this.tagName=tag;this.hidden=false;this.dataset={};this.style={setProperty(name,value){this[name]=value;},removeProperty(name){delete this[name];}};this.children=[];this.listeners=new Map();this.attributes={};this.width=0;this.height=0;this.disabled=false;this.value=0;
      const values=new Set();this.classList={add:(...v)=>v.forEach(x=>values.add(x)),remove:(...v)=>v.forEach(x=>values.delete(x)),contains:v=>values.has(v),toggle:(v,yes)=>{if(yes??!values.has(v))values.add(v);else values.delete(v);}};
    }
    addEventListener(type,listener){const list=this.listeners.get(type)||[];list.push(listener);this.listeners.set(type,list);}
    async trigger(type,event={}){await Promise.all((this.listeners.get(type)||[]).map(fn=>fn({detail:0,button:0,preventDefault(){},...event})));}
    setAttribute(key,value){this.attributes[key]=value;}
    removeAttribute(key){delete this.attributes[key];}
    append(...nodes){for(const n of nodes){this.children.push(n);if(n.className==='guardian-mushroom')mushrooms++;}}
    replaceChildren(...nodes){this.children=[...nodes];}
    remove(){}
    querySelector(selector){return selector==='img'?this.children.find(n=>n.tagName==='IMG')||null:null;}
    setPointerCapture(id){this.pointer=id;}
    hasPointerCapture(id){return this.pointer===id;}
    releasePointerCapture(){this.pointer=null;}
    focus(){this.focused=true;}
    animate(){return {finished:Promise.resolve(),cancel(){}};}
    get clientWidth(){return parseFloat(this.style.width)||180;}
    get offsetWidth(){return this.clientWidth;}
    getBoundingClientRect(){
      if(this.id==='header')return {left:0,right:width,top:0,bottom:76,width,height:76};
      if(this.id==='panel')return {left:width/2-170,right:width/2+170,top:height-160,bottom:height-18,width:340,height:142};
      if(this.id==='forestGuardian')return {left:20,right:100,top:height-250,bottom:height-170,width:80,height:80};
      if(this.id==='discoveryCost')return {left:width/2-90,right:width/2+90,top:height-40,bottom:height-25,width:180,height:15};
      const w=this.clientWidth,x=parseFloat(this.style.left)||width/2,y=parseFloat(this.style.top)||height/2;
      return {left:x-w/2,right:x+w/2,top:y-w/2,bottom:y+w/2,width:w,height:w};
    }
    getContext(){return {setTransform(){},clearRect(){},fillRect(){},drawImage(){},beginPath(){},arc(){},fill(){},save(){},restore(){},stroke(){},translate(){},rotate(){},scale(){},moveTo(){},lineTo(){},closePath(){},clip(){},createRadialGradient(){return {addColorStop(){}};},createLinearGradient(){return {addColorStop(){}};},getImageData(x,y,w,h){const data=new Uint8ClampedArray(w*h*4);for(let i=3;i<data.length;i+=4)data[i]=Math.round(coverage*255);return {data};}};}
  }
  class Image extends Element{constructor(){super('','IMG');this.complete=true;this.naturalWidth=this.naturalHeight=384;}async decode(){}}
  for(const id of ['opening','smokeCanvas','prize','discoveryCost','instruction','clearLabel','clearProgress','smokeControls','revealInfo','revealedTitle','revealedRarity','again','emptyInfo','advanceForest','duplicateBonus','forestGuardian','header','panel'])elements.set(id,new Element(id,id==='smokeCanvas'?'CANVAS':'DIV'));
  for(const id of ['prize','revealInfo','emptyInfo','duplicateBonus'])elements.get(id).hidden=true;
  elements.get('forestGuardian').append(new Image());
  const document={hidden:false,body:new Element('body'),getElementById:id=>elements.get(id),createElement:tag=>new Element('',tag.toUpperCase()),querySelector:s=>s==='.topbar'?elements.get('header'):s==='.discovery-panel'?elements.get('panel'):null,addEventListener(){}};
  const window={addEventListener(){},STCK:{async requestDraw(){draws++;return {title:'Test sticker',src:'assets/test.webp',rare:false,kept:true,quantity:1};},drawRevealed(){reveals++;}},StckPaper:{attach(){return {dispose(){},lift(){},release(){}};}}};
  const math=Object.create(Math);math.random=()=>random[Math.min(randomIndex++,random.length-1)];
  vm.runInNewContext(source,{window,document,innerWidth:width,innerHeight:height,devicePixelRatio:1,Image,Math:math,URLSearchParams,location:{search:daily?'?daily=1':''},performance:{now:()=>now},matchMedia:()=>({matches:reduced,addEventListener(){}}),requestAnimationFrame:fn=>{const id=++serial;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),setTimeout:(fn,delay)=>{const id=++serial;timers.set(id,{fn,at:now+delay});return id;},clearTimeout:id=>timers.delete(id)});
  return {el:id=>elements.get(id),click:id=>elements.get(id).trigger('click'),async key(code){await elements.get('smokeCanvas').trigger('keydown',{code});await elements.get('smokeCanvas').trigger('keyup',{code});},draws:()=>draws,reveals:()=>reveals,mushrooms:()=>mushrooms,setCoverage:value=>{coverage=value;},async advance(ms=1000){now+=ms;for(const [id,t]of[...timers])if(t.at<=now){timers.delete(id);t.fn();}const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn(now));await Promise.resolve();},phase:()=>elements.get('opening').dataset.phase};
}

test('an empty forest does not draw or claim anything; advancing guarantees a real forest',async()=>{
  for(const daily of [false,true]){
    const f=forest({daily});f.setCoverage(.56);await f.key('Space');await f.advance();
    assert.equal(f.phase(),'empty');assert.equal(f.draws(),0);assert.equal(f.reveals(),0);assert.equal(f.el('emptyInfo').hidden,false);
    await f.click('advanceForest');assert.equal(f.phase(),'idle');assert.equal(f.draws(),0);
    f.setCoverage(0);await f.key('Space');assert.equal(f.phase(),'searching');assert.equal(f.draws(),1);assert.equal(f.reveals(),0);
    f.setCoverage(.9);await f.key('Space');await f.advance();
    assert.equal(f.phase(),'revealed');assert.equal(f.draws(),1);assert.equal(f.reveals(),1);assert.equal(f.el('prize').hidden,false);
  }
});

test('an empty forest needs 55% global clearing, not a hidden target hit',async()=>{
  const f=forest();f.setCoverage(.54);
  await f.el('smokeCanvas').trigger('pointerdown',{pointerId:1,clientX:100,clientY:200});
  await f.el('smokeCanvas').trigger('pointerup',{pointerId:1});assert.equal(f.phase(),'searching');
  f.setCoverage(.56);await f.el('smokeCanvas').trigger('pointerdown',{pointerId:2,clientX:250,clientY:600});
  await f.el('smokeCanvas').trigger('pointerup',{pointerId:2});await f.advance();
  assert.equal(f.phase(),'empty');assert.equal(f.draws(),0);assert.equal(f.reveals(),0);
});

test('keyboard exploration uses the erasing threshold and never reveals or spends just by moving',async()=>{
  const f=forest({random:[.9,.5,.4]});
  await f.key('ArrowLeft');await f.key('ArrowUp');await f.advance();
  assert.equal(f.phase(),'idle');assert.equal(f.draws(),0);assert.equal(f.reveals(),0);
  await f.el('smokeCanvas').trigger('keydown',{code:'Space'});
  await f.el('smokeCanvas').trigger('keydown',{code:'ArrowRight'});
  await f.el('smokeCanvas').trigger('keyup',{code:'Space'});await f.advance();
  assert.equal(f.phase(),'searching');assert.equal(f.draws(),1);assert.equal(f.reveals(),0);
  f.setCoverage(.69);await f.key('Enter');await f.advance();assert.equal(f.phase(),'searching');assert.equal(f.reveals(),0);
  f.setCoverage(.71);await f.key('Enter');await f.advance();assert.equal(f.phase(),'revealed');assert.equal(f.draws(),1);assert.equal(f.reveals(),1);
});

test('a real paid discovery hands over three mushrooms once; daily and empty rooms do not',async()=>{
  const paid=forest({reduced:false,random:[.9,.5,.4]});await paid.key('Space');
  assert.equal(paid.draws(),1);assert.equal(paid.mushrooms(),3);assert.equal(paid.reveals(),0);assert.equal(paid.phase(),'searching');
  paid.setCoverage(.9);await paid.key('Space');await paid.advance();assert.equal(paid.reveals(),1);assert.equal(paid.mushrooms(),3);
  const daily=forest({daily:true,reduced:false,random:[.9,.5,.4]});await daily.key('Space');
  assert.equal(daily.draws(),1);assert.equal(daily.mushrooms(),0);assert.equal(daily.reveals(),0);
  const empty=forest({reduced:false,random:[.1]});empty.setCoverage(.56);await empty.key('Space');await empty.advance();assert.equal(empty.mushrooms(),0);assert.equal(empty.draws(),0);
});

test('all three trunks and a range of visible heights can be chosen before any draw',()=>{
  for(const [width,height]of[[320,568],[960,400]]){
    const positions=[];
    for(const tree of [.01,.5,.99])for(const level of [.01,.99]){
      const f=forest({width,height,random:[.9,tree,level]});const x=parseFloat(f.el('prize').style.left),y=parseFloat(f.el('prize').style.top);
      positions.push({x,y});assert.ok(x>15&&x<width-15);assert.ok(y>=64&&y<height-20);assert.equal(f.draws(),0);
    }
    assert.equal(new Set(positions.map(p=>Math.round(p.x))).size,3);
    assert.ok(new Set(positions.map(p=>Math.round(p.y))).size>2);
  }
});
