// 클래식 JRPG UI 키트: 장식 테두리 창, 손가락 커서 리스트 메뉴, 대화창, 배너, 토스트
import { input } from '../core/input.js';
import { iconURL } from '../art/assets.js';
import { sfx } from '../core/audio.js';

export const root = () => document.getElementById('ui');

export function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export function icon(name, cls = 'ic') { return `<img class="${cls}" src="${iconURL(name)}" alt="">`; }
export function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

export function win(cls = '', parent = root()) {
  const w = el('div', 'win ' + cls);
  parent.appendChild(w);
  return w;
}

// ─────────────────────────────────────────────────────────────
//  리스트 메뉴 (키보드: 방향키/확인/취소, 터치·마우스: 탭으로 선택)
//  items: [{label, right, icon, disabled, data, cls, sub}]
// ─────────────────────────────────────────────────────────────
export class ListMenu {
  constructor(parent, items, opt = {}) {
    this.opt = opt;
    this.el = el('div', 'menu ' + (opt.cls || ''));
    if (opt.columns) this.el.style.gridTemplateColumns = `repeat(${opt.columns}, 1fr)`;
    parent.appendChild(this.el);
    this.cursor = el('img', 'cursor'); this.cursor.src = iconURL('cursor');
    this.index = opt.index || 0;
    this.active = true;
    this.setItems(items);
    this.handler = { onKey: k => this.onKey(k), modal: opt.modal !== false, el: this.el };
    if (opt.push !== false) input.push(this.handler);
  }
  setItems(items, keepIndex = true) {
    this.items = items;
    this.el.innerHTML = '';
    this.nodes = items.map((it, i) => {
      const n = el('div', 'mi' + (it.disabled ? ' dis' : '') + (it.header ? ' hdr' : '') + (it.cls ? ' ' + it.cls : ''));
      n.innerHTML = (it.icon || it.iconURL ? `<img class="ic" src="${it.iconURL || iconURL(it.icon)}" alt="">` : '') +
        `<span class="lb">${it.label}</span>` + (it.right !== undefined ? `<span class="rt">${it.right}</span>` : '') +
        (it.sub ? `<div class="sub">${it.sub}</div>` : '');
      if (it.header) { this.el.appendChild(n); return n; }
      n.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse' && this.active) this.focus(i, false); });
      n.addEventListener('click', e => { e.stopPropagation(); if (!this.active) return; if (i !== this.index && it.tapFocus) { this.focus(i); return; } this.focus(i, false); this.select(); });
      this.el.appendChild(n);
      return n;
    });
    if (!keepIndex) this.index = 0;
    this.index = Math.min(this.index, Math.max(0, items.length - 1));
    this.focus(this.index, false, true);
  }
  focus(i, sound = true, force = false, dir = 1) {
    if (!this.items.length || this.items.every(it => it.header)) { this.cursor.remove(); return; }
    const len = this.items.length;
    i = (i + len) % len;
    for (let g = 0; g < len && this.items[i].header; g++) i = (i + dir + len) % len;
    if (i === this.index && !force && this.cursor.parentNode) return;
    this.index = i;
    this.nodes.forEach((n, k) => n.classList.toggle('on', k === this.index));
    const n = this.nodes[this.index];
    n.prepend(this.cursor);
    if (sound) sfx('cursor');
    n.scrollIntoView?.({ block: 'nearest' });
    this.opt.onFocus?.(this.items[this.index], this.index);
  }
  select() {
    const it = this.items[this.index];
    if (!it) return;
    if (it.disabled) { sfx('buzz'); this.opt.onDisabled?.(it); return; }
    sfx('ok');
    this.opt.onSelect?.(it, this.index);
  }
  onKey(k) {
    if (!this.active) return false;
    const cols = this.opt.columns || 1;
    if (k === 'up') this.focus(this.index - cols, true, false, -1);
    else if (k === 'down') this.focus(this.index + cols, true, false, 1);
    else if (k === 'left') { if (cols > 1) this.focus(this.index - 1); else if (this.opt.onLR) this.opt.onLR(-1); else return this.opt.modal !== false; }
    else if (k === 'right') { if (cols > 1) this.focus(this.index + 1); else if (this.opt.onLR) this.opt.onLR(1); else return this.opt.modal !== false; }
    else if (k === 'ok') this.select();
    else if (k === 'cancel') { if (this.opt.onCancel) { sfx('cancel'); this.opt.onCancel(); } }
    else if (k === 'menu') { if (this.opt.onMenu) this.opt.onMenu(); else return this.opt.modal !== false; }
    return true;
  }
  setActive(a) { this.active = a; this.el.classList.toggle('inactive', !a); }
  destroy() { input.remove(this.handler); this.el.remove(); }
}

// ─────────────────────────────────────────────────────────────
//  대화창 (타자 효과). 탭/확인으로 넘김
// ─────────────────────────────────────────────────────────────
export function say(name, text, opt = {}) {
  return new Promise(resolve => {
    const w = win('dialog' + (opt.cls ? ' ' + opt.cls : ''));
    const face = opt.face ? `<img class="face" src="${iconURL('face_' + opt.face)}" alt="">` : '';
    w.innerHTML = `${face}<div class="dbody">${name ? `<div class="dname">${esc(name)}</div>` : ''}<div class="dtext"></div></div><div class="dnext">▼</div>`;
    const tx = w.querySelector('.dtext');
    const pages = Array.isArray(text) ? text : [text];
    let page = 0, shown = 0, timer = null, full = '';
    const start = () => {
      full = pages[page]; shown = 0; tx.innerHTML = '';
      w.classList.remove('done');
      clearInterval(timer);
      timer = setInterval(() => {
        shown += 1;
        tx.innerHTML = esc(full.slice(0, shown)).replace(/\n/g, '<br>');
        if (shown % 3 === 0) sfx('text');
        if (shown >= full.length) { clearInterval(timer); w.classList.add('done'); }
      }, 22);
    };
    const advance = () => {
      if (shown < full.length) { shown = full.length; clearInterval(timer); tx.innerHTML = esc(full).replace(/\n/g, '<br>'); w.classList.add('done'); return; }
      page++;
      if (page < pages.length) { sfx('cursor'); start(); return; }
      if (closed) return;
      closed = true; clearInterval(timer);
      input.remove(h); w.remove(); document.removeEventListener('pointerdown', tap, true); resolve();
    };
    const tap = e => { if (e.target.closest('.win') === w || !e.target.closest('.win')) { e.stopPropagation(); e.preventDefault(); advance(); } };
    let closed = false;
    const h = input.push({ onKey: k => { if (k === 'ok' || k === 'cancel') advance(); return true; }, el: w });
    setTimeout(() => { if (!closed) document.addEventListener('pointerdown', tap, true); }, 50);
    start();
  });
}

// 선택지
export function choice(options, opt = {}) {
  return new Promise(resolve => {
    const w = win('choice ' + (opt.cls || ''));
    if (opt.title) w.appendChild(el('div', 'wtitle', opt.title));
    const m = new ListMenu(w, options.map((o, i) => (typeof o === 'string' ? { label: o, data: i } : { ...o, data: i })), {
      onSelect: it => { m.destroy(); w.remove(); resolve(it.data); },
      onCancel: opt.cancel !== undefined ? () => { m.destroy(); w.remove(); resolve(opt.cancel); } : null,
    });
  });
}

let bannerEl = null;
export function banner(text, cls = '') {
  if (bannerEl) bannerEl.remove();
  const b = el('div', 'banner ' + cls, `<span>${text}</span>`);
  root().appendChild(b);
  bannerEl = b;
  setTimeout(() => { if (bannerEl === b) { b.classList.add('out'); setTimeout(() => b.remove(), 300); } }, cls.includes('long') ? 2200 : 1100);
  return b;
}

export function toast(html, dur = 2200) {
  let box = document.querySelector('.toasts');
  if (!box) { box = el('div', 'toasts'); root().appendChild(box); }
  const t = el('div', 'toast win', html);
  box.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, dur);
}

export function fade(on, ms = 350) {
  const f = document.getElementById('fade');
  f.style.transition = `opacity ${ms}ms`;
  f.style.opacity = on ? 1 : 0;
  return new Promise(r => setTimeout(r, ms));
}

// HP/MP 바
export function bar(cur, max, cls) {
  const p = Math.max(0, Math.min(100, cur / max * 100));
  return `<div class="bar ${cls}"><i style="width:${p}%"></i></div>`;
}

export function num(n) { return `<span class="num">${n}</span>`; }
