'use strict';
(() => {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  function selectTab(tab, focus = false) {
    tabs.forEach(item => {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected)); item.tabIndex = selected ? 0 : -1;
      document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
    });
    if (focus) tab.focus();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', event => {
      const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
      if (next >= 0) { event.preventDefault(); selectTab(tabs[next], true); }
    });
  });
  // Vanilla adaptation of React Bits DecryptedText; see THIRD-PARTY-NOTICES.txt.
  // Fixed glyph widths and an accessible label keep the reveal stable and readable.
  const title = document.querySelector('[data-decrypt]'), original = title.textContent;
  const motion = matchMedia('(prefers-reduced-motion: reduce)'); let timer;
  function finish() { clearInterval(timer); title.textContent = original; title.removeAttribute('aria-label'); }
  function reveal() {
    if (motion.matches) return;
    title.setAttribute('aria-label', original);
    const letters = [...original].map(char => {
      const slot = document.createElement('span'); slot.className = 'decrypt-char'; slot.setAttribute('aria-hidden', 'true');
      const ghost = document.createElement('span'); ghost.className = 'decrypt-ghost'; ghost.textContent = char;
      const glyph = document.createElement('span'); glyph.className = 'decrypt-glyph'; glyph.textContent = char;
      slot.append(ghost, glyph); return { slot, glyph, char };
    });
    title.replaceChildren(...letters.map(item => item.slot));
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; let step = 0;
    timer = setInterval(() => {
      step++;
      letters.forEach((item, index) => { item.glyph.textContent = index < step / 1.5 ? item.char : alphabet[Math.floor(Math.random() * alphabet.length)]; });
      if (step >= letters.length * 1.5) finish();
    }, 42);
  }
  motion.addEventListener('change', event => { if (event.matches) finish(); }); reveal();
  // GSAP owns this finite entrance, separate from the artwork's render loop.
  const mm = window.gsap?.matchMedia();
  mm?.add('(prefers-reduced-motion: no-preference)', () => {
    gsap.timeline({ defaults: { duration: .65, ease: 'power2.out', clearProps: 'transform,opacity,visibility' } })
      .from('.stage-heading', { y: 12, autoAlpha: 0 })
      .from('.stage', { y: 16, autoAlpha: 0 }, .12)
      .from('aside', { x: 12, autoAlpha: 0 }, .22);
  });
  window.addEventListener('pagehide', () => { finish(); mm?.revert(); });
})();
