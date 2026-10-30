(() => {
  'use strict';
  // Every volume uses the same units and parallel depth vector. Only its height
  // and cloth color vary; its bottom edge always meets the shelf at y = 294.
  const tones = ['#aeb8a8', '#c8b795', '#aab8bf', '#c5aaa3'];
  const heights = [258, 243, 274, 251];
  window.stckBookArtwork = (index, title) => {
    const top = 294 - heights[index];
    const tone = tones[index];
    const id = 'binding-' + index;
    const front = `M12 ${top}Q38 ${top+3} 68 ${top}V288Q68 294 62 294H14Q8 294 8 288V${top+6}Q8 ${top+1} 12 ${top}Z`;
    const titleY = top + heights[index] * .51;
    const pages = [19,28,37,46,55,62].map(x => `<path d="M${x} ${top-1}l26 -13"/>`).join('');
    return `<svg viewBox="0 0 104 294" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="${id}-cloth" x1="0" x2="1">
          <stop stop-color="#344639" stop-opacity=".24"/>
          <stop offset=".12" stop-color="#fff" stop-opacity=".12"/>
          <stop offset=".4" stop-color="#fff" stop-opacity=".03"/>
          <stop offset=".86" stop-color="#344639" stop-opacity=".03"/>
          <stop offset="1" stop-color="#344639" stop-opacity=".21"/>
        </linearGradient>
        <linearGradient id="${id}-side" x1="0" x2="1">
          <stop stop-color="#344639" stop-opacity=".18"/>
          <stop offset="1" stop-color="#344639" stop-opacity=".06"/>
        </linearGradient>
        <linearGradient id="${id}-paper" x1="0" y1="1" x2="1" y2="0">
          <stop stop-color="#d9d5c7"/><stop offset="1" stop-color="#f7f3e7"/>
        </linearGradient>
        <pattern id="${id}-weave" width="3" height="3" patternUnits="userSpaceOnUse">
          <path d="M0 0H3M0 0V3" stroke="#fff" stroke-opacity=".09" stroke-width=".4"/>
          <path d="M1.5 0V3" stroke="#394637" stroke-opacity=".04" stroke-width=".5"/>
        </pattern>
      </defs>
      <ellipse cx="56" cy="293" rx="48" ry="3" fill="#3f4934" opacity=".12"/>
      <path d="M9 ${top}l30 -15h56q5 0 5 4V278L68 294H13Z" fill="${tone}" stroke="#5c6657" stroke-opacity=".28" stroke-width=".7" stroke-linejoin="round"/>
      <path d="M15 ${top-1}l27 -13h51l-26 13Q40 ${top+2} 15 ${top-1}Z" fill="url(#${id}-paper)"/>
      <g fill="none" stroke="#b0a994" stroke-opacity=".45" stroke-width=".6">${pages}</g>
      <path d="M68 ${top}l29 -14q3 -1 3 3V275q0 3 -3 5l-29 14Z" fill="${tone}"/>
      <path d="M68 ${top}l29 -14q3 -1 3 3V275q0 3 -3 5l-29 14Z" fill="url(#${id}-side)"/>
      <path d="M73 ${top+6}l21 -10V270l-21 10Z" fill="none" stroke="#f5f1df" stroke-opacity=".16" stroke-width=".7"/>
      <path d="M98 ${top-10}V276" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width=".7"/>
      <path d="${front}" fill="${tone}"/>
      <path d="${front}" fill="url(#${id}-cloth)"/>
      <path d="${front}" fill="url(#${id}-weave)" stroke="#4d5948" stroke-opacity=".25" stroke-width=".7"/>
      <path d="M14 ${top+7}V286" stroke="#f8f6ea" stroke-opacity=".35" stroke-width=".8"/>
      <g fill="none" stroke="#f5f0df" stroke-opacity=".5" stroke-width=".65">
        <path d="M21 ${top+32}H57M21 ${top+35}H57M21 266H57M21 269H57"/>
      </g>
      <text transform="translate(39 ${titleY}) rotate(90)" text-anchor="middle" dominant-baseline="middle" fill="#354638" fill-opacity=".87" font-family="Georgia,serif" font-size="21" letter-spacing=".15">${title}</text>
      <path d="m37 280 2-3 2 3-2 3Z" fill="#f4eddb" opacity=".65"/>
    </svg>`;
  };
})();
