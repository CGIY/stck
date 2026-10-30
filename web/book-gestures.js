(() => {
  'use strict';
  const panel=document.getElementById('collection-window');
  const lobby=document.querySelector('.library-lobby');
  const tabs=document.querySelector('.collection-tabs');
  const books=[...document.querySelectorAll('.collection-tab')];
  const volume=document.querySelector('.book-volume');
  const close=panel?.querySelector('.close-grimoire');
  if(!close||!tabs||!volume)return;
  const originalReturn=close.onclick;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const colors=['#a6b68b','#d3b775','#8eaeb0','#c99585'];
  const symbols=['♡','☁','✧','☾'];
  let held=null,mode='shelf',gesture=null,internalClick=false,blockClickUntil=0;
  const grip=document.createElement('button');grip.className='book-close-grip';grip.type='button';grip.setAttribute('aria-label','Rabattre la couverture vers la gauche pour fermer');grip.innerHTML='<span aria-hidden="true">‹</span><i aria-hidden="true"></i>';
  panel.append(grip);
  close.textContent='← Fermer';close.setAttribute('aria-label','Fermer le grimoire');
  const hint=document.createElement('p');hint.className='book-gesture-hint';hint.textContent='Tire un livre pour l’ouvrir.';(tabs.closest('.library-shelf')||tabs).after(hint);
  const announce=document.createElement('span');announce.className='gesture-announcement';announce.setAttribute('aria-live','polite');lobby.append(announce);
  function face(element,book){
    const i=books.indexOf(book);element.style.setProperty('--book-color',colors[i]);
    element.innerHTML='<span class="closed-book-mark" aria-hidden="true">'+symbols[i]+'</span><strong>'+book.dataset.title+'</strong>';
  }
  function ghostAt(book,r){
    const ghost=document.createElement('div');ghost.className='gesture-cover';ghost.setAttribute('aria-hidden','true');face(ghost,book);
    Object.assign(ghost.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});document.body.append(ghost);return ghost;
  }
  async function animate(element,frames,duration=300){
    if(reduced.matches)return;
    const a=element.animate(frames,{duration,easing:'cubic-bezier(.2,.75,.2,1)',fill:'forwards'});
    try{await a.finished;}catch{}a.cancel();
  }
  // Preserve the volume's proportions; apparent width changes by rotation.
  function bookFlight(from,to){
    const sx=to.width/from.width,sy=to.height/from.height;
    const scale=Math.max(sx,sy);
    const angle=Math.acos(Math.min(sx,sy)/scale)*180/Math.PI;
    const rotation=sx<sy?' rotateY('+(-angle)+'deg)':' rotateX('+angle+'deg)';
    return 'translate('+(to.left-from.left)+'px,'+(to.top-from.top)+'px) scale('+scale+')'+rotation;
  }
  function clearShelf(){books.forEach(book=>{book.classList.remove('book-is-out','book-drop-ready');book.removeAttribute('aria-description');});}
  function select(book,origin){
    if(origin)book.stckBookOrigin=origin;
    internalClick=true;book.click();internalClick=false;
  }
  document.addEventListener('stck:collection',()=>{
    held=books.find(book=>book.dataset.collection===panel.dataset.collection)||books[0];
    clearShelf();mode='open';
  });
  function canClose(){return mode==='open'&&panel.dataset.libraryState==='open'&&!volume.getAnimations({subtree:true}).some(a=>a.playState==='running'&&a.effect?.target?.classList?.contains('book-sheet'))&&!document.querySelector('.peel-sticker[data-lifted="true"]');}
  async function closeBook(existing,progress=0){
    if(!canClose()){existing?.remove();return;}
    mode='closing';const book=held||books[0],from=volume.getBoundingClientRect();
    const ghost=existing||ghostAt(book,from);
    panel.inert=true;
    await animate(ghost,[{transform:'perspective(1000px) rotateY('+(105*(1-progress))+'deg)',opacity:Math.max(.15,progress)},{transform:'none',opacity:1}],350*(1-progress));
    ghost.style.transform='none';ghost.style.opacity='1';
    await originalReturn();
    if(!panel.hidden){ghost.remove();panel.inert=false;mode='open';return;}
    mode='returning';book.classList.add('book-is-out');
    const to=book.getBoundingClientRect();
    await animate(ghost,[{transform:'none'},{transform:bookFlight(from,to),opacity:.65}],420);
    ghost.remove();clearShelf();mode='shelf';held=null;
    book.focus({preventScroll:true});announce.textContent='Grimoire rangé.';
  }
  close.onclick=()=>closeBook();grip.onclick=()=>{if(performance.now()>blockClickUntil)closeBook();};
  books.forEach(book=>{
    book.draggable=false;
    book.addEventListener('click',event=>{if(!internalClick&&(performance.now()<blockClickUntil||mode==='closing'||mode==='returning'||panel.dataset.libraryState==='opening')){event.preventDefault();event.stopImmediatePropagation();}},true);
    book.addEventListener('pointerdown',event=>{
      if(event.button!==0||gesture||mode!=='shelf')return;
      gesture={type:'pull',target:book,id:event.pointerId,x:event.clientX,y:event.clientY,dx:0,dy:0,moved:false};
      book.setPointerCapture(event.pointerId);
    });
  });
  grip.addEventListener('pointerdown',event=>{
    if(event.button!==0||gesture||!canClose())return;
    const r=volume.getBoundingClientRect();
    gesture={type:'close',target:grip,id:event.pointerId,x:event.clientX,y:event.clientY,rect:r,dx:0,dy:0,moved:false,progress:0};grip.setPointerCapture(event.pointerId);
  });
  window.addEventListener('pointermove',event=>{
    const g=gesture;if(!g||g.id!==event.pointerId)return;
    g.dx=event.clientX-g.x;g.dy=event.clientY-g.y;
    if(!g.moved&&Math.hypot(g.dx,g.dy)<7)return;
    g.moved=true;event.preventDefault();
    if(g.type==='pull'){
      g.target.classList.add('book-in-hand');g.target.style.transform='translate('+g.dx+'px,'+g.dy+'px) rotate('+Math.max(-9,Math.min(9,g.dx*.06))+'deg)';
    }else if(g.type==='close'){
      if(!g.ghost)g.ghost=ghostAt(held,g.rect);
      g.progress=Math.max(0,Math.min(1,-g.dx/(g.rect.width*.72)));
      g.ghost.style.transform='perspective(1000px) rotateY('+(105*(1-g.progress))+'deg)';g.ghost.style.opacity=String(Math.max(.12,g.progress));
    }
  },{passive:false});
  async function finish(event,cancel=false){
    const g=gesture;if(!g||(event&&g.id!==event.pointerId))return;gesture=null;
    if(g.target.hasPointerCapture(g.id))g.target.releasePointerCapture(g.id);
    if(g.moved)blockClickUntil=performance.now()+600;
    if(g.type==='pull'){
      const open=!cancel&&g.moved&&Math.hypot(g.dx,g.dy)>48;
      const origin=g.target.getBoundingClientRect();
      if(!open&&g.moved)await animate(g.target,[{transform:g.target.style.transform},{transform:'none'}],220);
      g.target.style.transform='';g.target.classList.remove('book-in-hand');if(open)select(g.target,origin);
    }else if(g.type==='close'){
      if(!cancel&&g.moved&&g.progress>.28)await closeBook(g.ghost,g.progress);
      else if(g.ghost){await animate(g.ghost,[{transform:g.ghost.style.transform,opacity:g.ghost.style.opacity},{transform:'perspective(1000px) rotateY(105deg)',opacity:0}],180);g.ghost.remove();}
    }
  }
  window.addEventListener('pointerup',event=>finish(event));window.addEventListener('pointercancel',event=>finish(event,true));window.addEventListener('blur',()=>finish(null,true));
  window.addEventListener('lostpointercapture',event=>{if(gesture?.id===event.pointerId)finish(event,true);});
  // Page paper follows the gesture, while stickers retain their own drag handling.
  let paper=null;
  volume.style.touchAction='pan-y';
  volume.addEventListener('pointerdown',event=>{if(!event.target.closest('.peel-sticker')&&mode==='open'){paper={id:event.pointerId,x:event.clientX,y:event.clientY,element:volume.querySelector('.book-sheet:not([hidden])')};}});
  volume.addEventListener('pointermove',event=>{if(!paper||paper.id!==event.pointerId||!paper.element)return;const dx=event.clientX-paper.x,dy=event.clientY-paper.y;if(Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)){volume.setPointerCapture(event.pointerId);paper.element.style.transform='rotateY('+Math.max(-28,Math.min(28,dx*.15))+'deg)';}});
  const resetPaper=()=>{if(paper?.element)paper.element.style.transform='';paper=null;};
  volume.addEventListener('pointerup',resetPaper,true);volume.addEventListener('pointercancel',resetPaper);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&gesture){event.preventDefault();event.stopImmediatePropagation();finish(null,true);}},true);
})();
