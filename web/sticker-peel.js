(() => {
  const stage = document.getElementById('peelStage');
  const dropTarget = document.getElementById('dropTarget');
  const dropZones = dropTarget ? [dropTarget] : [];
  const collectionWindow = document.getElementById('collection-window');
  const collectionTitle = document.getElementById('collectionTitle');
  const tabs = [...document.querySelectorAll('.collection-tab')];
  const stickerGrids = [...document.querySelectorAll('[data-sticker-collection]')];

  if (!stage || !dropTarget || !collectionWindow || !collectionTitle) return;

  const stickers = [...stage.querySelectorAll('.peel-sticker')];
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const states = [];
  let gesture = null;
  let restoring = false;

  // A readable caption stays outside the sticker and follows its screen bounds.
  const caption = document.createElement('div');
  caption.className = 'sticker-nameplate';caption.setAttribute('role','status');
  document.body.append(caption);
  let captionState=null,captionTimer=0;
  function positionCaption(){
    if(!captionState)return;
    const r=captionState.button.getBoundingClientRect();
    const w=Math.min(250,window.innerWidth-24);
    caption.style.width=w+'px';
    caption.style.left=clamp(r.left+r.width/2-w/2,12,window.innerWidth-w-12)+'px';
    caption.style.top=Math.max(12,r.top-caption.offsetHeight-10)+'px';
  }
  function hideCaption(){clearTimeout(captionTimer);caption.hidden=true;captionState=null;}
  function showCaption(state){
    clearTimeout(captionTimer);captionState=state;
    caption.textContent=state.button.getAttribute('aria-label').replace(/, décoller et déplacer$/,'');
    caption.hidden=false;positionCaption();
    captionTimer=setTimeout(hideCaption,2400);
  }
  hideCaption();
  window.addEventListener('scroll',hideCaption,{passive:true});
  window.addEventListener('resize',hideCaption);
  document.addEventListener('stck:page',hideCaption);
  document.addEventListener('stck:library',hideCaption);
  document.addEventListener('stck:identity',hideCaption);

  const challengeDialog = document.createElement('dialog');
  challengeDialog.className = 'challenge-dialog';
  challengeDialog.setAttribute('aria-labelledby', 'challenge-title');
  challengeDialog.innerHTML = '<button class="challenge-close" type="button" aria-label="Fermer">×</button><p class="challenge-kicker">DÉFI À DEUX</p><h2 id="challenge-title"></h2><p class="challenge-author"></p><p class="challenge-status" role="status"></p><p class="challenge-note">Tu peux accepter à ton rythme. Le défi ne sera considéré réalisé que lorsque vous l’aurez fait ensemble.</p><div class="challenge-actions"></div>';
  document.body.append(challengeDialog);
  const challengeTitle = challengeDialog.querySelector('#challenge-title');
  const challengeAuthor = challengeDialog.querySelector('.challenge-author');
  const challengeStatus = challengeDialog.querySelector('.challenge-status');
  const challengeNote = challengeDialog.querySelector('.challenge-note');
  const challengeActions = challengeDialog.querySelector('.challenge-actions');
  let activeChallenge = null;
  function challengeAction(label, action, secondary = false) {
    const control = document.createElement('button');
    control.type = 'button';
    control.className = secondary ? 'secondary' : 'primary';
    control.textContent = label;
    control.addEventListener('click', () => {
      if (!activeChallenge) return;
      document.dispatchEvent(new CustomEvent('stck:challenge-action', {
        detail: { ...activeChallenge.row, action },
      }));
      challengeDialog.close();
    });
    challengeActions.append(control);
  }
  function showChallenge(entry) {
    const row = entry.row;
    const label = states.find((item) => item.id === row.sticker_id)?.button.getAttribute('aria-label')?.replace(/, décoller et déplacer$/, '') || 'Challenge';
    activeChallenge = entry;
    challengeTitle.textContent = label;
    challengeAuthor.textContent = row.authorLabel || 'Proposition partagée';
    challengeActions.replaceChildren();
    const status = row.challenge_status || 'open';
    challengeDialog.dataset.status = status;
    if (status === 'done') {
      challengeStatus.textContent = 'Réalisé ensemble ✓';
      challengeNote.textContent = 'Vous avez relevé ce défi à deux.';
    } else if (status === 'accepted' && row.challengeAcceptedByMe) {
      challengeStatus.textContent = 'Tu as choisi de le relever.';
      challengeNote.textContent = 'Quand vous l’aurez fait ensemble, tu pourras le marquer comme réalisé.';
      challengeAction('On l’a fait ensemble', 'done');
      challengeAction('Je change d’avis', 'reopen', true);
    } else if (status === 'accepted') {
      challengeStatus.textContent = 'L’autre personne a choisi de le relever.';
      challengeNote.textContent = 'Prenez le temps d’en parler ensemble. La personne qui l’a accepté peut encore changer d’avis.';
    } else if (row.challengeAuthorIsMe) {
      challengeStatus.textContent = 'En attente de l’autre personne.';
      challengeNote.textContent = 'Si personne ne la relève sous 48 h, elle s’efface et ton sticker revient dans ta collection. Tu pourras la reproposer.';
    } else {
      challengeStatus.textContent = 'À relever si tu en as envie.';
      challengeNote.textContent = 'Une proposition à vivre ensemble, à ton rythme et avec l’accord de chacun.';
      challengeAction('Ça me tente, je le relève', 'accept');
    }
    if (!challengeDialog.open) challengeDialog.showModal();
  }
  challengeDialog.querySelector('.challenge-close').addEventListener('click', () => challengeDialog.close());
  challengeDialog.addEventListener('click', (event) => {
    if (event.target === challengeDialog) challengeDialog.close();
  });
  document.addEventListener('stck:identity', () => {
    activeChallenge = null;
    if (challengeDialog.open) challengeDialog.close();
  });

  const logoCut = document.getElementById('logoCutPath');
  const logoFold = document.getElementById('logoFold');
  let logoFrame = 0;
  function animateLogo(time) {
    const cycle = 3000;
    const phase = (time % cycle - 650) / 1900;
    const depth = !reducedMotion && phase > 0 && phase < 1 ? 32 * Math.sin(Math.PI * phase) ** 2 : 0;
    if (logoCut && logoFold) {
      // Mirror only the cut and paper fold, keeping the lettering upright.
      const corner = [0, 3, 1, 2][Math.floor(time / cycle) % 4];
      const mirror = `translate(${corner & 1 ? 224 : 0} ${corner & 2 ? 96 : 0}) scale(${corner & 1 ? -1 : 1} ${corner & 2 ? -1 : 1})`;
      const x = 216 - depth, y = 8 + depth;
      logoCut.setAttribute('transform', mirror);
      logoFold.setAttribute('transform', mirror);
      logoCut.setAttribute('d', depth < .2 ? 'M-10 -10H234V110H-10Z' : `M-10 -10H${x}V8L216 ${y}H234V110H-10Z`);
      logoFold.setAttribute('d', depth < .2 ? '' : `M${x} 8 Q${x-2} ${y+2} 216 ${y}Z`);
    }
    // The logo rests while idle; motion belongs to the paper being handled.
  }
  animateLogo(0);
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(logoFrame);
    if (!document.hidden) animateLogo(0);
  });

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

  function animate(state, time) {
    state.frame = 0;
    const delta = Math.min(40, time - (state.lastTime || time - 16));
    state.lastTime = time;

    if (gesture?.state === state && !gesture.dragging) {
      const held = clamp((time - gesture.started) / 420, 0, 1);
      state.goal = Math.max(.045 + held * .22, gesture.pull);
    } else if (gesture?.state === state) {
      // Keep the peel visible during the drag; the finger otherwise hides the fold.
      state.goal = gesture.detachDepth;
    }

    const timeConstant = reducedMotion ? 24 : 58;
    state.depth += (state.goal - state.depth) * (1 - Math.exp(-delta / timeConstant));
    if (Math.abs(state.depth - state.goal) < .0005) state.depth = state.goal;

    prepareSurface(state, time);
    render(state);
    if (Math.abs(state.depth - state.goal) > .0005 || gesture?.state === state) {
      schedule(state);
    } else if (state.depth === 0) {
      state.button.dataset.lifted = 'false';
    }
  }

  function schedule(state) {
    if (!state.frame) state.frame = requestAnimationFrame((time) => animate(state, time));
  }

  function flatten(state) {
    state.goal = 0;
    state.button.dataset.dragging = 'false';
    state.button.style.removeProperty('--lift-rotation');
    schedule(state);
  }

  function updateDropTarget() {
    states.forEach((state) => {
      state.home.classList.toggle('has-vacancy', state.placed);
      state.button.dataset.placed = String(state.placed);
    });
    dropZones.forEach((zone) => {
      zone.classList.toggle('has-sticker', states.some((state) => state.placed && state.dropZone === zone) || [...board.values()].some((entry) => !entry.row.removed));
      zone.classList.remove('is-hovered');
    });
    dropTarget.classList.toggle('target-used', states.some((state) => state.placed) || [...board.values()].some((entry) => !entry.row.removed));
  }

  function setPosition(state, left, top) {
    state.button.style.position = 'absolute';
    state.button.style.left = `${left}px`;
    state.button.style.top = `${top}px`;
  }

  function restore(state, previousPosition) {
    state.button.classList.add('is-returning');

    if (previousPosition) {
      setPosition(state, previousPosition.left, previousPosition.top);
      state.placed = true;
      state.position = { left: previousPosition.left, top: previousPosition.top };
      state.dropZone = previousPosition.zone;
    } else {
      const stageRect = stage.getBoundingClientRect();
      const homeRect = state.home.getBoundingClientRect();
      setPosition(state, homeRect.left - stageRect.left + (homeRect.width - state.button.offsetWidth) / 2,
        homeRect.top - stageRect.top + (homeRect.height - state.button.offsetHeight) / 2);
      state.placed = false;
      state.position = null;
      state.normalized = null;
      state.dropZone = null;
      clearTimeout(state.returnTimer);
      state.returnTimer = window.setTimeout(() => {
        if (!state.placed && gesture?.state !== state) {
          state.home.append(state.button);
          state.button.style.position = '';
          state.button.style.left = '';
          state.button.style.top = '';
          state.button.style.width = '';
          state.button.style.height = '';
          state.button.classList.remove('is-returning');
        }
      }, reducedMotion ? 0 : 250);
    }

    flatten(state);
    updateDropTarget();
  }

  function findDropZone(state) {
    const stickerRect = state.button.getBoundingClientRect();
    const centerX = stickerRect.left + stickerRect.width / 2;
    const centerY = stickerRect.top + stickerRect.height / 2;
    const toleranceX = stickerRect.width * .2;
    const toleranceY = stickerRect.height * .2;
    return dropZones.find((zone) => {
      const rect = zone.getBoundingClientRect();
      return centerX >= rect.left - toleranceX && centerX <= rect.right + toleranceX
        && centerY >= rect.top - toleranceY && centerY <= rect.bottom + toleranceY;
    }) || null;
  }

  function isOverHome(state) {
    const stickerRect = state.button.getBoundingClientRect();
    const homeRect = state.home.getBoundingClientRect();
    const centerX = stickerRect.left + stickerRect.width / 2;
    const centerY = stickerRect.top + stickerRect.height / 2;
    return centerX >= homeRect.left && centerX <= homeRect.right && centerY >= homeRect.top && centerY <= homeRect.bottom;
  }

  function beginDrag(state, event, gestureState) {
    const stickerRect = state.button.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    gestureState.dragging = true;
    gestureState.detachedAt = performance.now();
    gestureState.detachDepth = Math.min(.76, Math.max(state.depth, .42) * 1.4);
    gestureState.offsetX = gestureState.startX - stickerRect.left;
    gestureState.offsetY = gestureState.startY - stickerRect.top;
    state.button.dataset.dragging = 'true';
    // Keep the same dimensions when leaving the sheet's responsive selectors.
    state.button.style.width = `${state.button.offsetWidth}px`;
    state.button.style.height = `${state.button.offsetHeight}px`;
    state.button.style.setProperty('--lift-rotation', `${state.corner % 2 ? 3 : -3}deg`);
    if (state.button.parentElement !== stage) stage.append(state.button);
    state.button.setPointerCapture(event.pointerId);
    if (!state.placed) state.home.classList.add('has-vacancy');
    setPosition(state, stickerRect.left - stageRect.left, stickerRect.top - stageRect.top);
  }

  function moveSticker(event) {
    if (!gesture || event.pointerId !== gesture.pointer) return;
    event.preventDefault();

    const current = gesture;
    const state = current.state;
    const deltaX = event.clientX - current.startX;
    const deltaY = event.clientY - current.startY;
    const travel = Math.hypot(deltaX, deltaY);
    const inwardX = current.corner % 2 ? -deltaX : deltaX;
    const inwardY = current.corner > 1 ? -deltaY : deltaY;
    current.pull = clamp(Math.max(Math.abs(inwardX + inwardY), travel * .75) / current.width * 1.35 * 1.4, .045, .76);

    const elapsed = performance.now() - current.started;
    if (!current.dragging && travel >= Math.max(18, current.width * .22) && (elapsed >= 100 || travel > current.width * .5)) beginDrag(state, event, current);

    if (current.dragging) {
      const stageRect = stage.getBoundingClientRect();
      const overflowX = state.button.offsetWidth * .7;
      const overflowY = state.button.offsetHeight * .7;
      const maxLeft = Math.max(-overflowX, stage.clientWidth - state.button.offsetWidth + overflowX);
      const maxTop = Math.max(-overflowY, stage.clientHeight - state.button.offsetHeight + overflowY);
      const left = clamp(event.clientX - stageRect.left - current.offsetX, -overflowX, maxLeft);
      const top = clamp(event.clientY - stageRect.top - current.offsetY, -overflowY, maxTop);
      setPosition(state, left, top);
      if (captionState === state) positionCaption();
      const hoveredZone = findDropZone(state);
      dropZones.forEach((zone) => zone.classList.toggle('is-hovered', zone === hoveredZone));
    } else {
      state.goal = Math.max(state.goal, current.pull);
    }

    schedule(state);
  }

  function finishGesture(event, cancelled = false) {
    if (!gesture || event.pointerId !== gesture.pointer) return;

    const current = gesture;
    const state = current.state;
    gesture = null;
    if (state.button.hasPointerCapture(event.pointerId)) state.button.releasePointerCapture(event.pointerId);
    state.button.classList.remove('is-returning');

    const returnedHome = current.dragging && isOverHome(state);
    const destinationZone = current.dragging && !returnedHome ? findDropZone(state) : null;
    if (!current.dragging) {
      flatten(state);
      if (!cancelled) showCaption(state);
    } else if (cancelled || (!returnedHome && !destinationZone)) {
      restore(state, current.previousPosition);
    } else if (current.dragging && returnedHome) {
      restore(state, null);
    } else if (current.dragging) {
      const stageRect = stage.getBoundingClientRect();
      const stickerRect = state.button.getBoundingClientRect();
      const left = stickerRect.left - stageRect.left;
      const top = stickerRect.top - stageRect.top;
      setPosition(state, left, top);
      if (state.button.parentElement !== stage) stage.append(state.button);
      state.placed = true;
      state.dropZone = destinationZone;
      state.position = { left, top };
      flatten(state);
      updateDropTarget();
    } else {
      flatten(state);
    }

    dropZones.forEach((zone) => zone.classList.remove('is-hovered'));
    if (current.dragging && !cancelled && (returnedHome || destinationZone)) persistPlacement(state);
  }

  function isStickerPixel(state, x, y) {
    const size = state.canvas.width;
    const pixelX = Math.round(x * (size - 1));
    const pixelY = Math.round(y * (size - 1));
    const radius = Math.max(1, Math.round(size * .018));

    for (let offsetY = -radius; offsetY <= radius; offsetY += radius) {
      for (let offsetX = -radius; offsetX <= radius; offsetX += radius) {
        const sampleX = clamp(pixelX + offsetX, 0, size - 1);
        const sampleY = clamp(pixelY + offsetY, 0, size - 1);
        if (state.context.getImageData(sampleX, sampleY, 1, 1).data[3] > 24) return true;
      }
    }
    return false;
  }

  function initializeSticker(button) {
    const image = button.querySelector('img');
    const canvas = document.createElement('canvas');
    const layer = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    button.append(canvas);

    const state = {
      button,
      image,
      artRect: (image.dataset.rect || '0,0,1,1').split(',').map(Number),
      canvas,
      layer,
      context: canvas.getContext('2d', { willReadFrequently: true }),
      layerContext: layer.getContext('2d'),
      home: button.parentElement,
      support: null,
      corner: 0,
      depth: 0,
      goal: 0,
      frame: 0,
      lastTime: 0,
      placed: false,
      dropZone: null,
      position: null,
      ready: false,
      rare: button.classList.contains('rare-sticker'),
      surface: null,
    };
    const stickerMask = `url("${image.getAttribute('src')}")`;
    button.style.setProperty('--sticker-art', stickerMask);
    button.parentElement.style.setProperty('--sticker-art', stickerMask);
    button.parentElement.style.setProperty('--sticker-outline', `url("${image.getAttribute('src').replace(/\.webp$/, '.outline.svg')}")`);
    const [artX, artY, artW, artH] = state.artRect;
    button.style.setProperty('--art-left', `${artX * 100}%`);
    button.style.setProperty('--art-top', `${artY * 100}%`);
    button.style.setProperty('--art-width', `${artW * 100}%`);
    button.style.setProperty('--art-height', `${artH * 100}%`);
    state.id = image.getAttribute('src').match(/c(\d)-(\d\d)/).slice(1).join('-');
    button.dataset.stickerId = state.id;
    states.push(state);

    function resize() {
      if (!image.complete || !image.naturalWidth || !state.context || !state.layerContext) return;
      const size = Math.max(1, Math.round(button.clientWidth * Math.min(window.devicePixelRatio || 1, 3)));
      if (canvas.width === size && canvas.height === size) return;
      canvas.width = canvas.height = layer.width = layer.height = size;
      state.surface = null;
      try { state.support ??= measureCornerSupport(state); }
      catch { state.support = [.28, .28, .28, .28]; }
      state.surface = document.createElement('canvas');
      state.surface.width = state.surface.height = size;
      state.surfaceContext = state.surface.getContext('2d');
      prepareSurface(state, performance.now());
      state.ready = true;
      render(state);
      button.classList.add('render-ready');
    }

    image.addEventListener('load', resize, { once: true });
    if (image.complete) resize();
    new ResizeObserver(resize).observe(button);
    button.addEventListener('dragstart', (event) => event.preventDefault());
    button.addEventListener('focus',()=>{if(button.matches(':focus-visible')&&!button.disabled)showCaption(state);});
    button.addEventListener('blur',hideCaption);

    button.addEventListener('pointerdown', (event) => {
      if (gesture || button.disabled || !state.ready || event.button > 0) return;
      const rect = button.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      try { if (!isStickerPixel(state, x, y)) return; } catch { /* Local-file canvas fallback. */ }
      hideCaption();
      event.preventDefault();
      clearTimeout(state.returnTimer);
      state.button.classList.remove('is-returning');
      state.corner = (x >= .5 ? 1 : 0) + (y >= .5 ? 2 : 0);
      state.depth = 0;
      state.goal = .035;
      state.lastTime = 0;
      gesture = {
        state,
        pointer: event.pointerId,
        corner: state.corner,
        startX: event.clientX,
        startY: event.clientY,
        width: rect.width,
        started: performance.now(),
        dragging: false,
        pull: .035,
        previousPosition: state.placed ? { ...state.position, zone: state.dropZone } : null,
      };
      button.dataset.lifted = 'true';
      button.setPointerCapture(event.pointerId);
      schedule(state);
    });

    button.addEventListener('pointermove', moveSticker);
    button.addEventListener('pointermove', event => {
      if (!state.rare) return;
      const rect = button.getBoundingClientRect();
      button.style.setProperty('--light-x', `${clamp((event.clientX-rect.left)/rect.width,0,1)*100}%`);
      button.style.setProperty('--light-y', `${clamp((event.clientY-rect.top)/rect.height,0,1)*100}%`);
    });
    button.addEventListener('click', (event) => {
      if (event.detail === 0 && !button.disabled) showCaption(state);
    });
    button.addEventListener('pointerup', (event) => finishGesture(event));
    button.addEventListener('pointercancel', (event) => finishGesture(event, true));
    button.addEventListener('lostpointercapture', (event) => {
      if (gesture?.state === state) finishGesture(event, true);
    });
  }

  tabs.forEach((tab, index) => {
    tab.tabIndex = index === 0 ? 0 : -1;
    tab.addEventListener('keydown', (event) => {
      const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (!offset) return;
      event.preventDefault();
      const next = tabs[(index + offset + tabs.length) % tabs.length];
      next.click(); next.focus();
    });
    tab.addEventListener('click', () => {
      if (gesture || (tab.getAttribute('aria-selected') === 'true' && !collectionWindow.hidden)) return;
      hideCaption();
      const collectionId = tab.dataset.collection;
      const hasStickers = stickerGrids.some((grid) => grid.dataset.stickerCollection === collectionId);
      tabs.forEach((item) => {
        const selected = item === tab;
        item.classList.toggle('is-active', selected);
        item.setAttribute('aria-selected', String(selected));
        item.tabIndex = selected ? 0 : -1;
      });
      collectionWindow.dataset.collection = collectionId;
      collectionWindow.setAttribute('aria-labelledby', tab.id);
      collectionTitle.textContent = tab.dataset.title;
      document.dispatchEvent(new CustomEvent('stck:collection', {detail:collectionId}));
    });
  });

  stickers.forEach(initializeSticker);

  // A cancelled touch, Escape or a hidden tab must never leave paper lifted.
  function cancelGesture() {
    if (gesture) finishGesture({pointerId: gesture.pointer}, true);
  }
  window.addEventListener('blur', cancelGesture);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelGesture(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && gesture) { event.preventDefault(); cancelGesture(); }
  });


  function persistPlacement(state) {
    if (restoring) return;
    let row = {sticker_id:state.id,removed:!state.placed};
    if(state.placed){
      const zone=state.dropZone.getBoundingClientRect(), r=state.button.getBoundingClientRect();
      row={sticker_id:state.id,zone:0,x:clamp((r.left+r.width/2-zone.left)/zone.width,-.5,1.5),y:clamp((r.top+r.height/2-zone.top)/zone.height,-.5,1.5)};
    }
    row.copy_owner = state.button.dataset.copyOwner || 'preview';
    row.copy_no = Number(state.button.dataset.copyNo || 1);
    state.normalized = state.placed ? row : null;
    if (state.placed) {
      // Return the private catalogue copy immediately; the table renders its own.
      state.placed = false; state.position = null; state.normalized = null; state.dropZone = null;
      clearTimeout(state.returnTimer); state.home.append(state.button);
      for (const key of ['position','left','top','width','height']) state.button.style[key] = '';
      flatten(state); updateDropTarget(); applyPlacement(row);
    }
    document.dispatchEvent(new CustomEvent('stck:placement',{detail:row}));
  }
  // Shared placements have their own DOM nodes. They never move a partner's
  // sticker into this account's private collection or reveal its ownership.
  const board = new Map();
  const placementKey = row => [row.copy_owner || 'preview',row.sticker_id,row.copy_no || 1].join(':');
  let boardGesture = null;
  function placeBoard(entry) {
    const zone = dropZones[entry.row.zone]; if (!zone) return;
    const zr = zone.getBoundingClientRect(), sr = stage.getBoundingClientRect();
    entry.button.style.left = (zr.left - sr.left + entry.row.x * zr.width - entry.button.offsetWidth / 2) + 'px';
    entry.button.style.top = (zr.top - sr.top + entry.row.y * zr.height - entry.button.offsetHeight / 2) + 'px';
  }
  function applyPlacement(row) {
    let entry = board.get(placementKey(row));
    if (row.removed) { entry?.button.remove(); board.delete(placementKey(row)); updateDropTarget(); return; }
    if (!dropZones[row.zone] || !Number.isFinite(row.x) || !Number.isFinite(row.y)) return;
    if (!entry) {
      const source = states.find(s => s.id === row.sticker_id); if (!source) return;
      const button = document.createElement('button'); button.type = 'button'; button.className = 'shared-sticker';
      button.setAttribute('aria-label', source.button.getAttribute('aria-label'));
      const image = source.image.cloneNode(); image.removeAttribute('data-label-path');
      for (const property of ['--art-left','--art-top','--art-width','--art-height']) {
        button.style.setProperty(property, source.button.style.getPropertyValue(property));
      }
      const rare = source.button.classList.contains('rare-sticker');
      if (rare) {
        button.classList.add('rare-sticker');
        button.style.setProperty('--sticker-art', `url("${image.getAttribute('src')}")`);
      }
      const author = document.createElement('span'); author.className = 'sticker-author'; author.setAttribute('aria-hidden','true');
      const challengeChip = document.createElement('span'); challengeChip.className = 'challenge-chip'; challengeChip.setAttribute('aria-hidden','true');
      const curl = document.createElement('span'); curl.className = 'peel-curl'; curl.setAttribute('aria-hidden','true');
      button.append(image, curl, author, challengeChip); button.dataset.peeled = 'true'; button.classList.add('is-arriving','is-unpeeling');
      window.setTimeout(() => button.classList.remove('is-arriving','is-unpeeling'), 760);
      stage.append(button);
      entry = { button, row }; board.set(placementKey(row), entry);
      button.onpointerdown = e => {
        if (e.button !== 0 || boardGesture || gesture) return;
        e.preventDefault(); hideCaption();
        const rect = button.getBoundingClientRect();
        boardGesture = { entry, id: e.pointerId, x: e.clientX, y: e.clientY, offsetX: e.clientX-rect.left, offsetY:e.clientY-rect.top, moved: false };
        button.dataset.lifted = 'true';
        button.setPointerCapture(e.pointerId);
      };
      button.onpointermove = e => {
        const g = boardGesture; if (!g || g.entry !== entry || e.pointerId !== g.id) return;
        if (Math.hypot(e.clientX - g.x, e.clientY - g.y) < 8) return;
        g.moved = true; const sr = stage.getBoundingClientRect();
        button.style.left = (e.clientX - sr.left - g.offsetX) + 'px';
        button.style.top = (e.clientY - sr.top - g.offsetY) + 'px';
      };
      function end(e, cancel = false) {
        const g = boardGesture; if (!g || g.entry !== entry || g.id !== e.pointerId) return;
        boardGesture = null;
        button.dataset.lifted = 'false';
        if (button.hasPointerCapture(e.pointerId)) button.releasePointerCapture(e.pointerId);
        if (g.moved && !cancel) {
          const zone = findDropZone(entry);
          const home = document.querySelector('.sheet-stack').getBoundingClientRect();
          if (!zone && entry.row.ownCopy && e.clientX >= home.left && e.clientX <= home.right && e.clientY >= home.top && e.clientY <= home.bottom) {
            document.dispatchEvent(new CustomEvent('stck:placement', { detail: {...entry.row,removed:true} }));
            return;
          }
          if (zone) {
            button.dataset.peeled = 'true'; button.classList.add('is-unpeeling');
            window.setTimeout(() => button.classList.remove('is-unpeeling'), 760);
            const r = zone.getBoundingClientRect(), br = button.getBoundingClientRect(); entry.row = { ...entry.row, zone: 0, x: clamp((br.left+br.width/2-r.left)/r.width,-.5,1.5), y: clamp((br.top+br.height/2-r.top)/r.height,-.5,1.5) };
            document.dispatchEvent(new CustomEvent('stck:placement', { detail: entry.row }));
          }
        } else if (!cancel) showChallenge(entry);
        placeBoard(entry);
      }
      button.onpointerup = e => end(e); button.onpointercancel = e => end(e,true); button.onlostpointercapture = e => end(e,true);
      button.onclick = e => { if (e.detail === 0) showChallenge(entry); };
      button.onkeydown = e => {
        if (entry.row.ownCopy && (e.key === 'Delete' || e.key === 'Backspace')) {
          e.preventDefault();
          document.dispatchEvent(new CustomEvent('stck:placement', {detail:{...entry.row,removed:true}}));
        }
      };
    }
    entry.row = { ...row };
    const author = entry.button.querySelector('.sticker-author');
    author.textContent = row.authorMark || '';
    author.hidden = !row.authorMark;
    entry.button.dataset.author = row.authorMark || '';
    const challengeChip = entry.button.querySelector('.challenge-chip');
    const status = row.challenge_status || 'open';
    const chipLabel = status === 'done' ? 'Fait' : status === 'accepted' ? 'En cours' : 'À relever';
    challengeChip.textContent = chipLabel;
    entry.button.dataset.challengeStatus = status;
    const label = states.find(s => s.id === row.sticker_id).button.getAttribute('aria-label').replace(/, décoller et déplacer$/,'');
    entry.button.setAttribute('aria-label', `${label} · ${row.authorLabel || 'Proposition partagée'} · ${chipLabel}. Toucher pour voir le défi.`);
    placeBoard(entry);
    updateDropTarget();
  }
  document.addEventListener('stck:restore', e => {
    if (gesture || boardGesture) return;
    const incoming = new Set(e.detail.map(placementKey));
    for (const [id, entry] of board) if (!incoming.has(id)) { entry.button.remove(); board.delete(id); }
    e.detail.forEach(applyPlacement);
  });
  document.addEventListener('stck:restore-one', e => { if (!gesture && !boardGesture) applyPlacement(e.detail); });
  document.addEventListener('stck:discoveries', e => {
    const owned = new Set(e.detail);
    states.forEach(state => {
      const yes = owned.has(state.id); state.button.disabled = !yes;
      state.button.dataset.discovered = String(yes); state.home.classList.toggle('is-unowned', !yes);
    });
  });
  document.addEventListener('stck:stock', e => {
    const stock = new Map(e.detail.map(item => [item.sticker_id,item]));
    states.forEach(state => {
      const item = stock.get(state.id), available = item?.available || [];
      state.button.dataset.copyOwner = item?.copy_owner || 'preview';
      state.button.dataset.copyNo = String(available[0] || 1);
      state.button.disabled = available.length === 0;
      state.home.classList.toggle('is-unowned', available.length === 0);
      let badge = state.home.querySelector('.stock-count');
      if (!badge) { badge=document.createElement('span'); badge.className='stock-count'; badge.setAttribute('aria-hidden','true'); state.home.append(badge); }
      badge.textContent = available.length > 1 ? '×'+available.length : '';
      badge.hidden = available.length < 2;
      state.button.title = item?.count ? `${available.length} disponible(s) sur ${item.count}` : '';
    });
  });
  document.addEventListener('stck:identity', () => {
    cancelGesture(); boardGesture = null; hideCaption();
    for (const entry of board.values()) entry.button.remove(); board.clear();
    states.forEach(state => { state.button.disabled = true; state.home.classList.add('is-unowned'); });
  });
  new ResizeObserver(() => board.forEach(placeBoard)).observe(stage);

  const stageObserver = new ResizeObserver(() => {
    states.forEach((state) => {
      if (!state.placed || !state.position || gesture?.state===state) return;
      if(state.normalized){applyPlacement(state.normalized);return;}
      const stageRect = stage.getBoundingClientRect();
      const zoneRect = state.dropZone?.getBoundingClientRect() || dropTarget.getBoundingClientRect();
      const overflowX = state.button.offsetWidth * .2;
      const overflowY = state.button.offsetHeight * .2;
      const minLeft = zoneRect.left - stageRect.left - overflowX;
      const minTop = zoneRect.top - stageRect.top - overflowY;
      const maxLeft = Math.max(minLeft, zoneRect.right - stageRect.left - state.button.offsetWidth + overflowX);
      const maxTop = Math.max(minTop, zoneRect.bottom - stageRect.top - state.button.offsetHeight + overflowY);
      state.position.left = clamp(state.position.left, minLeft, maxLeft);
      state.position.top = clamp(state.position.top, minTop, maxTop);
      setPosition(state, state.position.left, state.position.top);
    });
  });
  stageObserver.observe(stage);
})();
