(() => {
  'use strict';
  const stage = document.getElementById('peelStage');
  const lobby = document.querySelector('.library-lobby');
  const panel = document.getElementById('collection-window');
  if (!stage || !lobby || !panel) return;
  document.body.classList.add('stck-library');
  stage.prepend(panel.closest('.collection'));
  const header = document.querySelector('.app-header');
  const pouchLink = header.querySelector('.pouch-link');
  const pouchHref = pouchLink.getAttribute('href');
  pouchLink.remove();
  header.querySelector('.sticker-logo').setAttribute('aria-label', 'STCK');
  const tabs = lobby.querySelector('.collection-tabs');
  [...lobby.children].filter(node => node !== tabs).forEach(node => node.remove());
  tabs.setAttribute('role', 'group');
  const shelf = document.createElement('div');
  shelf.className = 'library-shelf';
  tabs.before(shelf); shelf.append(tabs);
  const books = [...tabs.querySelectorAll('.collection-tab')];
  // Arrows browse the shelf; Enter/Space picks the focused volume.
  tabs.addEventListener('keydown', event => {
    const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    const index = books.indexOf(event.target.closest('.collection-tab'));
    if (!direction || index < 0) return;
    event.preventDefault(); event.stopImmediatePropagation();
    books[(index + direction + books.length) % books.length].focus();
  }, true);
  books.forEach((book, index) => {
    book.setAttribute('role', 'button');
    book.setAttribute('aria-label', 'Ouvrir le grimoire ' + book.dataset.title);
    book.removeAttribute('aria-selected'); book.tabIndex = 0;
    book.querySelector('.spine-number').remove();
    book.querySelector('.spine-title').remove();
    book.querySelector('.spine-symbol').remove();
    const artwork = document.createElement('span');
    artwork.className = 'book-art'; artwork.setAttribute('aria-hidden', 'true');
    artwork.innerHTML = window.stckBookArtwork(index, book.dataset.title);
    book.prepend(artwork);
  });
  const booster = document.createElement('a');
  booster.className = 'booster-link'; booster.href = pouchHref;
  booster.innerHTML = '<span>Ouvrir une pochette</span><span aria-hidden="true">↗</span>';
  lobby.append(booster);
  const board = document.getElementById('dropTarget');
  const table = document.createElement('section');
  table.className = 'collage-table'; table.setAttribute('aria-label', 'Table de collage');
  board.before(table); table.append(board);
  panel.querySelector('.book-chapter')?.remove();
  // The paging controller keeps these detached nodes for its internal updates.
  panel.querySelector('.book-status')?.remove();
  panel.querySelectorAll('.sheet-heading').forEach(node => node.remove());
  const close = panel.querySelector('.close-grimoire');
  close.textContent = '← Ranger';
  const sync = () => {
    const isOpen = !panel.hidden;
    document.body.dataset.grimoireOpen = String(isOpen);
    books.forEach(book => {
      book.removeAttribute('aria-selected'); book.tabIndex = 0;
      book.setAttribute('aria-expanded', String(isOpen && panel.dataset.collection === book.dataset.collection));
    });
  };
  new MutationObserver(sync).observe(panel, {attributes:true, attributeFilter:['hidden','data-collection']});
  sync(); panel.setAttribute('role', 'region'); panel.setAttribute('aria-labelledby', 'collectionTitle');
  document.addEventListener('stck:collection', event => {
    panel.setAttribute('aria-labelledby', 'collectionTitle');
    document.documentElement.style.setProperty('--active-book-tone', ['#aeb8a8','#c8b795','#aab8bf','#c5aaa3'][Number(event.detail)-1]);
  });
})();
