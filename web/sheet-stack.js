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
    sheet.setAttribute("aria-label", tab.dataset.title);
    const heading = document.createElement("header");
    heading.className = "sheet-heading";
    const title = document.createElement("h3");
    title.textContent = tab.dataset.title;
    const number = document.createElement("span");
    number.textContent = `0${i + 1} / 04`;
    heading.append(title, number);
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
  const hint = document.createElement("p");
  hint.className = "sheet-hint";
  hint.textContent = "Glisse la planche pour en changer.";
  panel.append(hint);
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
      sheet.style.zIndex = String(4 - depth);
      sheet.inert = depth !== 0;
      sheet.setAttribute("aria-hidden", String(depth !== 0));
      sheet.classList.toggle("is-front", depth === 0);
    });
    announcement.textContent = `${tabs[current].dataset.title}, planche ${current + 1} sur 4`;
  }
  function lifted() {
    return !!document.querySelector('.peel-sticker[data-lifted="true"]');
  }
  async function turn(index) {
    if (turning || index === current) return;
    turning = true;
    hint.classList.add("is-learned");
    panel.classList.add("is-turning");
    const old = sheets[current],
      direction = (index - current + 4) % 4 === 3 ? 1 : -1;
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
    turn(Number(e.detail) - 1),
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
    if (!turning && !lifted()) tabs[(current + 3) % 4].click();
  };
  next.onclick = () => {
    if (!turning && !lifted()) tabs[(current + 1) % 4].click();
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
      tabs[(current + (g.dx < 0 ? 1 : 3)) % 4].click();
    else sheets[current].style.transform = "";
  }
  stack.addEventListener("pointerup", (e) => finish(e));
  stack.addEventListener("pointercancel", (e) => finish(e, true));
  stack.addEventListener("lostpointercapture", (e) => finish(e, true));
  window.addEventListener("blur", () => finish(null, true));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) finish(null, true);
  });
  layout();
})();
