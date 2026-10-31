(() => {
  const panel = document.getElementById("collection-window");
  if (!panel) return;
  const collection = panel.closest(".collection");
  const content = panel.querySelector(".collection-content");
  const tabs = [...collection.querySelectorAll(".collection-tab")];
  const sheets = [];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const stack = document.createElement("div");
  stack.className = "sheet-stack";
  stack.setAttribute("aria-label", "Planches de stickers superposées");
  panel.querySelector(".collection-heading").classList.add("visually-hidden");
  panel
    .querySelectorAll(".rare-divider,.collection-empty")
    .forEach((n) => n.remove());
  tabs.forEach((tab, i) => {
    const id = tab.dataset.collection;
    const grid = panel.querySelector(`[data-sticker-collection="${id}"]`);
    const rare = panel.querySelector(
      `.rare-stickers[data-rare-collection="${id}"]`,
    );
    const sheet = document.createElement("section");
    sheet.className = "sticker-sheet";
    sheet.dataset.collection = id;
    sheet.style.setProperty('--tone',tab.dataset.tone||'#aeb8a8');
    sheet.dataset.title = tab.dataset.title;
    sheet.setAttribute("aria-label", tab.dataset.title);
    const heading = document.createElement("header");
    heading.className = "sheet-heading";
    const title = document.createElement("h3");
    title.textContent = tab.dataset.title;
    const number = document.createElement("span");
    number.textContent = `${String(i + 1).padStart(2,'0')} / ${String(tabs.length).padStart(2,'0')}`;
    const meta = document.createElement('div');meta.className='sheet-meta';
    const season = document.createElement('span');season.className='season-tag';season.textContent='Saison 1';
    meta.append(season,number);heading.append(title,meta);
    sheet.classList.add('is-undiscovered');
    grid.hidden = false;
    grid.append(...rare.children);
    rare.remove();
    sheet.append(heading, grid);
    stack.append(sheet);
    sheets.push(sheet);
    tab.textContent = "";
    tab.setAttribute("aria-label", `Planche ${tab.dataset.title}`);
    const dot = document.createElement("span");
    dot.setAttribute("aria-hidden", "true");
    tab.append(dot);
  });
  content.append(stack);
  let completedCollections=new Set();
  function updateDiscoveries(event){
    const discovered=new Set(event.detail || []);
    [...sheets,...document.querySelectorAll('.special-sheet')].forEach(sheet=>{
      const known=[...sheet.querySelectorAll('.peel-sticker')].some(button=>discovered.has(button.dataset.stickerId));
      sheet.classList.toggle('is-undiscovered',!known&&!completedCollections.has(sheet.dataset.collection));
      sheet.setAttribute('aria-label',known||completedCollections.has(sheet.dataset.collection)?sheet.dataset.title:'Planche à découvrir');
    });
  }
  const rewardCollectionIds={amour:'5',douceurs:'1',saveurs:'2',plaisirs:'3',intimite:'6','porn-love':'4','rouge-gorge':'7',monoprix:'8'};
  document.addEventListener('stck:rewards',event=>{
    completedCollections=new Set((event.detail||[]).map(row=>rewardCollectionIds[row.collection_key]));
    for(const sheet of [...sheets,...document.querySelectorAll('.special-sheet')]){
      const complete=completedCollections.has(sheet.dataset.collection);
      sheet.classList.toggle('is-completed',complete);
      let emblem=sheet.querySelector('.completion-emblem');
      if(complete&&!emblem){
        emblem=document.createElement('span');emblem.className='completion-emblem';emblem.setAttribute('role','img');
        emblem.setAttribute('aria-label',sheet.dataset.title+' : planche complétée, récompense permanente');
        emblem.innerHTML='<svg viewBox="0 0 40 46" aria-hidden="true"><path d="M11 27L7 43L18 38L22 44L27 27" fill="#a6b39a" stroke="#566c50" stroke-width="2"/><path d="M20 2L26 6L33 6L35 14L39 20L35 26L33 33L26 34L20 38L14 34L7 33L5 26L1 20L5 14L7 6L14 6Z" fill="#e1c07b" stroke="#76633e" stroke-width="2"/><path d="M11 20L17 26L29 13" fill="none" stroke="#647252" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        sheet.querySelector('.sheet-heading').append(emblem);
      }
      if(emblem)emblem.hidden=!complete;
      if(complete){sheet.classList.remove('is-undiscovered');sheet.setAttribute('aria-label',sheet.dataset.title+' · complétée');}
    }
  });
  document.addEventListener('stck:discoveries',updateDiscoveries);
  document.addEventListener('stck:identity',()=>{completedCollections.clear();updateDiscoveries({detail:[]});});
  const nav = document.createElement("nav");
  nav.className = "sheet-navigation";
  nav.setAttribute("aria-label", "Changer de planche");
  const previous = document.createElement("button"),
    next = document.createElement("button");
  for (const [button, label, symbol] of [
    [previous, "Planche précédente", "←"],
    [next, "Planche suivante", "→"],
  ]) {
    button.type = "button";
    button.className = "sheet-arrow";
    button.setAttribute("aria-label", label);
    button.textContent = symbol;
  }
  nav.append(previous, collection.querySelector(".collection-tabs"), next);
  panel.append(nav);
  const announcement = document.createElement("p");
  announcement.className = "visually-hidden";
  announcement.setAttribute("aria-live", "polite");
  panel.append(announcement);
  let current = 0,
    turning = false,
    gesture = null;
  function layout() {
    sheets.forEach((sheet, i) => {
      const depth = (i - current + sheets.length) % sheets.length;
      sheet.style.setProperty("--depth", depth);
      sheet.style.zIndex = String(sheets.length - depth);
      sheet.inert = depth !== 0;
      sheet.setAttribute("aria-hidden", String(depth !== 0));
      sheet.classList.toggle("is-front", depth === 0);
    });
    // Measure layout dimensions, independent of the sheet's animated rotation.
    // The largest grid sets one shared paper size for every normal sheet.
    const required=Math.max(...sheets.map(sheet=>{
      const grid=sheet.querySelector('.sticker-grid'),heading=sheet.querySelector('.sheet-heading');
      const style=getComputedStyle(sheet),hs=getComputedStyle(heading);
      return grid.offsetHeight+heading.offsetHeight+parseFloat(hs.marginBottom)+parseFloat(style.paddingTop)+parseFloat(style.paddingBottom)+4;
    }));
    stack.style.height=Math.ceil(required)+'px';
    announcement.textContent = `${tabs[current].dataset.title}, planche ${current + 1} sur ${sheets.length}`;
  }
  function lifted() {
    return !!document.querySelector('.peel-sticker[data-lifted="true"]');
  }
  async function turn(index) {
    if (turning || index === current) return;
    turning = true;
    panel.classList.add("is-turning");
    const old = sheets[current],
      direction = (index - current + tabs.length) % tabs.length === tabs.length - 1 ? 1 : -1;
    const from = old.style.transform || "translateX(0) rotate(-1deg)";
    const away = `translateX(${direction * 115}%) rotate(${direction * 13}deg)`;
    document.dispatchEvent(new Event("stck:page"));
    let animation;
    try {
      if (!reduced.matches) {
        animation = old.animate([{ transform: from }, { transform: away }], {
          duration: 220,
          easing: "cubic-bezier(.3,.05,.7,.6)",
          fill: "forwards",
        });
        await animation.finished;
      }
      current = index;
      old.style.transform = "";
      layout();
      animation?.cancel();
      if (!reduced.matches) {
        animation = old.animate(
          [{ transform: away }, { transform: getComputedStyle(old).transform }],
          { duration: 230, easing: "cubic-bezier(.15,.7,.2,1)" },
        );
        await animation.finished;
      }
    } catch {
      current = index;
      old.style.transform = "";
      layout();
    } finally {
      animation?.cancel();
      turning = false;
      panel.classList.remove("is-turning");
    }
  }
  // Existing catalogue selection also updates labels and keyboard navigation.
  document.addEventListener("stck:collection", (e) =>
    turn(tabs.findIndex(tab=>tab.dataset.collection===String(e.detail))),
  );
  collection.querySelector(".collection-tabs").addEventListener(
    "click",
    (e) => {
      if (turning || lifted()) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true,
  );
  previous.onclick = () => {
    if (!turning && !lifted()) tabs[(current + tabs.length - 1) % tabs.length].click();
  };
  next.onclick = () => {
    if (!turning && !lifted()) tabs[(current + 1) % tabs.length].click();
  };
  stack.addEventListener("pointerdown", (e) => {
    if (
      e.button !== 0 ||
      turning ||
      lifted() ||
      e.target.closest(".peel-sticker")
    )
      return;
    gesture = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      dx: 0,
      active: false,
    };
  });
  stack.addEventListener("pointermove", (e) => {
    const g = gesture;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x,
      dy = e.clientY - g.y;
    if (!g.active) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
        gesture = null;
        return;
      }
      if (Math.abs(dx) < 10) return;
      g.active = true;
      stack.setPointerCapture(e.pointerId);
    }
    e.preventDefault();
    g.dx = dx;
    sheets[current].classList.add("is-dragging");
    sheets[current].style.transform =
      `translateX(${dx}px) rotate(${-1 + Math.max(-10, Math.min(10, dx / 22))}deg)`;
  });
  function finish(e, cancel = false) {
    const g = gesture;
    if (!g || (e && g.id !== e.pointerId)) return;
    gesture = null;
    sheets[current].classList.remove("is-dragging");
    if (stack.hasPointerCapture(g.id)) stack.releasePointerCapture(g.id);
    if (
      !cancel &&
      g.active &&
      Math.abs(g.dx) > Math.min(65, stack.clientWidth * 0.18)
    )
      tabs[(current + (g.dx < 0 ? 1 : tabs.length - 1)) % tabs.length].click();
    else sheets[current].style.transform = "";
  }
  stack.addEventListener("pointerup", (e) => finish(e));
  stack.addEventListener("pointercancel", (e) => finish(e, true));
  stack.addEventListener("lostpointercapture", (e) => finish(e, true));
  window.addEventListener("blur", () => finish(null, true));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) finish(null, true);
  });
  window.addEventListener('resize',layout);
  layout();
})();
