(() => {
  'use strict';
  const panel=document.getElementById('collection-window');
  if(!panel)return;
  const content=panel.querySelector('.collection-content');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const pages=new Map(), positions=new Map();
  let category='1', turning=false, changeToken=0, pendingPage=null;
  const volume=document.createElement('div');volume.className='book-volume';
  content.append(volume);
  panel.querySelectorAll('.rare-divider,.collection-empty').forEach(n=>n.remove());
  const chapter=document.createElement('span');chapter.className='book-chapter';
  panel.querySelector('.collection-heading').prepend(chapter);
  for(const grid of panel.querySelectorAll('[data-sticker-collection]')){
    const id=grid.dataset.stickerCollection,slots=[...grid.children];
    const rare=panel.querySelector('.rare-stickers[data-rare-collection="'+id+'"]');
    const sheets=[];
    for(let i=0;i<3;i++){
      const sheet=document.createElement('section');sheet.className='book-sheet';
      sheet.dataset.category=id;sheet.dataset.page=String(i+1);sheet.hidden=true;
      sheet.setAttribute('aria-label',i===2?'Page 3, les rares':'Page '+(i+1)+', trois stickers');
      const heading=document.createElement('p');heading.className='sheet-heading';
      heading.textContent=i===2?'Les pièces précieuses':i===0?'Les petits bonheurs':'Encore un peu de magie';
      sheet.append(heading);
      const group=i===0?grid:i===1?document.createElement('div'):rare;
      if(i===1)group.className='sticker-grid';
      group.hidden=false;
      if(i<2)slots.slice(i*3,i*3+3).forEach(slot=>group.append(slot));
      sheet.append(group);
      const folio=document.createElement('span');folio.className='folio-number';folio.textContent=['I','II','III'][i];sheet.append(folio);
      volume.append(sheet);sheets.push(sheet);
    }
    pages.set(id,sheets);positions.set(id,0);
  }
  const nav=document.createElement('nav');nav.className='book-navigation';nav.setAttribute('aria-label','Pages du grimoire');
  nav.innerHTML='<button type="button" class="book-arrow" aria-label="Page précédente">←</button><div class="book-index"><button type="button" aria-label="Page 1">01</button><button type="button" aria-label="Page 2">02</button><button type="button" aria-label="Page 3, rares">✦</button></div><button type="button" class="book-arrow" aria-label="Page suivante">→</button>';
  content.append(nav);
  const status=document.createElement('p');status.className='book-status';status.setAttribute('aria-live','polite');content.append(status);
  const arrows=nav.querySelectorAll('.book-arrow'),indices=[...nav.querySelectorAll('.book-index button')];
  function sync(){
    const page=positions.get(category);
    chapter.textContent='Grimoire · '+['I','II','III','IV'][Number(category)-1];
    arrows[0].disabled=page===0;arrows[1].disabled=page===2;
    indices.forEach((b,i)=>{b.setAttribute('aria-current',i===page?'page':'false');});
    status.textContent='Page '+(page+1)+' sur 3 · '+(page===2?'2 stickers rares':'3 stickers');
    panel.dataset.bookPage=String(page+1);
  }
  function showCurrent(){
    pages.forEach((sheets,id)=>sheets.forEach((sheet,i)=>{sheet.hidden=id!==category||i!==positions.get(id);sheet.inert=sheet.hidden;}));
    sync();
  }
  async function turn(page){
    if(page<0||page>2||document.querySelector('.peel-sticker[data-lifted="true"]'))return;
    if(turning){pendingPage=page;return;}
    if(page===positions.get(category))return;
    document.dispatchEvent(new Event('stck:page'));
    turning=true;const token=++changeToken;
    const previous=positions.get(category),old=pages.get(category)[previous],next=pages.get(category)[page];
    positions.set(category,page);sync();
    if(reduced.matches){showCurrent();turning=false;return;}
    old.inert=true;next.hidden=false;next.inert=true;
    const forward=page>previous;
    old.style.zIndex=forward?'3':'1';next.style.zIndex=forward?'1':'3';
    old.style.transformOrigin=next.style.transformOrigin='left center';
    const leaf=forward?old:next;
    const frames=forward?[{transform:'rotateY(0deg)',opacity:1},{transform:'rotateY(-88deg)',opacity:.25}]:[{transform:'rotateY(-88deg)',opacity:.25},{transform:'rotateY(0deg)',opacity:1}];
    const animation=leaf.animate(frames,{duration:440,easing:'cubic-bezier(.35,.02,.25,1)',fill:'forwards'});
    try{await animation.finished;}catch{}
    animation.cancel();old.style.zIndex='';next.style.zIndex='';
    if(token===changeToken){
      showCurrent();turning=false;
      if(pendingPage!==null){const queued=pendingPage;pendingPage=null;turn(queued);}
    }
  }
  arrows[0].onclick=()=>turn(positions.get(category)-1);arrows[1].onclick=()=>turn(positions.get(category)+1);
  indices.forEach((b,i)=>b.onclick=()=>turn(i));
  nav.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();turn(positions.get(category)+(e.key==='ArrowRight'?1:-1));}});
  let swipe=null;
  volume.addEventListener('pointerdown',e=>{if(!e.target.closest('.peel-sticker'))swipe={x:e.clientX,y:e.clientY,id:e.pointerId};});
  volume.addEventListener('pointerup',e=>{if(swipe&&swipe.id===e.pointerId&&Math.abs(e.clientX-swipe.x)>55&&Math.abs(e.clientY-swipe.y)<40)turn(positions.get(category)+(e.clientX<swipe.x?1:-1));swipe=null;});
  volume.addEventListener('pointercancel',()=>swipe=null);

  document.addEventListener('stck:collection',async e=>{
    if(openingBook || !pages.has(String(e.detail)))return;
    category=String(e.detail);++changeToken;turning=false;pendingPage=null;
    volume.getAnimations({subtree:true}).forEach(a=>a.cancel());showCurrent();
    await openBook(category);
  });
  const collection=panel.closest('.collection');
  const lobby=document.createElement('div');lobby.className='library-lobby';
  lobby.innerHTML='<p class="library-kicker">À COLLECTIONNER À DEUX</p><h2>La petite bibliothèque</h2><p class="library-invitation">Choisis un grimoire.</p>';
  const tabs=document.querySelector('.collection-tabs');
  tabs.setAttribute('aria-label','Grimoires de la bibliothèque');
  collection.prepend(lobby);lobby.append(tabs);
  const books=[...tabs.children];
  const symbols=['♡','☁','✧','☾'];
  books.forEach((tab,i)=>{
    tab.innerHTML='<span class="spine-number">0'+(i+1)+'</span><span class="spine-title">'+tab.dataset.title+'</span><span class="spine-symbol">'+symbols[i]+'</span>';
    tab.classList.remove('is-active');tab.setAttribute('aria-selected','false');
  });
  const close=document.createElement('button');close.type='button';close.className='close-grimoire';close.textContent='← Bibliothèque';close.setAttribute('aria-label','Ranger le grimoire');panel.prepend(close);
  let openingBook=false;
  async function openBook(id){
    if(openingBook)return;
    openingBook=true;
    const tab=books[Number(id)-1],pickedOrigin=tab.stckBookOrigin;
    delete tab.stckBookOrigin;
    lobby.inert=true;panel.dataset.libraryState='opening';
    let cover=null,pick=null;
    try{
      // A drag already took the volume off the shelf. A click lifts it rigidly.
      if(!reduced.matches&&!pickedOrigin){
        pick=tab.animate([{transform:'translate(0,0)',opacity:1},{transform:'translate(-3px,-13px)',opacity:1,offset:.65},{transform:'translate(-5px,-20px)',opacity:0}],{duration:230,easing:'ease-in',fill:'forwards'});
        await pick.finished;
      }
      panel.hidden=false;panel.inert=true;lobby.hidden=true;
      document.body.dataset.grimoireOpen='true';
      window.scrollTo({top:0,behavior:'instant'});
      pick?.cancel();
      if(!reduced.matches){
        const to=volume.getBoundingClientRect();
        cover=document.createElement('div');cover.className='flying-cover';cover.dataset.collection=id;
        const title=document.createElement('strong');title.textContent=tab.dataset.title;cover.append(title);
        Object.assign(cover.style,{left:to.left+'px',top:to.top+'px',width:to.width+'px',height:to.height+'px'});
        document.body.append(cover);
        await cover.animate([{transform:'perspective(1000px) rotateY(0)',opacity:1},{transform:'perspective(1000px) rotateY(-100deg)',opacity:1}],{duration:460,easing:'cubic-bezier(.35,.02,.2,1)',fill:'forwards'}).finished;
      }
    }catch{}finally{
      pick?.cancel();cover?.remove();panel.hidden=false;lobby.hidden=true;lobby.inert=false;
      document.body.dataset.grimoireOpen='true';panel.inert=false;panel.dataset.libraryState='open';openingBook=false;close.focus({preventScroll:true});
    }
  }
  close.onclick=async()=>{
    if(openingBook||turning||document.querySelector('.peel-sticker[data-lifted="true"]'))return;
    document.dispatchEvent(new Event('stck:library'));openingBook=true;panel.inert=true;
    if(!reduced.matches)await panel.animate([{transform:'none',opacity:1},{transform:'translateY(12px)',opacity:0}],{duration:220,easing:'ease-in',fill:'none'}).finished;
    panel.hidden=true;panel.inert=false;lobby.hidden=false;openingBook=false;
    document.body.dataset.grimoireOpen='false';
    books.forEach(b=>{b.setAttribute('aria-selected','false');b.classList.remove('is-active');});
    books[Number(category)-1].focus({preventScroll:true});
  };
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)close.click();});
  showCurrent();panel.hidden=true;
})();
