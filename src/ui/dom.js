import { assets } from '../engine/assets.js';

export function el(tag, cls = '', html = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

export function icon(name, big = false) {
  const meta = assets.json['ui/icons.json'];
  const i = meta?.icons[name] ?? 0;
  return `<span class="icon${big ? ' big' : ''}" style="background-image:url(./assets/ui/icons.png);background-position:${-i * 16}px 0"></span>`;
}

export function portraitURL(name, expr = 'normal') {
  return `./assets/portraits/${name}_${expr}.png`;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// project a world position into CSS pixels
export function toScreen(v, camera) {
  const p = v.clone().project(camera);
  return { x: (p.x * 0.5 + 0.5) * window.innerWidth, y: (-p.y * 0.5 + 0.5) * window.innerHeight, behind: p.z > 1 };
}
