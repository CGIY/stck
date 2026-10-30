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
  const messages = ['Il te regarde. Touche-le pour commencer.', 'Hé ! Ça chatouille…', 'Mais… qu’est-ce que tu fais ?', 'Je te préviens…', 'ÇA. SUFFIT.'];
  const nodes = Object.fromEntries(['torso','eyeWhite','eyeClipPath','eyeCrease','gaze','brow','mouthShape','mouthClipPath','tongue','teeth','cheek','stressMarks','rig'].map(id => [id,$(id)]));
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
    const c=clamp(p.close,0,.995), a=clamp(p.anger);
    const top=lerp(333,470,c);
    // One deforming aperture drives BOTH the white and pupil clipping. No sliding lid layer.
    const ey=(y,angry=0)=>lerp(y+angry*a,470,c);
    const d='M386 470 C390 '+ey(402,6)+' 527 '+ey(330,5)+' 650 '+ey(333,100)+' C786 '+ey(331,5)+' 878 '+ey(387,10)+' 879 '+ey(465)+' C883 '+ey(551,-12)+' 746 '+ey(602,-22)+' 626 '+ey(601,-22)+' C499 '+ey(600,-12)+' 389 '+ey(561,-8)+' 386 470Z';
    set('eyeWhite','d',d);set('eyeClipPath','d',d);
    set('eyeCrease','opacity',.45-a*.3);
    set('eyeCrease','d','M415 '+(top+14)+' C480 '+(top-67)+' 699 '+(top-94)+' 850 '+(top-9));
    set('gaze','transform','translate('+(640+gaze.x+p.gx)+' '+(465+gaze.y+p.gy)+') scale('+p.pupil+')');
    // A tapered, asymmetric fold follows the orbital arch. Curvature and weight
    // change together, so anger reads as muscle tension rather than a rigid V.
    const by=top-24, pinch=a*86, weight=10+a*15, lift=p.gy*.05;
    set('brow','opacity',.32+a*.68);
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

  // Painted vapor is continuously advected on the GPU. The permanent clearing
  // mask stays in screen coordinates, independently of the moving smoke.
  const smokeArt=new Image();smokeArt.src='assets/pochette-smoke-v5.webp';
  let smokeReady=false,flow=null;
  function createFlow(image){
    const surface=document.createElement('canvas');surface.width=surface.height=800;
    const gl=surface.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:false,depth:false});
    if(!gl)return null;
    const compile=(type,source)=>{
      const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    };
    const vertex=compile(gl.VERTEX_SHADER,`attribute vec2 position;varying vec2 uv;
      void main(){uv=vec2(position.x*.5+.5,.5-position.y*.5);gl_Position=vec4(position,0.,1.);}`);
    const fragment=compile(gl.FRAGMENT_SHADER,`precision mediump float;
      varying vec2 uv;uniform sampler2D art;uniform float time;uniform vec4 wind;uniform float strength;
      void main(){
        vec2 p=uv-.5;
        vec2 drift=vec2(sin(uv.y*11.+time*.71)+.45*sin(uv.x*17.-time*.43),
          cos(uv.x*10.-time*.53)+.4*sin(uv.y*16.+time*.61));
        vec2 curl=vec2(sin(uv.y*22.+drift.y*2.-time*.7),cos(uv.x*21.+drift.x*2.+time*.6));
        vec2 flow=drift*.012+curl*.0045;
        float influence=exp(-dot(uv-wind.xy,uv-wind.xy)*36.)*strength;
        flow-=wind.zw*influence;
        vec2 q=.5+p/(1.+.014*sin(time*.72))+flow;
        vec4 color=texture2D(art,clamp(q,vec2(.001),vec2(.999)));
        // Protect the full sticker bounds, including its drop shadow.
        vec2 box=abs(uv-vec2(.5,.535))-vec2(.275,.265);
        float core=1.-smoothstep(0.,.025,max(box.x,box.y));
        float opacity=max(color.a,core);
        color.rgb=mix(vec3(.75,.75,.70),color.rgb,color.a/max(opacity,.001));
        color.a=opacity;
        color.rgb*=1.+.014*sin(time*.6+uv.y*8.+drift.x);
        gl_FragColor=color;
      }`);
    const program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    const position=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
    const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
    const time=gl.getUniformLocation(program,'time'),wind=gl.getUniformLocation(program,'wind'),strength=gl.getUniformLocation(program,'strength');
    surface.addEventListener('webglcontextlost',event=>{event.preventDefault();flow=null;canvas.dataset.renderer='painted-fallback';});
    canvas.dataset.renderer='flow';
    return {surface,draw(t){
      gl.uniform1f(time,t);gl.uniform4f(wind,breeze.x/800,breeze.y/800,breeze.vx/800,breeze.vy/800);
      gl.uniform1f(strength,clamp(1-(clock-breeze.at)/700));gl.drawArrays(gl.TRIANGLES,0,6);
    }};
  }
  smokeArt.decode().then(()=>{
    smokeReady=true;
    try{flow=createFlow(smokeArt);}catch(error){console.warn('Smoke flow unavailable; painted fallback enabled.',error.message);}
    if(!flow)canvas.dataset.renderer='painted-fallback';
  }).catch(()=>{canvas.dataset.renderer='procedural-fallback';});

  // Small dependency-free fallback when the painted asset is still loading.
  const vapor=document.createElement('canvas');vapor.width=vapor.height=240;
  const vaporCtx=vapor.getContext('2d');
  const vaporPixels=vaporCtx.createImageData(240,240);
  const noiseTile=new Float32Array(256*256);
  let seed=92817;
  const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let octave=0;octave<5;octave++){
    const size=8<<octave, grid=Float32Array.from({length:size*size},random), amplitude=Math.pow(.49,octave);
    for(let y=0;y<256;y++)for(let x=0;x<256;x++){
      const gx=x/256*size,gy=y/256*size,ix=Math.floor(gx),iy=Math.floor(gy);
      const fx=smooth(gx-ix),fy=smooth(gy-iy);
      const v=lerp(lerp(grid[iy*size+ix],grid[iy*size+(ix+1)%size],fx),lerp(grid[((iy+1)%size)*size+ix],grid[((iy+1)%size)*size+(ix+1)%size],fx),fy);
      noiseTile[y*256+x]+=v*amplitude/1.9;
    }
  }
  function noise(x,y){
    x=((x%256)+256)%256;y=((y%256)+256)%256;
    const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
    return lerp(lerp(noiseTile[iy*256+ix],noiseTile[iy*256+(ix+1)%256],fx),lerp(noiseTile[((iy+1)%256)*256+ix],noiseTile[((iy+1)%256)*256+(ix+1)%256],fx),fy);
  }
  let lastVapor=-1000;
  function paintVapor(){
    if(clock-lastVapor<45)return;
    lastVapor=clock;
    const t=motion.matches?0:clock*.00022, data=vaporPixels.data;
    for(let y=0;y<240;y++)for(let x=0;x<240;x++){
      const i=(y*240+x)*4, dx=(x-120)/120,dy=(y-123)/120;
      const r=Math.hypot(dx,dy),a=Math.atan2(dy,dx);
      if(r>1.05){data[i+3]=0;continue;}
      const wx=(noise(x*.62+t*9,y*.62-t*7)-.5)*90;
      const wy=(noise(x*.62+71-t*6,y*.62+136)-.5)*90;
      const n=noise(x*1.15+wx-t*21,y*1.15+wy+t*13);
      const fine=noise(x*3.1+wx*2+t*7,y*3.1+wy*2-t*28);
      const fold=Math.sin(y*.058+wy*.11+n*10+t)*.5+.5;
      const edge=.9+.055*Math.sin(a*5+t*.6)+.035*Math.sin(a*9-t*.8)+(n-.5)*.2;
      const outer=smooth(clamp((edge-r)/.14));
      // The prize rectangle is fully occluded even in the darkest moving wisps.
      const core=r<.79?1:0;
      const alpha=Math.max(core,outer);
      const shade=155+n*75+fold*33+fine*13;
      data[i]=clamp(shade,0,255);
      data[i+1]=clamp(shade+6-n*7,0,255);
      data[i+2]=clamp(shade+1-n*10,0,255);
      data[i+3]=Math.round(alpha*255);
    }
    vaporCtx.putImageData(vaporPixels,0,0);
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
    if(flow){flow.draw(motion.matches?0:clock*.001);ctx.drawImage(flow.surface,0,0);}
    else if(smokeReady){
      // Fully opaque underpainting covers the core even on older devices.
      ctx.fillStyle='#bfc0b3';ctx.fillRect(180,216,440,424);
      const sway=motion.matches?0:Math.sin(clock*.0006)*.012;
      ctx.translate(400,410);ctx.rotate(sway);ctx.drawImage(smokeArt,-400,-410,800,800);
    }else{paintVapor();ctx.drawImage(vapor,0,0,800,800);}
    ctx.restore();
    wake=wake.filter(p=>clock-p.at<850);
    if(smokeReady&&!motion.matches)for(const p of wake){
      const age=(clock-p.at)/850;
      ctx.save();ctx.translate(p.x+p.vx*age,p.y+p.vy*age-age*35);ctx.rotate(p.angle+age*.7);
      ctx.globalAlpha=(1-age)*.27*fade;
      const size=90+age*90;ctx.drawImage(smokeArt,-size*.55,-size*.3,size*1.1,size*.6);ctx.restore();
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
    $('revealedRarity').textContent = selected.kept === false ? 'Déjà 3 exemplaires · ce doublon disparaît' : selected.quantity > 1 ? `Exemplaire ${selected.quantity} sur 3` : selected.rare ? 'Édition rare · 1 %' : 'Nouveau sticker';
    $('prize').classList.toggle('is-excess', selected.kept === false);
    $('revealInfo').hidden=false;
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
        const b=(clock-blinkStart)/190;if(b>=0&&b<1)pose.close=Math.max(pose.close,Math.sin(b*Math.PI));
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
      gaze.x+=((tracking?pointer.x*108:0)-gaze.x)*Math.min(1,dt*.012);
      gaze.y+=((tracking?pointer.y*55:0)-gaze.y)*Math.min(1,dt*.012);
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
  $('again').addEventListener('click',()=>{reset();button.focus({preventScroll:true});});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){cancelAnimationFrame(raf);raf=0;stroke=null;}
    else if(!raf&&phase!=='revealed'){lastTime=0;raf=requestAnimationFrame(tick);}
  });
  // Decode the cleaned plate before showing an interactive character.
  const plate=new Image();plate.src='assets/pochette-body-v4.webp';
  plate.decode().then(reset).catch(()=>{$('instruction').textContent='Le personnage n’a pas chargé. Recharge la page.';});
})();
