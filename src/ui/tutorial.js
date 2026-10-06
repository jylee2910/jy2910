import { audio } from '../engine/audio.js';
import { input } from '../engine/input.js';
import { el } from './dom.js';

// Paged tutorial popup. pages = [{en, title, text:[...]}]
export function showTutorial(pages, root = document.getElementById('ui')) {
  return new Promise((res) => {
    let i = 0;
    const dim = el('div', 'dim');
    const box = el('div', 'tutorial panel');
    root.append(dim, box);
    const show = () => {
      const p = pages[i];
      box.innerHTML = `<h3><small>${p.en || 'TUTORIAL'}</small>${p.title}</h3>${p.text.map((t) => `<p>${t}</p>`).join('')}<div class="pg">${i + 1} / ${pages.length}<span class="nx">▼</span></div>`;
    };
    show();
    let ready = false;
    setTimeout(() => (ready = true), 250);
    const next = () => {
      if (!ready) return;
      audio.sfx('cursor');
      i++;
      if (i >= pages.length) {
        off();
        dim.remove();
        box.remove();
        res();
      } else show();
    };
    const off = input.on((a) => {
      if (a === 'ok' || a === 'cancel') next();
    });
    box.onclick = next;
    if (window.game?.auto) {
      const t = setInterval(() => {
        if (!box.isConnected) return clearInterval(t);
        next();
      }, 700);
    }
  });
}
