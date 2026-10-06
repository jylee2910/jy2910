// On-screen controls for touch devices: virtual stick + OK / Cancel / Menu.
import { input } from '../engine/input.js';
import { el } from './dom.js';

export function setupTouch() {
  if (!('ontouchstart' in window) && !navigator.maxTouchPoints) return;
  const root = el('div', 'touch');
  root.innerHTML = `<div class="pad"><div class="nub"></div></div><div class="btns"><div data-a="menu">메뉴</div><div data-a="cancel">취소</div><div data-a="ok">결정</div></div>`;
  document.getElementById('app').appendChild(root);
  const pad = root.querySelector('.pad');
  const nub = root.querySelector('.nub');
  let id = null;
  let last = null;
  const move = (t) => {
    const r = pad.getBoundingClientRect();
    let x = (t.clientX - r.left - r.width / 2) / (r.width / 2);
    let y = (t.clientY - r.top - r.height / 2) / (r.height / 2);
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    input.stick.x = x;
    input.stick.y = y;
    nub.style.transform = `translate(${x * 40}px, ${y * 40}px)`;
    // emit discrete directions for menus
    const dir = l < 0.5 ? null : Math.abs(x) > Math.abs(y) ? (x < 0 ? 'left' : 'right') : y < 0 ? 'up' : 'down';
    if (dir && dir !== last) input.tap(dir);
    last = dir;
  };
  pad.addEventListener('touchstart', (e) => {
    id = e.changedTouches[0].identifier;
    move(e.changedTouches[0]);
    e.preventDefault();
  });
  pad.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) if (t.identifier === id) move(t);
    e.preventDefault();
  });
  const end = () => {
    input.stick.x = input.stick.y = 0;
    nub.style.transform = '';
    last = null;
  };
  pad.addEventListener('touchend', end);
  pad.addEventListener('touchcancel', end);
  root.querySelectorAll('[data-a]').forEach((b) =>
    b.addEventListener('touchstart', (e) => {
      e.preventDefault();
      input.tap(b.dataset.a);
    }),
  );
}
