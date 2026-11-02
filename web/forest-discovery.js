(() => {
  'use strict';
  const $=id=>document.getElementById(id),stage=$('opening'),canvas=$('smokeCanvas'),ctx=canvas.getContext('2d'),prize=$('prize');
  const mask=document.createElement('canvas'),maskCtx=mask.getContext('2d',{willReadFrequently:true});
  const fog=document.createElement('canvas'),fogCtx=fog.getContext('2d');
  const motion=matchMedia('(prefers-reduced-motion: reduce)'),daily=new URLSearchParams(location.search).get('daily')==='1';
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  let phase='idle',selected=null,pendingItem=null,loading=null,stroke=null,frame=0,width=0,height=0,ratio=1,lastMeasure=0,clearingStart=0,prizePaper=null,prizeGesture=null;
  let duplicateFrame=0,duplicateTimer=0,duplicateCanvas=null;
  let anchor={x:.5,y:.5,heightRoll:.5},target={x:0,y:0},smallSize=44;
  let emptyForest=false,keyboardReveal=false,visit=0,guardianAnimations=[],guardianMushrooms=[],advanceTimer=0;
  let keyboardPoint={x:0,y:0},keyboardActive=false,keyboardErasing=false;
  const brushRadius=()=>clamp(Math.min(width,height)*.05,16,24);
  const terminal=()=>phase==='revealed'||phase==='empty';
  const guardian=$('forestGuardian'),panel=document.querySelector('.discovery-panel');
  function syncPanel(){
    if(panel){const r=panel.getBoundingClientRect();stage.style.setProperty('--forest-panel-clearance',Math.max(0,innerHeight-r.top)+'px');}
    if(width&&height)locate();
  }
  if(typeof ResizeObserver==='function'&&panel)new ResizeObserver(syncPanel).observe(panel);
  guardian?.querySelector('img')?.addEventListener('error',()=>{guardian.hidden=true;});
  const puffs=Array.from({length:30},(_,i)=>({x:(i%6+.5)/6,y:(Math.floor(i/6)+.5)/5,phase:i*2.4,r:.18+(i%4)*.025,color:['235,239,220','216,229,212','242,240,223'][i%3]}));
  $('discoveryCost').textContent=daily?'Ton sticker du jour · offert':'Une découverte · 3 champignons';
  function state(value){phase=value;stage.dataset.phase=value;document.body.dataset.discoveryPhase=value;}
  function locate(){
    // The same full three-trunk composition is used at every portrait size.
    const portrait=height>width,scale=Math.max(width/1024,height/1536);
    const imageWidth=portrait?width:1024*scale,imageHeight=portrait?height:1536*scale;
    const imageLeft=(width-imageWidth)/2,imageTop=(height-imageHeight)/2;
    const edge=smallSize/2+12;
    target.x=clamp(anchor.x*imageWidth+imageLeft,edge,width-edge);
    const header=document.querySelector('.topbar')?.getBoundingClientRect();
    let safeTop=Math.max(80,header?.bottom||0)+smallSize/2+12;
    let safeBottom=height-smallSize/2-20;
    for(const obstacle of [document.querySelector('.discovery-panel'),guardian]){
      if(!obstacle||obstacle.hidden)continue;
      const r=obstacle.getBoundingClientRect();
      if(r.width&&target.x>=r.left-smallSize&&target.x<=r.right+smallSize)
        safeBottom=Math.min(safeBottom,r.top-smallSize/2-16);
    }
    if(safeBottom<safeTop){safeTop=Math.max(64,height*.28);safeBottom=Math.max(safeTop,height*.6);}
    const low=Math.max(.29,(safeTop-imageTop)/imageHeight),high=Math.min(.68,(safeBottom-imageTop)/imageHeight);
    anchor.y=high>=low?low+anchor.heightRoll*(high-low):clamp(.29+anchor.heightRoll*.39,(safeTop-imageTop)/imageHeight,(safeBottom-imageTop)/imageHeight);
    target.y=clamp(anchor.y*imageHeight+imageTop,safeTop,safeBottom);
    if(phase!=='revealed'){prize.style.left=target.x+'px';prize.style.top=target.y+'px';prize.style.width=smallSize+'px';}
  }
  function resize(){
    cancelAnimationFrame(frame);frame=0;
    const old=document.createElement('canvas');old.width=mask.width;old.height=mask.height;if(old.width&&old.height)old.getContext('2d').drawImage(mask,0,0);
    const previousWidth=width,previousHeight=height;
    width=innerWidth;height=innerHeight;
    const radius=brushRadius();keyboardPoint={x:clamp(previousWidth?keyboardPoint.x*width/previousWidth:width/2,radius,width-radius),y:clamp(previousHeight?keyboardPoint.y*height/previousHeight:height*.43,radius,height-radius)};
    ratio=Math.min(devicePixelRatio||1,1.6);smallSize=clamp(width*.08,32,58);
    canvas.width=fog.width=Math.round(width*ratio);canvas.height=fog.height=Math.round(height*ratio);
    mask.width=Math.round(width);mask.height=Math.round(height);if(old.width&&old.height)maskCtx.drawImage(old,0,0,mask.width,mask.height);
    syncPanel();if(phase==='revealed'){prize.style.left=width/2+'px';prize.style.top=height*.43+'px';}
    render(performance.now());
  }
  function render(time){
    frame=0;if(document.hidden||terminal())return;
    fogCtx.setTransform(ratio,0,0,ratio,0,0);fogCtx.clearRect(0,0,width,height);
    fogCtx.fillStyle='#e5eadb';fogCtx.fillRect(0,0,width,height);
    const t=motion.matches?0:time*.001;
    for(const p of puffs){
      const x=p.x*width+Math.sin(t*.35+p.phase)*28,y=p.y*height+Math.cos(t*.27+p.phase)*22,r=Math.max(width,height)*p.r;
      const g=fogCtx.createRadialGradient(x,y,r*.04,x,y,r);g.addColorStop(0,`rgba(${p.color},.9)`);g.addColorStop(1,`rgba(${p.color},0)`);
      fogCtx.fillStyle=g;fogCtx.fillRect(x-r,y-r,r*2,r*2);
    }
    fogCtx.globalCompositeOperation='destination-out';fogCtx.drawImage(mask,0,0,width,height);fogCtx.globalCompositeOperation='source-over';
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.globalAlpha=phase==='clearing'?.96*(1-clamp((time-clearingStart)/(motion.matches?100:650))):.96;
    ctx.drawImage(fog,0,0);ctx.globalAlpha=1;
    if(keyboardActive&&!terminal()&&phase!=='clearing'){
      const radius=brushRadius();ctx.save();ctx.setTransform(ratio,0,0,ratio,0,0);
      ctx.beginPath();ctx.arc(keyboardPoint.x,keyboardPoint.y,radius,0,Math.PI*2);
      ctx.strokeStyle='#fff9e9';ctx.lineWidth=3;ctx.stroke();
      ctx.beginPath();ctx.arc(keyboardPoint.x,keyboardPoint.y,radius-2,0,Math.PI*2);
      ctx.strokeStyle='#526d49';ctx.lineWidth=1.2;ctx.stroke();ctx.restore();
    }
    if(phase==='clearing'&&time-clearingStart>(motion.matches?100:650)){reveal();return;}
    if(stroke&&time-lastMeasure>130){measure();lastMeasure=time;}
    if(!frame&&!terminal())frame=requestAnimationFrame(render);
  }
  function ensureFrame(){if(!frame&&!terminal())frame=requestAnimationFrame(render);}
  async function receiveMushrooms(){
    const image=guardian?.querySelector('img');
    if(motion.matches||!guardian||guardian.hidden||!image?.complete||!image.naturalWidth)return;
    const from=$('discoveryCost').getBoundingClientRect(),to=guardian.getBoundingClientRect();
    if(!from.width||!to.width)return;
    guardian.classList.add('is-receiving');
    const mushroom='<svg viewBox="0 0 28 32" aria-hidden="true"><path d="M10 17Q8 25 11 29Q14 31 18 29Q20 27 17 17Z" fill="#fff4d9" stroke="#554b36" stroke-width="1.8"/><path d="M2 17C2 10 7 3 14 3C21 3 26 10 26 17Q14 21 2 17Z" fill="#dd654e" stroke="#554b36" stroke-width="1.8"/><g fill="#fff8e9"><circle cx="8" cy="11" r="2.2"/><circle cx="16" cy="7.6" r="2.3"/><circle cx="21" cy="13.5" r="1.8"/></g></svg>';
    const x=from.left+from.width/2,y=from.top+from.height/2,dx=to.left+to.width*.74-x,dy=to.top+to.height*.47-y;
    const animations=[];
    for(let i=0;i<3;i++){
      const nut=document.createElement('span');nut.className='guardian-mushroom';nut.setAttribute('aria-hidden','true');nut.innerHTML=mushroom;
      nut.style.left=x+'px';nut.style.top=y+'px';document.body.append(nut);guardianMushrooms.push(nut);
      if(typeof nut.animate!=='function'){nut.remove();continue;}
      const animation=nut.animate([
        {transform:'translate(-50%,-50%) scale(.7)',opacity:0},
        {transform:`translate(-50%,-50%) translate(${dx*.45}px,${dy*.45-35}px) rotate(-20deg) scale(1)`,opacity:1,offset:.45},
        {transform:`translate(-50%,-50%) translate(${dx}px,${dy}px) rotate(25deg) scale(.5)`,opacity:0}
      ],{duration:500,delay:i*80,easing:'cubic-bezier(.25,.55,.45,1)',fill:'both'});
      animations.push(animation.finished.catch(()=>{}));guardianAnimations.push(animation);
    }
    // A hidden tab or an unavailable animation must never hold up discovery.
    await Promise.race([Promise.all(animations),new Promise(resolve=>setTimeout(resolve,760))]);
    for(const animation of guardianAnimations)animation.cancel();guardianAnimations=[];
    for(const nut of guardianMushrooms)nut.remove();guardianMushrooms=[];guardian.classList.remove('is-receiving');
  }
  async function start(){
    if(terminal()||phase==='clearing')return false;
    if(selected)return true;if(loading)return loading;
    if(emptyForest){state('searching');$('instruction').textContent='Que cache cette clairière ?';return true;}
    const startedVisit=visit;
    loading=Promise.resolve().then(async()=>{
      canvas.setAttribute('aria-busy','true');
      $('instruction').textContent='La forêt te réserve une surprise…';
      try{
        if(!window.STCK)throw Error('Un instant, ton album se prépare.');
        const item=pendingItem||await window.STCK.requestDraw();pendingItem=item;
        const image=new Image();image.src=item.src;image.alt='';await image.decode();
        if(startedVisit!==visit)return false;
        selected=item;prize.replaceChildren(image);prize.hidden=false;prize.classList.toggle('is-rare',!!item.rare);prize.style.setProperty('--prize-art',`url("${item.src}")`);
        if(!daily){state('paying');$('instruction').textContent='Trois champignons pour le gardien de la forêt.';await receiveMushrooms();}
        if(startedVisit!==visit)return false;
        state('searching');locate();$('instruction').textContent='Un sticker est collé sur un arbre.';$('clearLabel').textContent='Efface la brume pour le trouver.';return true;
      }catch(error){$('instruction').textContent=error.message?.replace(/\b(?:jetons?|glands?)\b/gi,match=>['jeton','gland'].includes(match.toLowerCase())?'champignon':'champignons').replace(/pochette(s?)/gi,'découverte$1')||'La découverte n’a pas chargé. Réessaie.';return false;}
      finally{canvas.removeAttribute('aria-busy');loading=null;}
    });return loading;
  }
  function erase(from,to){
    const distance=Math.hypot(to.x-from.x,to.y-from.y),steps=Math.max(1,Math.ceil(distance/8)),radius=brushRadius();
    for(let i=0;i<=steps;i++){
      const x=from.x+(to.x-from.x)*i/steps,y=from.y+(to.y-from.y)*i/steps;
      const brush=maskCtx.createRadialGradient(x,y,radius*.3,x,y,radius);brush.addColorStop(0,'#000');brush.addColorStop(.65,'#000e');brush.addColorStop(1,'#0000');
      maskCtx.fillStyle=brush;maskCtx.beginPath();maskCtx.arc(x,y,radius,0,Math.PI*2);maskCtx.fill();
    }
    ensureFrame();
  }
  function measure(){
    if(phase!=='searching')return;
    const sample=document.createElement('canvas');sample.width=24;sample.height=36;
    const c=sample.getContext('2d',{willReadFrequently:true});c.drawImage(mask,0,0,24,36);
    const data=c.getImageData(0,0,24,36).data;let all=0;for(let i=3;i<data.length;i+=4)all+=data[i]/255;
    const cleared=all/(24*36);$('clearProgress').value=Math.round(cleared*100);
    if(emptyForest){if(cleared>.55)finish();return;}
    if(!selected)return;
    const side=Math.ceil(smallSize+12),x=clamp(Math.round(target.x-side/2),0,mask.width-side),y=clamp(Math.round(target.y-side/2),0,mask.height-side);
    const pixels=maskCtx.getImageData(x,y,side,side).data;let sum=0;
    for(let i=3;i<pixels.length;i+=4)sum+=pixels[i]/255;
    if(sum/(pixels.length/4)>.7)finish();
  }
  function finish(){
    if(!['searching','idle'].includes(phase)||(!emptyForest&&!selected))return;
    stroke=null;state('clearing');clearingStart=performance.now();$('smokeControls').hidden=true;
    $('instruction').textContent=emptyForest?'La brume se dissipe…':'Tu l’as trouvé.';ensureFrame();
  }
  function reveal(){
    if(terminal())return;
    canvas.hidden=true;canvas.style.pointerEvents='none';$('instruction').hidden=true;
    if(emptyForest){
      state('empty');prize.hidden=true;$('emptyInfo').hidden=false;
      if(keyboardReveal)$('advanceForest').focus({preventScroll:true});return;
    }
    if(!selected)return;
    state('revealed');window.STCK?.drawRevealed();
    prize.removeAttribute('aria-hidden');const image=prize.querySelector('img');image.alt=selected.title;
    $('instruction').hidden=true;$('revealInfo').hidden=false;$('revealedTitle').textContent=selected.title;
    $('revealedRarity').textContent=selected.kept===false?'Déjà 2 exemplaires · ce doublon devient un champignon':selected.rare?'Édition rare · foil':selected.quantity>1?'Deuxième exemplaire':'Nouveau sticker';
    $('again').textContent=daily?'Ajouter à l’album →':'Explorer encore · 3 champignons';
    const large=clamp(width*.44,150,225),dx=target.x-width/2,dy=target.y-height*.43;
    prize.style.width=large+'px';prize.style.left=width/2+'px';prize.style.top=height*.43+'px';
    if(!motion.matches)prize.animate([{transform:`translate(-50%,-50%) translate(${dx}px,${dy}px) scale(${smallSize/large})`},{transform:'translate(-50%,-50%) rotate(-4deg)'}],{duration:480,easing:'cubic-bezier(.2,.75,.2,1)'});
    if(selected.kept===false){prize.classList.add('is-excess');prize.setAttribute('aria-label',selected.title+' · doublon converti en champignon');startDuplicateDestruction();}
    else {prize.tabIndex=0;prize.setAttribute('role','button');prize.setAttribute('aria-label',selected.title+' : glisse depuis un coin pour décoller, ou maintiens Espace.');prizePaper=window.StckPaper.attach(prize,image,{rare:selected.rare});}
    if(keyboardReveal)(selected.kept===false?$('again'):prize).focus({preventScroll:true});
  }
  function reset(forceSticker=false,advance=false){
    visit++;cancelAnimationFrame(frame);frame=0;clearDuplicate();prizePaper?.dispose();prizePaper=null;prizeGesture=null;selected=null;pendingItem=null;stroke=null;loading=null;keyboardReveal=false;keyboardErasing=false;keyboardActive=false;keyboardPoint={x:width/2,y:height*.43};
    for(const animation of guardianAnimations)animation.cancel();guardianAnimations=[];
    for(const nut of guardianMushrooms)nut.remove();guardianMushrooms=[];guardian?.classList.remove('is-receiving');
    prize.hidden=true;prize.setAttribute('aria-hidden','true');prize.removeAttribute('aria-label');prize.removeAttribute('tabindex');prize.removeAttribute('role');prize.classList.remove('is-excess');prize.replaceChildren();
    const previousEmpty=emptyForest;emptyForest=!forceSticker&&!previousEmpty&&Math.random()<.2;
    const tree=[.16,.5,.84][Math.floor(Math.random()*3)];anchor={x:tree,y:.5,heightRoll:Math.random()};
    state('idle');$('revealInfo').hidden=true;$('emptyInfo').hidden=true;$('smokeControls').hidden=false;
    $('instruction').hidden=false;$('instruction').textContent='La forêt cache parfois une surprise.';$('clearLabel').textContent='Efface la brume pour explorer.';$('clearProgress').value=0;
    $('discoveryCost').textContent=daily?'Ton sticker du jour · offert':'Une découverte · 3 champignons';
    canvas.hidden=false;canvas.style.pointerEvents='auto';resize();maskCtx.clearRect(0,0,mask.width,mask.height);ensureFrame();
    clearTimeout(advanceTimer);stage.classList.remove('is-advancing');
    if(advance&&!motion.matches){void stage.offsetWidth;stage.classList.add('is-advancing');advanceTimer=setTimeout(()=>stage.classList.remove('is-advancing'),700);}
  }
  canvas.addEventListener('pointerdown',async event=>{
    if(!['idle','searching'].includes(phase)||event.button>0)return;event.preventDefault();keyboardReveal=false;keyboardActive=false;keyboardErasing=false;const p={id:event.pointerId,x:event.clientX,y:event.clientY};stroke=p;canvas.setPointerCapture(event.pointerId);
    if(await start()){if(stroke?.id===event.pointerId)erase(stroke,stroke);else {erase(p,p);measure();}}
  });
  canvas.addEventListener('pointermove',event=>{if(!stroke||stroke.id!==event.pointerId||phase!=='searching')return;event.preventDefault();const p={id:event.pointerId,x:event.clientX,y:event.clientY};erase(stroke,p);stroke=p;});
  function endStroke(event){if(stroke?.id===event.pointerId){measure();stroke=null;}}
  for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,endStroke);
  async function keyboardWipe(from,to){
    const startedVisit=visit;
    if(await start()){
      if(visit!==startedVisit||phase!=='searching')return;
      erase(from,to);measure();
    }
  }
  canvas.addEventListener('focus',()=>{keyboardActive=true;ensureFrame();});
  canvas.addEventListener('blur',()=>{keyboardActive=false;keyboardErasing=false;ensureFrame();});
  canvas.addEventListener('keydown',async event=>{
    if(!['idle','searching','paying'].includes(phase)||event.altKey||event.ctrlKey||event.metaKey)return;
    const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
    const direction=directions[event.code];
    if(direction){
      event.preventDefault();keyboardActive=true;keyboardReveal=true;
      const from={...keyboardPoint},radius=brushRadius(),step=radius*.7*(event.shiftKey?3:1);
      keyboardPoint={x:clamp(from.x+direction[0]*step,radius,width-radius),y:clamp(from.y+direction[1]*step,radius,height-radius)};
      ensureFrame();if(keyboardErasing)await keyboardWipe(from,keyboardPoint);return;
    }
    if(event.code==='Space'||event.code==='Enter'){
      event.preventDefault();keyboardActive=true;keyboardReveal=true;keyboardErasing=true;
      await keyboardWipe({...keyboardPoint},{...keyboardPoint});
    }
  });
  canvas.addEventListener('keyup',event=>{if(event.code==='Space'||event.code==='Enter'){event.preventDefault();keyboardErasing=false;}});
  $('again').addEventListener('click',event=>{if(daily){location.href='index.html';return;}reset(false,true);if(event.detail===0)canvas.focus({preventScroll:true});});
  $('advanceForest').addEventListener('click',event=>{reset(true,true);if(event.detail===0)canvas.focus({preventScroll:true});});
  prize.addEventListener('dragstart',event=>event.preventDefault());
  prize.addEventListener('pointerdown',event=>{if(phase!=='revealed'||!prizePaper||event.button>0||prizeGesture)return;event.preventDefault();const r=prize.getBoundingClientRect();prizeGesture={id:event.pointerId,x:event.clientX,y:event.clientY,cx:(event.clientX-r.left)/r.width,cy:(event.clientY-r.top)/r.height};prize.setPointerCapture(event.pointerId);prizePaper.lift(prizeGesture.cx,prizeGesture.cy,.12);});
  prize.addEventListener('pointermove',event=>{const g=prizeGesture;if(!g||g.id!==event.pointerId)return;prizePaper?.lift(g.cx,g.cy,.12+Math.hypot(event.clientX-g.x,event.clientY-g.y)/prize.clientWidth*.85);});
  function releasePrize(event){if(prizeGesture?.id!==event.pointerId)return;prizeGesture=null;prizePaper?.release();if(prize.hasPointerCapture(event.pointerId))prize.releasePointerCapture(event.pointerId);}
  for(const type of ['pointerup','pointercancel','lostpointercapture'])prize.addEventListener(type,releasePrize);
  prize.addEventListener('keydown',event=>{if(['Space','Enter'].includes(event.code)){event.preventDefault();prizePaper?.lift(1,0,.4);}});
  prize.addEventListener('keyup',event=>{if(['Space','Enter'].includes(event.code)){event.preventDefault();prizePaper?.release();}});prize.addEventListener('blur',()=>prizePaper?.release());
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;stroke=null;keyboardErasing=false;prizeGesture=null;prizePaper?.release();}else ensureFrame();});
  window.addEventListener('resize',resize);motion.addEventListener('change',ensureFrame);
  // Duplicate paper destruction uses the same reward animation as the album.
  function clearDuplicate(){
    cancelAnimationFrame(duplicateFrame);clearTimeout(duplicateTimer);duplicateFrame=0;
    duplicateCanvas?.remove();duplicateCanvas=null;
    $('prize').classList.remove('duplicate-fragmenting','duplicate-cracking');
    $('duplicateBonus').hidden=true;$('duplicateBonus').textContent='';
  }
  function startDuplicateDestruction(){
    clearDuplicate();const result=selected,prize=$('prize'),image=prize.querySelector('img');
    duplicateTimer=setTimeout(()=>{
      if(selected!==result||phase!=='revealed')return;
      if(motion.matches){prize.classList.add('duplicate-fragmenting');if(result.duplicate_tokens){$('duplicateBonus').textContent='+1 champignon';$('duplicateBonus').hidden=false;}return;}
      prize.classList.add('duplicate-cracking');
      const size=600,source=document.createElement('canvas');source.width=source.height=size;
      const sourceCtx=source.getContext('2d');const ratio=image.naturalWidth/image.naturalHeight;
      const width=Math.min(size,size*ratio),height=Math.min(size,size/ratio);
      sourceCtx.drawImage(image,(size-width)/2,(size-height)/2,width,height);
      if(result.rare){
        sourceCtx.globalCompositeOperation='source-atop';const foil=sourceCtx.createLinearGradient(0,0,size,size);
        foil.addColorStop(0,'#e7b8ed55');foil.addColorStop(.5,'#fff7c177');foil.addColorStop(1,'#a0e1cf55');
        sourceCtx.fillStyle=foil;sourceCtx.fillRect(0,0,size,size);
      }
      duplicateCanvas=document.createElement('canvas');duplicateCanvas.className='duplicate-shreds';
      duplicateCanvas.width=duplicateCanvas.height=size;duplicateCanvas.setAttribute('aria-hidden','true');prize.append(duplicateCanvas);
      const ctx=duplicateCanvas.getContext('2d');const pieces=[];const tile=size/7;
      for(let row=0;row<7;row++)for(let col=0;col<7;col++){
        const x=col*tile,y=row*tile;pieces.push({x,y,vx:(col-3)*42+(Math.random()-.5)*100,vy:-160-Math.random()*110,spin:(Math.random()-.5)*10,jitter:Math.random()*9});
      }
      const start=performance.now();
      function fragment(now){
        const age=(now-start)/1250;ctx.clearRect(0,0,size,size);
        if(age>.12)prize.classList.add('duplicate-fragmenting');
        for(const p of pieces){
          const t=Math.max(0,age-.09);ctx.save();ctx.translate(p.x+tile/2+p.vx*t,p.y+tile/2+p.vy*t+330*t*t);
          ctx.rotate(p.spin*t);ctx.scale(1-t*.35,1-t*.35);ctx.globalAlpha=Math.max(0,1-Math.max(0,t-.3)/.65);
          ctx.beginPath();ctx.moveTo(-tile/2,-tile/2+p.jitter);ctx.lineTo(tile/2,-tile/2);ctx.lineTo(tile/2-p.jitter,tile/2);ctx.lineTo(-tile/2,tile/2-p.jitter);ctx.closePath();ctx.clip();
          ctx.drawImage(source,p.x,p.y,tile,tile,-tile/2,-tile/2,tile,tile);ctx.restore();
        }
        if(age>.64&&result.duplicate_tokens){$('duplicateBonus').textContent='+1 champignon';$('duplicateBonus').hidden=false;}
        if(age<1)duplicateFrame=requestAnimationFrame(fragment);else{duplicateCanvas?.remove();duplicateCanvas=null;prize.classList.remove('duplicate-cracking');}
      }
      duplicateFrame=requestAnimationFrame(fragment);
    },motion.matches?350:1000);
  }


  reset();
})();
