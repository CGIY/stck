(() => {
  'use strict';
  const panel=document.getElementById('collection-window');
  if(!panel)return;
  const collection=panel.closest('.collection');
  const content=panel.querySelector('.collection-content');
  const tablist=collection.querySelector('.collection-tabs');
  const tabs=[...tablist.querySelectorAll('.collection-tab')];
  if(!tabs.length)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const sheets=[];
  let current=0,turning=false,gesture=null,turnAnimation=null;
  let discovered=new Set(),completed=new Set();
  const stack=document.createElement('div');
  stack.className='sheet-stack';
  stack.setAttribute('aria-label','Album de petites planches à feuilleter');
  panel.querySelector('.collection-heading')?.classList.add('visually-hidden');
  panel.querySelectorAll('.rare-divider,.collection-empty').forEach(node=>node.remove());
  const pad=value=>String(value).padStart(2,'0');
  tabs.forEach((tab,index)=>{
    const id=tab.dataset.collection;
    const grid=panel.querySelector(`[data-sticker-collection="${id}"]`);
    if(!grid)return;
    const rare=panel.querySelector(`.rare-stickers[data-rare-collection="${id}"]`);
    if(rare){grid.append(...rare.children);rare.remove();}
    const sheet=document.createElement('section');
    sheet.className='sticker-sheet is-undiscovered';
    sheet.dataset.collection=id;
    sheet.dataset.key=tab.dataset.key||id;
    sheet.dataset.title=tab.dataset.title;
    sheet.dataset.count=String(grid.children.length);
    sheet.style.setProperty('--tone',tab.dataset.tone||'#b8c0ae');
    if(tab.dataset.special==='true')sheet.classList.add('special-sheet');
    const heading=document.createElement('header');heading.className='sheet-heading';
    const titleBox=document.createElement('div');titleBox.className='sheet-title';
    const kicker=document.createElement('span');kicker.className='sheet-kicker';
    kicker.textContent=tab.dataset.family||(tab.dataset.special==='true'?'Édition spéciale':'Collection');
    const title=document.createElement('h3');
    if(tab.dataset.logo){
      const logo=document.createElement('img');
      logo.className='special-brand sheet-brand';logo.src=tab.dataset.logo;
      logo.alt=tab.dataset.title;logo.draggable=false;
      title.append(logo);
    }else title.textContent=tab.dataset.title;
    titleBox.append(kicker,title);
    const meta=document.createElement('div');meta.className='sheet-meta';
    const season=document.createElement('span');season.className='season-tag';season.textContent='Saison 1';
    const number=document.createElement('span');number.className='sheet-number';
    number.textContent=`${pad(index+1)} / ${pad(tabs.length)}`;
    meta.append(season,number);heading.append(titleBox,meta);
    grid.hidden=false;sheet.append(heading,grid);stack.append(sheet);sheets.push(sheet);
    tab.replaceChildren();
    tab.setAttribute('aria-label',`Planche ${pad(index+1)} à découvrir`);
    tab.tabIndex=index? -1:0;
    const dot=document.createElement('span');dot.setAttribute('aria-hidden','true');tab.append(dot);
  });
  content.append(stack);
  // Keep the controller's tabs for selection events, without a second visible
  // navigation row or focus targets hidden beyond the edge of the album.
  tablist.hidden=true;tablist.inert=true;tablist.setAttribute('aria-hidden','true');
  tabs.forEach(tab=>{tab.tabIndex=-1;});
  const nav=document.createElement('nav');nav.className='sheet-navigation';
  nav.setAttribute('aria-label','Feuilleter l’album');
  const previous=document.createElement('button'),next=document.createElement('button');
  for(const [button,label,right] of [[previous,'Planche précédente',false],[next,'Planche suivante',true]]){
    button.type='button';button.className='sheet-arrow';button.setAttribute('aria-label',label);
    button.innerHTML=`<svg viewBox="0 0 32 26" aria-hidden="true" focusable="false"><g${right?' transform="translate(32 0) scale(-1 1)"':''}><path d="M25 13Q15 11.5 6 13M14 4Q9 8 5 13Q9 17 14 22"/></g></svg>`;
  }
  const route=document.createElement('div');route.className='sheet-route';
  const routeCurrent=document.createElement('span'),routeSlash=document.createElement('span'),routeTotal=document.createElement('span');
  routeCurrent.className='sheet-index-current';routeSlash.className='sheet-index-slash';routeTotal.className='sheet-index-total';
  routeSlash.textContent='/';routeTotal.textContent=pad(sheets.length);
  route.append(routeCurrent,routeSlash,routeTotal);
  nav.append(previous,route,next);panel.append(nav);
  const announcement=document.createElement('p');announcement.className='visually-hidden';
  announcement.setAttribute('aria-live','polite');announcement.setAttribute('aria-atomic','true');panel.append(announcement);
  function updateRoute(){
    const sheet=sheets[current];if(!sheet)return;
    routeCurrent.textContent=pad(current+1);
    route.setAttribute('aria-label',`Planche ${current+1} sur ${sheets.length}`);
  }
  function updateSurfaces(){
    for(const [index,sheet] of sheets.entries()){
      const known=[...sheet.querySelectorAll('.peel-sticker')].some(button=>discovered.has(button.dataset.stickerId));
      const awarded=completed.has(sheet.dataset.key);
      sheet.classList.toggle('is-completed',awarded);
      sheet.classList.toggle('is-undiscovered',!known&&!awarded);
      const prefix=sheet.classList.contains('special-sheet')?'Planche spéciale ':'Planche ';
      sheet.setAttribute('aria-label',awarded?`${sheet.dataset.title} · complétée`:known?prefix+sheet.dataset.title:`Planche ${pad(index+1)} à découvrir`);
      tabs[index].setAttribute('aria-label',known||awarded?prefix+sheet.dataset.title:`Planche ${pad(index+1)} à découvrir`);
      sheet.querySelector('.sheet-title').setAttribute('aria-hidden',String(!known&&!awarded&&!sheet.classList.contains('special-sheet')));
      let emblem=sheet.querySelector('.completion-emblem');
      if(awarded&&!emblem){
        emblem=document.createElement('span');emblem.className='completion-emblem';emblem.setAttribute('role','img');
        emblem.setAttribute('aria-label',sheet.dataset.title+' : planche complétée, récompense permanente');
        emblem.innerHTML='<svg viewBox="0 0 40 46" aria-hidden="true"><path d="M11 27L7 43L18 38L22 44L27 27" fill="#a6b39a" stroke="#566c50" stroke-width="2"/><path d="M20 2L26 6L33 6L35 14L39 20L35 26L33 33L26 34L20 38L14 34L7 33L5 26L1 20L5 14L7 6L14 6Z" fill="#e1c07b" stroke="#76633e" stroke-width="2"/><path d="M11 20L17 26L29 13" fill="none" stroke="#647252" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        sheet.querySelector('.sheet-heading').append(emblem);
      }
      if(emblem)emblem.hidden=!awarded;
    }
    updateRoute();
  }
  function layout(){
    sheets.forEach((sheet,index)=>{
      const depth=(index-current+sheets.length)%sheets.length;
      sheet.style.setProperty('--depth',Math.min(depth,3));
      sheet.style.zIndex=String(4-Math.min(depth,3));
      sheet.hidden=depth>3;
      sheet.inert=depth!==0;
      sheet.setAttribute('aria-hidden',String(depth!==0));
      sheet.classList.toggle('is-front',depth===0);
    });
    updateRoute();
    const name=sheets[current].classList.contains('is-undiscovered')?'À découvrir':tabs[current].dataset.title;
    announcement.textContent=`${name}, planche ${current+1} sur ${sheets.length}`;
  }
  function lifted(){return !!document.querySelector('.peel-sticker[data-lifted="true"],.shared-sticker[data-lifted="true"]');}
  async function turn(index){
    if(turning||index<0||index>=sheets.length||index===current)return;
    turning=true;panel.classList.add('is-turning');panel.setAttribute('aria-busy','true');
    const old=sheets[current];
    const direction=(index-current+tabs.length)%tabs.length===tabs.length-1?1:-1;
    const from=old.style.transform||getComputedStyle(old).transform;
    const away=`translateX(${direction*108}%) rotate(${direction*10}deg)`;
    document.dispatchEvent(new Event('stck:page'));
    try{
      if(!reduced.matches){
        turnAnimation=old.animate([{transform:from},{transform:away}],{duration:180,easing:'cubic-bezier(.3,.05,.7,.6)',fill:'forwards'});
        await turnAnimation.finished;
      }
      current=index;old.style.transform='';layout();turnAnimation?.cancel();turnAnimation=null;
      if(!reduced.matches){
        const front=sheets[current];
        turnAnimation=front.animate([{transform:'translateY(5px) rotate(.8deg)'},{transform:getComputedStyle(front).transform}],{duration:210,easing:'cubic-bezier(.15,.7,.2,1)'});
        await turnAnimation.finished;
      }
    }catch{
      current=index;old.style.transform='';layout();
    }finally{
      turnAnimation?.cancel();turnAnimation=null;turning=false;
      panel.classList.remove('is-turning');panel.removeAttribute('aria-busy');
    }
  }
  document.addEventListener('stck:collection',event=>turn(tabs.findIndex(tab=>tab.dataset.collection===String(event.detail))));
  document.addEventListener('stck:discoveries',event=>{discovered=new Set(event.detail||[]);updateSurfaces();});
  const currentKeys=new Set(tabs.map(tab=>tab.dataset.key||tab.dataset.collection));
  document.addEventListener('stck:rewards',event=>{
    completed=new Set((event.detail||[]).map(row=>row.collection_key).filter(key=>currentKeys.has(key)));
    updateSurfaces();
  });
  document.addEventListener('stck:identity',()=>{discovered.clear();completed.clear();updateSurfaces();});
  tablist.addEventListener('click',event=>{
    if(turning||lifted()){event.preventDefault();event.stopImmediatePropagation();}
  },true);
  nav.addEventListener('keydown',event=>{
    const target=event.key==='Home'?0:event.key==='End'?tabs.length-1:event.key==='ArrowLeft'?(current+tabs.length-1)%tabs.length:event.key==='ArrowRight'?(current+1)%tabs.length:-1;
    if(target<0)return;
    event.preventDefault();event.stopPropagation();
    if(turning||lifted())return;
    tabs[target].click();
  });
  previous.onclick=()=>{if(!turning&&!lifted())tabs[(current+tabs.length-1)%tabs.length].click();};
  next.onclick=()=>{if(!turning&&!lifted())tabs[(current+1)%tabs.length].click();};
  stack.addEventListener('pointerdown',event=>{
    if(event.button!==0||turning||lifted()||event.target.closest('.peel-sticker'))return;
    gesture={id:event.pointerId,x:event.clientX,y:event.clientY,dx:0,active:false};
  });
  stack.addEventListener('pointermove',event=>{
    const g=gesture;if(!g||g.id!==event.pointerId)return;
    const dx=event.clientX-g.x,dy=event.clientY-g.y;
    if(!g.active){
      if(Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)){gesture=null;return;}
      if(Math.abs(dx)<10)return;
      g.active=true;stack.setPointerCapture(event.pointerId);
    }
    event.preventDefault();g.dx=dx;sheets[current].classList.add('is-dragging');
    sheets[current].style.transform=reduced.matches?`translateX(${dx*.5}px)`:`translateX(${dx}px) rotate(${-0.6+Math.max(-8,Math.min(8,dx/28))}deg)`;
  });
  function finish(event,cancel=false){
    const g=gesture;if(!g||(event&&g.id!==event.pointerId))return;
    gesture=null;sheets[current].classList.remove('is-dragging');
    if(stack.hasPointerCapture(g.id))stack.releasePointerCapture(g.id);
    if(!cancel&&g.active&&Math.abs(g.dx)>Math.min(60,stack.clientWidth*.18))tabs[(current+(g.dx<0?1:tabs.length-1))%tabs.length].click();
    else sheets[current].style.transform='';
  }
  stack.addEventListener('pointerup',event=>finish(event));
  stack.addEventListener('pointercancel',event=>finish(event,true));
  stack.addEventListener('lostpointercapture',event=>finish(event,true));
  window.addEventListener('blur',()=>finish(null,true));
  document.addEventListener('visibilitychange',()=>{if(document.hidden){finish(null,true);turnAnimation?.cancel();}});
  reduced.addEventListener?.('change',()=>{finish(null,true);if(reduced.matches)turnAnimation?.cancel();});
  updateSurfaces();layout();
})();
