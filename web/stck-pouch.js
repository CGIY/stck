(() => {
  'use strict';
  document.querySelectorAll('.eyebrow,.intro,.pouch-page > h1,.footnote').forEach(node => node.remove());
  const logo = document.querySelector('.topbar .logo');
  logo.innerHTML = '<svg viewBox="0 0 224 100" role="img" aria-label="STCK"><rect x="8" y="8" width="208" height="80" rx="22" fill="#b7c1ad" stroke="#fffdf7" stroke-width="7"/><text x="108" y="69" text-anchor="middle" fill="#30382e" font-size="65" font-weight="900" letter-spacing="-5">Stck</text></svg>';
  const back = document.querySelector('.back-link');
  back.textContent = '←'; back.setAttribute('aria-label', 'Revenir aux planches');
  document.getElementById('again').textContent = 'Encore une';
  document.getElementById('clearKeyboard').textContent = 'Révéler';
  const instruction = document.getElementById('instruction');
  const copy = new Map([
    ['Il te regarde. Touche-le pour commencer.', 'Touche la pochette'],
    ['Hé ! Ça chatouille…', ''], ['Mais… qu’est-ce que tu fais ?', ''],
    ['Je te préviens…', ''], ['ÇA. SUFFIT.', ''], ['Ça suffit. Vraiment.', ''],
    ['Pouf.', ''], ['Il a disparu. Son secret est encore là.', ''], ['Le voilà.', '']
  ]);
  const trim = () => {
    const text = instruction.textContent;
    if (copy.has(text)) instruction.textContent = copy.get(text);
    instruction.hidden = !instruction.textContent.trim();
  };
  new MutationObserver(trim).observe(instruction, {childList:true,characterData:true,subtree:true});
  trim();
  const rarity = document.getElementById('revealedRarity');
  const trimRarity = () => { rarity.hidden = rarity.textContent === 'Collection'; };
  new MutationObserver(trimRarity).observe(rarity, {childList:true});
  trimRarity();
})();
