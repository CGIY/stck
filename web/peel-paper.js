(() => {
  'use strict';
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function transformCorner(context, corner) {
    context.translate(corner % 2 ? 1 : 0, corner > 1 ? 1 : 0);
    context.scale(corner % 2 ? -1 : 1, corner > 1 ? -1 : 1);
  }

  function drawArtwork(context, state) {
    context.save();
    transformCorner(context, state.corner);
    drawFitted(context, state);
    context.restore();
  }

  function drawFitted(context, state) {
    if (state.surface) {
      context.drawImage(state.surface, 0, 0, 1, 1);
      return;
    }
    const [x, y, width, height] = state.artRect;
    context.drawImage(state.image, x, y, width, height);
  }

  function prepareSurface(state, time) {
    const ctx = state.surfaceContext, size = state.surface.width;
    ctx.setTransform(size, 0, 0, size, 0, 0);
    ctx.clearRect(0, 0, 1, 1);
    ctx.drawImage(state.image, ...state.artRect);
    if (!state.rare || state.depth < .0005) return;
    // Foil is part of the printed face, so it bends with the paper.
    const light = reducedMotion ? .5 : .5 + Math.sin(time * .0018 + state.corner) * .25;
    ctx.globalCompositeOperation = 'source-atop';
    const foil = ctx.createLinearGradient(light - .55, 0, light + .45, 1);
    [[0,'#72d6d940'],[.22,'#bc8de670'],[.4,'#ffe4a566'],[.49,'#ffffffdd'],[.55,'#fff9e99c'],[.7,'#7ddbd17a'],[1,'#b896e54d']].forEach(([p,c]) => foil.addColorStop(p,c));
    ctx.fillStyle = foil;
    ctx.fillRect(0, 0, 1, 1);
    ctx.globalCompositeOperation = 'source-over';
  }

  function measureCornerSupport(state) {
    const size = 192;
    const sample = document.createElement('canvas');
    sample.width = sample.height = size;
    const context = sample.getContext('2d', { willReadFrequently: true });
    if (!context) return [.36, .36, .36, .36];

    context.save();
    context.scale(size, size);
    drawFitted(context, state);
    context.restore();
    const pixels = context.getImageData(0, 0, size, size).data;
    const support = [];

    for (let corner = 0; corner < 4; corner += 1) {
      let firstInk = .36;
      let found = false;

      for (let distance = .02; distance < 1.15 && !found; distance += .008) {
        const startX = Math.max(0, distance - 1);
        const endX = Math.min(1, distance);
        const samples = 72;

        for (let index = 0; index <= samples; index += 1) {
          const x = startX + (endX - startX) * index / samples;
          const y = distance - x;
          const imageX = Math.round((corner % 2 ? 1 - x : x) * (size - 1));
          const imageY = Math.round((corner > 1 ? 1 - y : y) * (size - 1));
          const alpha = pixels[(imageY * size + imageX) * 4 + 3];
          if (alpha > 24) {
            firstInk = distance;
            found = true;
            break;
          }
        }
      }

      support.push(clamp(firstInk, .08, .72));
    }

    return support;
  }

  function render(state) {
    const size = state.canvas.width;
    if (!size || !state.context || !state.layerContext) return;

    const context = state.context;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, size, size);
    context.setTransform(size, 0, 0, size, 0, 0);

    if (state.depth < .0005) {
      drawFitted(context, state);
      return;
    }

    const distance = Math.min(.98, state.support[state.corner] + state.depth);
    const layer = state.layerContext;
    layer.setTransform(1, 0, 0, 1, 0, 0);
    layer.clearRect(0, 0, size, size);
    layer.setTransform(size, 0, 0, size, 0, 0);

    layer.save();
    layer.beginPath();
    layer.moveTo(0, 0);
    layer.lineTo(distance, 0);
    layer.lineTo(0, distance);
    layer.closePath();
    layer.clip();
    drawArtwork(layer, state);
    layer.restore();

    // An opaque paper reverse follows the original die cut, including holes.
    layer.globalCompositeOperation = 'source-atop';
    const shade = layer.createLinearGradient(0, 0, distance / 2, distance / 2);
    shade.addColorStop(0, '#e4dfcf');
    shade.addColorStop(.58, '#f8f4e9');
    shade.addColorStop(.82, '#fffdf5');
    shade.addColorStop(.94, '#dad5c6');
    shade.addColorStop(1, '#999786');
    layer.fillStyle = shade;
    layer.fillRect(0, 0, 1, 1);
    layer.globalCompositeOperation = 'source-over';

    context.save();
    transformCorner(context, state.corner);

    // Keep the attached material still and lift only the corner beyond the crease.
    context.save();
    context.beginPath();
    context.moveTo(distance, 0);
    context.lineTo(1, 0);
    context.lineTo(1, 1);
    context.lineTo(0, 1);
    context.lineTo(0, distance);
    context.closePath();
    context.clip();
    drawArtwork(context, state);
    // The crease shadow is clipped to ink, never to a rectangular backing.
    context.globalCompositeOperation = 'source-atop';
    const crease = context.createLinearGradient(distance / 2, distance / 2, distance / 2 + .065, distance / 2 + .065);
    crease.addColorStop(0, '#383c344d');
    crease.addColorStop(1, '#383c3400');
    context.fillStyle = crease;
    context.fillRect(0, 0, 1, 1);
    context.restore();

    // One soft cast shadow, then narrow strips around a curved paper fold.
    context.save();
    context.transform(0, -1, -1, 0, distance, distance);
    context.globalAlpha = .31;
    context.shadowColor = 'rgba(35,39,30,.6)';
    context.shadowBlur = size * (.018 + state.depth * .049);
    context.shadowOffsetY = size * .021;
    context.drawImage(state.layer, 0, 0, 1, 1);
    context.restore();

    const radius = Math.min(.085, state.depth * .3);
    const project = q => .78 * (q - radius * (1 - Math.exp(-q / radius)));
    const strips = 24;
    for (let i = strips - 1; i >= 0; i--) {
      const q0 = distance * i / strips, q1 = distance * (i + 1) / strips;
      const p0 = project(q0), p1 = project(q1);
      const scale = (p1 - p0) / (q1 - q0);
      const shift = (distance * (1 + scale) + p0 - scale * q0) / 2;
      context.save();
      context.transform((1-scale)/2, -(1+scale)/2, -(1+scale)/2, (1-scale)/2, shift, shift);
      const near = distance - q0 + .001, far = distance - q1;
      context.beginPath();
      context.moveTo(0, far); context.lineTo(far, 0);
      context.lineTo(near, 0); context.lineTo(0, near); context.closePath();
      context.clip();
      context.drawImage(state.layer, 0, 0, 1, 1);
      context.restore();
    }

    context.restore();
  }


  function attach(button, image, options = {}) {
    const canvas = document.createElement('canvas'), layer = document.createElement('canvas');
    canvas.className = 'paper-peel-canvas'; canvas.setAttribute('aria-hidden','true');
    button.append(canvas);
    const state = {button,image,canvas,layer,context:canvas.getContext('2d'),layerContext:layer.getContext('2d'),
      artRect:options.artRect || [0,0,1,1],rare:!!options.rare,corner:0,depth:0,goal:0,support:null,surface:null};
    let frame=0, last=0, disposed=false;
    function resize(){
      if(disposed || !image.complete || !image.naturalWidth || !button.clientWidth)return;
      const size=Math.round(button.clientWidth*Math.min(devicePixelRatio||1,3));
      if(canvas.width===size && state.surface)return;
      canvas.width=canvas.height=layer.width=layer.height=size;
      state.surface=null;
      if(!options.artRect){
        const ratio=image.naturalWidth/image.naturalHeight;
        const w=Math.min(1,ratio),h=Math.min(1,1/ratio);
        state.artRect=[(1-w)/2,(1-h)/2,w,h];
      }
      try{state.support=measureCornerSupport(state);}catch{state.support=[.28,.28,.28,.28];}
      state.surface=document.createElement('canvas');state.surface.width=state.surface.height=size;
      state.surfaceContext=state.surface.getContext('2d');
      prepareSurface(state,performance.now());render(state);button.classList.add('paper-peel-ready');
    }
    function tick(time){
      frame=0;if(disposed || !state.surface)return;
      const dt=Math.min(40,time-(last||time-16));last=time;
      state.depth+=(state.goal-state.depth)*(1-Math.exp(-dt/(reducedMotion?20:65)));
      if(Math.abs(state.goal-state.depth)<.0005)state.depth=state.goal;
      prepareSurface(state,time);render(state);
      if(state.depth!==state.goal)frame=requestAnimationFrame(tick);
      else if(!state.depth)button.classList.remove('paper-peeling');
    }
    function lift(x,y,depth){
      if(!state.surface)return;
      if(!state.depth)state.corner=(x>.5?1:0)+(y>.5?2:0);
      state.goal=clamp(depth,0,.56);button.classList.add('paper-peeling');
      if(!frame){last=0;frame=requestAnimationFrame(tick);}
    }
    function release(){state.goal=0;if(!frame){last=0;frame=requestAnimationFrame(tick);}}
    const observer=new ResizeObserver(resize);observer.observe(button);
    image.addEventListener('load',resize);resize();
    return {lift,release,dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();image.removeEventListener('load',resize);canvas.remove();button.classList.remove('paper-peel-ready','paper-peeling');}};
  }
  window.StckPaper = {attach};
})();
