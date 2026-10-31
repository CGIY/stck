(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const scene = $('scene'), opening = $('opening'), button = $('openPouch');
  const canvas = $('smokeCanvas'), ctx = canvas.getContext('2d');
  const mask = document.createElement('canvas');
  mask.width = mask.height = 800;
  const maskCtx = mask.getContext('2d', { willReadFrequently: true });
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const pool = JSON.parse($('sticker-pool').textContent);
  const isDailyPouch = new URLSearchParams(location.search).get('daily') === '1';
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);
  const base = {x:0,y:0,rot:0,sx:1,sy:1,close:0,anger:0,mouth:0,smile:1,gx:0,gy:0,pupil:1,jump:0,stress:0};
  let phase = 'loading', step = 0, clock = 0, lastTime = 0, phaseStart = 0, raf = 0;
  let pose = {...base}, pointer = {x:0,y:0,active:false}, gaze = {x:0,y:0};
  let sequence = [], duration = 0, nextBlink = 2600, blinkStart = -1000, scratchStart = -10000, nextScratch = 3800;
  let selected = null, assetError = false, decodeToken = 0, drawing = false;
  let stroke = null, coverage = 0, needsCoverage = false, lastCoverage = 0, dissipateStart = 0;
  let dust = [], resetFocus = false, playbackRate = 1;
  let wake = [], lastWake = 0, breeze = {x:400,y:400,vx:0,vy:0,at:-5000};
  const lengths = [0, 1500, 2750, 2050, 3650];
  // Keep each expressive pose, compress the pauses between them.
  const reactionDurations = [0, 650, 1000, 800, 1350];
  const burstDuration = 850, clearDuration = 550;
  const messages = [isDailyPouch ? 'Touchez 4 fois pour ouvrir · sticker du jour offert' : 'Touchez 4 fois pour ouvrir · 3 jetons à la première touche', 'Hé ! Ça chatouille…', 'Mais… qu’est-ce que tu fais ?', 'Je te préviens…', 'ÇA. SUFFIT.'];
  const nodes = Object.fromEntries(['torso','face','eyeWhite','eyeClipPath','eyelid','gaze','brow','mouthShape','mouthClipPath','tongue','teeth','cheek','stressMarks','rig'].map(id => [id,$(id)]));
  const set = (id, attr, value) => nodes[id].setAttribute(attr, value);

  function state(value) {
    phase = value; phaseStart = clock;
    opening.dataset.phase = value;
    if(!['reacting','burst'].includes(value)){
      playbackRate=1;opening.dataset.speed='1';$('tempoHint').hidden=true;
    }
  }
  function resting() {
    const b = {...base};
    if (step === 1) { b.gx=35; b.close=.09; b.smile=.45; }
    if (step === 2) { b.close=.17; b.smile=.1; b.rot=-1.4; }
    if (step === 3) { b.anger=.48; b.close=.12; b.smile=-.65; }
    return b;
  }
  function key(t, values) { return {t, ...resting(), ...values}; }
  function sample(keys, time) {
    if (time <= keys[0].t) return {...keys[0]};
    for (let i=1;i<keys.length;i++) {
      if (time<=keys[i].t) {
        const a=keys[i-1], b=keys[i], p=smooth(clamp((time-a.t)/(b.t-a.t)));
        return Object.fromEntries(Object.keys(base).map(k=>[k,lerp(a[k],b[k],p)]));
      }
    }
    return {...keys[keys.length-1]};
  }
  function blinkShape(elapsed) {
    const duration = 238, closeAt = 74, holdUntil = 101;
    if (elapsed < 0 || elapsed > duration) return 0;
    if (elapsed < closeAt) return smooth(elapsed / closeAt);
    if (elapsed < holdUntil) return 1;
    return 1 - smooth((elapsed - holdUntil) / (duration - holdUntil));
  }
  function makeSequence() {
    const start = {...pose,t:0};
    if(step===1) return [start,
      key(105,{y:25,sx:1.14,sy:.86,rot:-7,close:.98,mouth:.7,smile:0,stress:1}),
      key(330,{x:-34,y:-70,rot:9,sx:.92,sy:1.1,jump:55,mouth:.95,pupil:.7,gy:-25}),
      key(650,{x:12,y:15,rot:-4,sx:1.05,sy:.95,close:.5,mouth:.35}),
      key(1000,{rot:3,gx:-85,smile:.2}),
      key(1500,{})];
    if(step===2) return [start,
      key(100,{x:23,y:30,rot:8,sx:1.13,sy:.85,close:1,mouth:.8,stress:1}),
      key(370,{x:-20,y:-35,rot:-8,sx:.95,sy:1.06,mouth:.5,pupil:.72}),
      key(800,{rot:-7,gx:85,gy:-65,close:.1,mouth:.15}),
      key(1060,{rot:-5,gx:70,gy:-65}),
      key(1230,{rot:-7,gx:70,gy:-65}),
      key(1400,{rot:-5,gx:70,gy:-65}),
      key(1570,{rot:-7,gx:70,gy:-65}),
      key(1740,{rot:-5,gx:70,gy:-65}),
      key(2090,{rot:4,mouth:.2,gx:80}),
      key(2750,{})];
    if(step===3) return [start,
      key(110,{x:-27,rot:-9,y:30,sx:1.16,sy:.84,close:1,stress:1,mouth:.9}),
      key(390,{y:-55,rot:7,sx:.94,sy:1.08,jump:40,mouth:1,pupil:.6}),
      key(800,{rot:-4,anger:.6,mouth:.45,smile:-1}),
      key(1100,{rot:3,anger:.65,mouth:.1,smile:-1}),
      key(1400,{rot:-3,anger:.65,mouth:.35,smile:-1}),
      key(2050,{})];
    return [start,
      key(120,{y:35,sx:1.17,sy:.83,close:1,mouth:.9,stress:1}),
      key(450,{y:-40,rot:-5,sx:.94,sy:1.06,pupil:.6,mouth:1,smile:-1}),
      key(1100,{y:12,anger:1,close:.1,smile:-1,mouth:.18,pupil:.75}),
      key(1900,{y:5,anger:1,close:.06,smile:-1,mouth:.32,sx:1.04,sy:1.02}),
      key(2650,{y:65,anger:1,smile:-1,mouth:.12,sx:1.16,sy:.82}),
      key(3180,{y:-100,anger:1,close:0,mouth:1.3,smile:-1,sx:.86,sy:1.18,jump:90}),
      key(3650,{y:10,anger:1,close:0,mouth:1.4,smile:-1,sx:1.19,sy:1.13,jump:20})];
  }

  function drawCharacter(p) {
    opening.dataset.expression=p.anger>.9?'angry':p.close>.85?'blink':p.mouth>.6?'surprised':'curious';
    set('torso','transform','translate('+(640+p.x)+' '+(550+p.y)+') rotate('+p.rot+') skewX('+(p.rot*.14)+') scale('+p.sx+' '+p.sy+') translate(-640 -550)');
    set('face','transform','translate(640 550) scale('+(1/p.sx)+' '+(1/p.sy)+') skewX('+(-p.rot*.14)+') translate(-640 -550)');
    const c=clamp(p.close), a=clamp(p.anger);
    // Keep the eyeball circular through blinks and body squash; expression is
    // carried by gaze, brow, and mouth instead of flattening the eye.
    const d='M640 320 C722.843 320 790 387.157 790 470 C790 552.843 722.843 620 640 620 C557.157 620 490 552.843 490 470 C490 387.157 557.157 320 640 320Z';
    set('eyeWhite','d',d);
    // Clip at the inner edge of the 23-unit outline, leaving the ring intact.
    set('eyeClipPath','d','M640 332 A138 138 0 1 1 640 608 A138 138 0 1 1 640 332Z');
    set('eyeWhite','stroke-width',23);
    const lidY=330+c*280;
    set('eyelid','d',`M490 320H790V${lidY}Q640 ${lidY+30*c} 490 ${lidY}Z`);
    set('eyelid','opacity',c>.005?1:0);
    const gazeY=clamp(gaze.y+p.gy,-22,22);
    set('gaze','transform','translate('+(640+gaze.x+p.gx)+' '+(465+gazeY)+') scale('+p.pupil+')');
    // A tapered, asymmetric fold follows the orbital arch. Curvature and weight
    // change together, so anger reads as muscle tension rather than a rigid V.
    const by=260, pinch=a*86, weight=30+a*16, lift=p.gy*.05;
    set('brow','opacity',.92+a*.08);
    set('brow','d',`M400 ${by+67}
      C442 ${by-5+lift} 536 ${by-30+pinch*.45} 628 ${by-6+pinch}
      C669 ${by+6+pinch} 725 ${by-34+pinch*.27} 788 ${by-23}
      C836 ${by-15} 873 ${by+16} 889 ${by+44}
      C856 ${by+13+weight*.25} 823 ${by+3+weight*.2} 788 ${by+weight*.15}
      C729 ${by-9+pinch*.42+weight} 678 ${by+23+pinch+weight} 628 ${by+pinch+weight}
      C544 ${by-2+pinch*.46+weight} 465 ${by+8+weight} 400 ${by+67}Z`);
    const m=p.mouth, smile=p.smile;
    const mid=665+smile*42;
    const md='M520 655 Q640 '+mid+' 766 642 Q640 '+(mid+5+m*136)+' 520 655Z';
    set('mouthShape','d',md);set('mouthClipPath','d',md);
    const teeth=smooth(clamp((a-.45)/.35));
    set('teeth','opacity',teeth);set('tongue','opacity',1-teeth);
    set('tongue','cy',683+m*65);
    set('cheek','opacity',1-a*.7);
    set('stressMarks','opacity',p.stress);
    $('groundShadow').style.transform='scale('+clamp(1-p.jump*.003,.5,1.2)+')';
  }

  // Thirty separately drifting paper-coloured puffs make up the fog.
  // A stationary opaque core hides the prize until the clearing mask removes it.
  const fog=Array.from({length:30},(_,i)=>{
    const angle=i*2.399963, radius=80+Math.sqrt(i/29)*210;
    return {x:400+Math.cos(angle)*radius,y:420+Math.sin(angle)*radius*.9,
      radius:78+(i*37%70),phase:i*1.73,speed:.35+(i%7)*.065,
      color:['235,229,207','207,219,198','175,198,184','225,224,201'][i%4]};
  });
  function puff(x,y,r,color,alpha=1){
    const paint=ctx.createRadialGradient(x-r*.18,y-r*.2,r*.12,x,y,r);
    paint.addColorStop(0,`rgba(${color},${alpha})`);
    paint.addColorStop(.62,`rgba(${color},${alpha*.94})`);
    paint.addColorStop(1,`rgba(${color},0)`);
    ctx.fillStyle=paint;ctx.beginPath();ctx.ellipse(x,y,r,r*.84,0,0,Math.PI*2);ctx.fill();
  }
  function drawSmoke() {
    ctx.clearRect(0,0,800,800);
    if(!['burst','smoking','clearing'].includes(phase))return;
    const elapsed=(clock-phaseStart)/1000;
    const release=clamp((clock-dissipateStart)/clearDuration);
    const expansion=phase==='burst'&&!motion.matches?1-Math.exp(-elapsed*12)+.075*Math.sin(elapsed*12)*Math.exp(-elapsed*5):1;
    const fade=phase==='clearing'?1-smooth(release):1;
    ctx.save();ctx.globalAlpha=fade;
    ctx.translate(400,410-(phase==='clearing'?release*42:0));
    ctx.scale(expansion*(1+(phase==='clearing'?release*.14:0)),expansion);ctx.translate(-400,-410);
    ctx.fillStyle='#d5ddc7';ctx.beginPath();ctx.roundRect(168,208,464,448,92);ctx.fill();
    const t=motion.matches?0:clock*.001;
    const wind=motion.matches?0:clamp(1-(clock-breeze.at)/700);
    for(const p of fog){
      const x=p.x+Math.sin(t*p.speed+p.phase)*24+breeze.vx*wind*.3;
      const y=p.y+Math.cos(t*p.speed*.8+p.phase)*19;
      puff(x,y,p.radius*(1+Math.sin(t*.6+p.phase)*.06),p.color,.96);
    }
    ctx.restore();
    wake=wake.filter(p=>clock-p.at<850);
    if(!motion.matches)for(const p of wake){
      const age=(clock-p.at)/850;
      puff(p.x+p.vx*age,p.y+p.vy*age-age*45,36+age*42,'225,228,207',(1-age)*.24*fade);
    }
    ctx.globalCompositeOperation='destination-out';ctx.drawImage(mask,0,0);ctx.globalCompositeOperation='source-over';
    if(phase==='burst'&&!motion.matches){
      for(const p of dust){
        const life=1-elapsed/.85;if(life<=0)continue;
        const flight=elapsed*1.8;
        ctx.save();ctx.translate(400+p.vx*flight,410+p.vy*flight+100*flight*flight);ctx.rotate(flight*p.spin);
        ctx.globalAlpha=clamp(life);ctx.fillStyle=p.color;ctx.fillRect(-3,-7,6,14);ctx.restore();
      }
    }
  }
  async function prepareSticker() {
    const token=++decodeToken;
    if (!window.STCK) throw new Error('Un instant, la bibliothèque se prépare.');
    prizePaper?.dispose();prizePaper=null;
    $('prize').classList.remove('is-excess');
    selected=await window.STCK.requestDraw();
    const image=new Image();image.src=selected.src;image.alt='';assetError=false;
    try { await image.decode(); if(token!==decodeToken)return;
      $('prize').replaceChildren(image);$('prize').classList.toggle('is-rare',selected.rare);
      $('prize').style.setProperty('--prize-art', `url("${selected.src}")`);
    } catch(error) {assetError=true;throw error;}
  }
  function explode() {
    if (!$('prize').querySelector('img')) {
      state('waiting');
      $('instruction').textContent=assetError?'La surprise n’a pas chargé. Réessaie.':'Un instant…';
      if(assetError){button.disabled=false;button.setAttribute('aria-label','Réessayer le chargement');}
      return;
    }
    state('burst');canvas.hidden=false;canvas.style.pointerEvents='auto';
    $('instruction').textContent='Pouf.';
    dust=Array.from({length:32},(_,i)=>{const a=i*2.4;return{vx:Math.cos(a)*(150+i%4*40),vy:Math.sin(a)*(150+i%5*35)-80,spin:(i%2?1:-1)*5,color:i%3?'#c4af7a':'#3b6263'};});
  }
  function beginWiping() {
    state('smoking');canvas.style.pointerEvents='auto';
    $('instruction').textContent='Il a disparu. Son secret est encore là.';
    $('smokeControls').hidden=false;
    $('progress').hidden=true;
  }
  function finish() {
    if(phase!=='smoking')return;
    state('clearing');dissipateStart=clock;stroke=null;
    canvas.style.pointerEvents='none';
    $('smokeControls').hidden=true;
    $('clearProgress').value=100;
    $('instruction').textContent='Le voilà.';
  }
  function reveal() {
    state('revealed');canvas.hidden=true;window.STCK?.drawRevealed();
    $('prize').removeAttribute('aria-hidden');
    $('prize').querySelector('img').alt=selected.title;
    $('revealedTitle').textContent=selected.title;
    $('revealedRarity').textContent = selected.kept === false ? 'Déjà 3 exemplaires · ce doublon disparaît' : selected.quantity > 1 ? `Exemplaire ${selected.quantity} sur 3` : selected.rare ? 'Édition rare · 1 sur 10' : 'Nouveau sticker';
    $('prize').classList.toggle('is-excess', selected.kept === false);
    $('revealInfo').hidden=false;
    const prize=$('prize');
    prize.tabIndex=0;prize.setAttribute('role','button');
    prize.setAttribute('aria-label',selected.title+' : glisse depuis un coin pour décoller, ou maintiens Espace.');
    prizePaper=window.StckPaper.attach(prize,prize.querySelector('img'),{rare:selected.rare});
    $('again').textContent=isDailyPouch?'Ajouter à l’album →':'Pochette suivante · 3 jetons →';
    if(resetFocus)$('again').focus({preventScroll:true});
  }
  async function poke(event) {
    if(drawing)return;
    if(phase==='ready' && step===0 && !$('prize').querySelector('img')){
      drawing=true;button.disabled=true;
      try {await prepareSticker();}catch(error){$('instruction').textContent=error.message||'La pochette n’a pas chargé. Réessaie.';return;}
      finally{drawing=false;button.disabled=false;}
    }
    if(phase==='waiting' && assetError){try{await prepareSticker();button.disabled=true;}catch{$('instruction').textContent='La pochette n’a pas chargé. Réessaie.';}return;}
    if(phase==='reacting'||phase==='burst'){accelerate();return;}
    if(phase!=='ready')return;
    resetFocus=event.detail===0;
    step++;state('reacting');button.disabled=false;button.setAttribute('aria-label','Accélérer la réaction');
    $('tempoHint').hidden=false;$('tempoHint').textContent='Retouche pour accélérer';
    sequence=makeSequence();duration=motion.matches?150:reactionDurations[step];
    $('instruction').textContent=messages[step];
    [...$('progress').children].forEach((node,i)=>node.classList.toggle('done',i<step));
    $('progress').setAttribute('aria-label',step+' pressions sur 4');
    if(step===4)$('instruction').textContent='Ça suffit. Vraiment.';
  }
  function accelerate(){
    if(!['reacting','burst'].includes(phase))return;
    playbackRate=Math.min(3,playbackRate+1);opening.dataset.speed=String(playbackRate);
    $('tempoHint').textContent='×'+playbackRate+(playbackRate<3?' · retouche pour accélérer':' · vitesse maximale');
  }
  function tick(now) {
    raf=0;if(document.hidden)return;
    const dt=Math.min(lastTime?now-lastTime:16.7,40);lastTime=now;clock+=dt;
    if(phase==='reacting'||phase==='burst')phaseStart-=dt*(playbackRate-1);
    if(phase==='ready'){
      pose=resting();
      if(!motion.matches){
        const t=clock*.001;
        pose.y=Math.sin(t*2.1)*7;pose.rot+=Math.sin(t*1.6)*1.5;
        pose.sx+=Math.sin(t*2.1)*.012;pose.sy-=Math.sin(t*2.1)*.01;
        if(clock>nextBlink){blinkStart=clock;nextBlink=clock+3000+Math.random()*2500;}
        pose.close=Math.max(pose.close,blinkShape(clock-blinkStart));
        if(clock>nextScratch){scratchStart=clock;nextScratch=clock+9500;}
        const s=(clock-scratchStart)/2400;
        if(s>=0&&s<1){
          const lift=smooth(clamp(s/.25))*smooth(clamp((1-s)/.27));
          const rub=(s>.25&&s<.75)?Math.sin(s*60)*22:0;
          pose.rot-=lift*4;pose.gy-=lift*35;pose.gx+=lift*50;
          pose.close+=lift*.25;pose.mouth=lift*.08;pose.smile=.65;
        }
      }
    } else if(phase==='reacting'){
      const elapsed=clock-phaseStart;
      const sequenceTime=motion.matches?lengths[step]:elapsed / duration * lengths[step];
      pose=sample(sequence,sequenceTime);
      if(step===4&&sequenceTime>1200&&sequenceTime<2600&&!motion.matches){
        pose.x+=Math.sin(sequenceTime*.075)*4;pose.rot+=Math.sin(sequenceTime*.06)*1.1;
      }
      if(elapsed>=duration){
        if(step===4)explode();
        else{state('ready');button.disabled=false;button.removeAttribute('aria-busy');button.setAttribute('aria-label','Toucher la pochette, pression '+(step+1)+' sur 4');}
      }
    } else if(phase==='waiting'&&$('prize').querySelector('img'))explode();
    if(phase==='burst'){
      const elapsed=clock-phaseStart;
      const swell=motion.matches?0:clamp(elapsed/95);
      pose.sx=1.19+swell*.12;pose.sy=1.13+swell*.08;
      nodes.rig.style.opacity=String(1-smooth(clamp((elapsed-90)/130)));
      if(elapsed>240){button.hidden=true;$('prize').hidden=false;$('groundShadow').style.opacity='0';}
      if(elapsed>(motion.matches?260:burstDuration))beginWiping();
    }
    if(phase==='clearing'&&clock-dissipateStart>(motion.matches?120:clearDuration))reveal();
    if(!button.hidden){
      const tracking=phase==='ready'&&pointer.active;
      const targetX=tracking?clamp(pointer.x*108,-100,100):0;
      const targetY=tracking?clamp(pointer.y*34,-30,30):0;
      const settle=1-Math.exp(-dt/72);
      gaze.x+=(targetX-gaze.x)*settle;
      gaze.y+=(targetY-gaze.y)*settle;
      drawCharacter(pose);
    }
    if(!canvas.hidden)drawSmoke();
    if(needsCoverage&&clock-lastCoverage>160){measureCoverage();lastCoverage=clock;needsCoverage=false;}
    if(phase!=='revealed')raf=requestAnimationFrame(tick);
  }
  function point(event) {
    const r=canvas.getBoundingClientRect();
    return{x:(event.clientX-r.left)/r.width*800,y:(event.clientY-r.top)/r.height*800};
  }
  function erase(from,to) {
    const distance=Math.hypot(to.x-from.x,to.y-from.y), n=Math.max(1,Math.ceil(distance/10));
    breeze={x:to.x,y:to.y,vx:clamp((to.x-from.x)*2,-70,70),vy:clamp((to.y-from.y)*2,-70,70),at:clock};
    if(distance>2&&clock-lastWake>45){
      wake.push({x:to.x,y:to.y,vx:breeze.vx*1.4,vy:breeze.vy*.8,angle:Math.atan2(to.y-from.y,to.x-from.x),at:clock});
      if(wake.length>18)wake.shift();lastWake=clock;
    }
    for(let i=0;i<=n;i++){
      const x=lerp(from.x,to.x,i/n),y=lerp(from.y,to.y,i/n);
      const brush=maskCtx.createRadialGradient(x,y,24,x,y,57);
      brush.addColorStop(0,'rgba(0,0,0,1)');brush.addColorStop(.6,'rgba(0,0,0,.92)');brush.addColorStop(1,'rgba(0,0,0,0)');
      maskCtx.fillStyle=brush;maskCtx.beginPath();maskCtx.arc(x,y,57,0,Math.PI*2);maskCtx.fill();
    }
    needsCoverage=true;
  }
  function measureCoverage() {
    if(phase!=='smoking')return;
    // Unique cleared area over the sticker, not pointer distance: repeated rubbing
    // on an already empty corner cannot reveal the whole prize.
    const pixels=maskCtx.getImageData(190,230,420,395).data;
    let clear=0,total=0;
    for(let y=0;y<395;y+=7)for(let x=0;x<420;x+=7){total++;clear+=pixels[(y*420+x)*4+3]/255;}
    coverage=clear/total;
    $('clearProgress').value=Math.round(coverage*100);
    $('clearLabel').textContent=coverage>.25?'Encore un peu… '+Math.round(coverage*100)+' % dissipés':'Balaie la fumée pour découvrir ton sticker.';
    if(coverage>.82)finish();
  }
  function reset() {
    prizePaper?.dispose();prizePaper=null;prizeGesture=null;
    $('prize').removeAttribute('tabindex');$('prize').removeAttribute('role');
    step=0;pose={...base};gaze={x:0,y:0};pointer.active=false;stroke=null;coverage=0;wake=[];
    breeze.at=-5000;needsCoverage=false;
    maskCtx.clearRect(0,0,800,800);ctx.clearRect(0,0,800,800);
    canvas.hidden=true;button.hidden=false;button.disabled=false;button.removeAttribute('aria-busy');
    nodes.rig.style.opacity='1';$('groundShadow').style.opacity='1';
    $('prize').hidden=true;$('prize').setAttribute('aria-hidden','true');$('prize').replaceChildren();
    $('revealInfo').hidden=true;$('smokeControls').hidden=true;$('progress').hidden=false;
    $('clearProgress').value=0;$('clearLabel').textContent='Balaie la fumée pour découvrir ton sticker.';
    [...$('progress').children].forEach(n=>n.classList.remove('done'));
    $('progress').setAttribute('aria-label','0 pressions sur 4');
    $('instruction').textContent=messages[0];button.setAttribute('aria-label','Toucher la pochette, pression 1 sur 4');
    nextScratch=clock+3800;nextBlink=clock+2200;state('ready');selected=null;
    if(!raf){lastTime=0;raf=requestAnimationFrame(tick);}
  }
  let prizePaper=null, prizeGesture=null;
  const prize=$('prize');
  prize.addEventListener('dragstart',e=>e.preventDefault());
  prize.addEventListener('pointerdown',e=>{
    if(phase!=='revealed'||e.button>0||prizeGesture)return;
    e.preventDefault();const r=prize.getBoundingClientRect();
    prizeGesture={id:e.pointerId,x:e.clientX,y:e.clientY,cx:(e.clientX-r.left)/r.width,cy:(e.clientY-r.top)/r.height};
    prize.setPointerCapture(e.pointerId);prizePaper?.lift(prizeGesture.cx,prizeGesture.cy,.12);
  });
  prize.addEventListener('pointermove',e=>{
    const g=prizeGesture;if(!g||g.id!==e.pointerId)return;
    const distance=Math.hypot(e.clientX-g.x,e.clientY-g.y)/prize.clientWidth;
    prizePaper?.lift(g.cx,g.cy,.12+distance*.85);
  });
  function releasePrize(e){
    if(prizeGesture?.id!==e.pointerId)return;
    prizeGesture=null;prizePaper?.release();
    if(prize.hasPointerCapture(e.pointerId))prize.releasePointerCapture(e.pointerId);
  }
  for(const type of ['pointerup','pointercancel','lostpointercapture'])prize.addEventListener(type,releasePrize);
  prize.addEventListener('keydown',e=>{
    if(e.code==='Space'||e.code==='Enter'){e.preventDefault();prizePaper?.lift(1,0,.4);}
  });
  prize.addEventListener('keyup',e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();prizePaper?.release();}});
  prize.addEventListener('blur',()=>prizePaper?.release());
  button.addEventListener('click',poke);
  document.addEventListener('pointermove',e=>{
    const r=scene.getBoundingClientRect();
    pointer={active:true,x:clamp((e.clientX-(r.left+r.width*.5))/(r.width*.5),-1,1),y:clamp((e.clientY-(r.top+r.height*.4))/(r.height*.5),-1,1)};
  },{passive:true});
  document.documentElement.addEventListener('pointerleave',()=>{pointer.active=false;});
  canvas.addEventListener('pointerdown',e=>{
    if(phase==='burst'){e.preventDefault();accelerate();return;}
    if(phase!=='smoking'||(e.pointerType==='mouse'&&e.button!==0))return;
    e.preventDefault();stroke={id:e.pointerId,...point(e)};canvas.setPointerCapture(e.pointerId);erase(stroke,stroke);
  });
  canvas.addEventListener('pointermove',e=>{
    if(phase!=='smoking'||!stroke||stroke.id!==e.pointerId)return;
    e.preventDefault();const p=point(e);erase(stroke,p);stroke={id:e.pointerId,...p};
  });
  function endStroke(e){if(stroke?.id===e.pointerId){stroke=null;needsCoverage=true;}}
  canvas.addEventListener('pointerup',endStroke);canvas.addEventListener('pointercancel',endStroke);canvas.addEventListener('lostpointercapture',endStroke);
  $('clearKeyboard').addEventListener('click',finish);
  $('again').addEventListener('click',()=>{if(isDailyPouch){location.href='index.html';return;}reset();button.focus({preventScroll:true});});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){cancelAnimationFrame(raf);raf=0;stroke=null;}
    else if(!raf&&phase!=='revealed'){lastTime=0;raf=requestAnimationFrame(tick);}
  });
  // Decode the cleaned plate before showing an interactive character.
  const plate=new Image();plate.src='assets/pochette-body-v5.webp';
  plate.decode().then(reset).catch(()=>{$('instruction').textContent='Le personnage n’a pas chargé. Recharge la page.';});
})();
