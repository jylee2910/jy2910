// Dialogue box with portrait + nameplate + typewriter, narration, choices, toasts.
import { audio } from '../engine/audio.js';
import { input } from '../engine/input.js';
import { el, portraitURL, sleep } from './dom.js';

const ui = () => document.getElementById('ui');

export class Dialogue {
  constructor() {
    this.box = null;
    this.auto = false;
  }

  ensure() {
    if (this.box) return;
    this.box = el('div', 'dlg', `<div class="panel box"><span class="txt"></span></div><div class="nameplate"></div><div class="next"></div>`);
    ui().appendChild(this.box);
  }

  close() {
    this.box?.remove();
    this.box = null;
    this.lastPort = null;
  }

  // say(name, text, portrait?, expr?)
  say(name, text, portrait = null, expr = 'normal') {
    this.ensure();
    const b = this.box;
    b.classList.toggle('noport', !portrait);
    b.querySelector('.nameplate').textContent = name || '';
    b.querySelector('.nameplate').style.display = name ? '' : 'none';
    let p = b.querySelector('.portrait');
    const key = portrait ? portrait + expr : null;
    if (portrait) {
      if (!p || this.lastPort !== portrait) {
        p?.remove();
        p = el('div', 'portrait');
        b.prepend(p);
      }
      p.style.backgroundImage = `url(${portraitURL(portrait, expr)})`;
    } else p?.remove();
    this.lastPort = portrait;
    const txt = b.querySelector('.txt');
    const next = b.querySelector('.next');
    next.style.display = 'none';
    return new Promise((res) => {
      let i = 0;
      let done = false;
      const chars = [...text];
      txt.innerHTML = '';
      const timer = setInterval(() => {
        if (i >= chars.length) {
          finish();
          return;
        }
        const c = chars[i++];
        txt.innerHTML += c === '\n' ? '<br>' : c;
        if (i % 3 === 0 && c !== ' ') audio.sfx('cursor');
      }, 28);
      const finish = () => {
        clearInterval(timer);
        txt.innerHTML = text.replace(/\n/g, '<br>');
        done = true;
        next.style.display = '';
      };
      const adv = () => {
        if (!done) finish();
        else {
          off();
          b.onclick = null;
          audio.sfx('ok');
          res();
        }
      };
      const off = input.on((a) => {
        if (a === 'ok' || a === 'cancel') adv();
      });
      b.onclick = adv;
      if (window.game?.auto) setTimeout(() => { finish(); setTimeout(adv, 300); }, 400);
    });
  }

  async narration(lines, hold = 2200) {
    this.close();
    const n = el('div', 'narration', lines.map((l, i) => `<div class="ln" style="animation-delay:${i * 0.9}s">${l}</div>`).join(''));
    ui().appendChild(n);
    await sleep(lines.length * 900 + hold);
    n.style.transition = 'opacity 1s';
    n.style.opacity = '0';
    await sleep(1000);
    n.remove();
  }

  choice(options) {
    this.ensure();
    return new Promise((res) => {
      const c = el('div', 'choices panel');
      let sel = 0;
      const render = () => {
        c.innerHTML = options.map((o, i) => `<div class="cmd-item${i === sel ? ' sel' : ''}" data-i="${i}">${o}</div>`).join('');
        c.querySelectorAll('.cmd-item').forEach((d) => {
          d.onclick = () => {
            sel = +d.dataset.i;
            pick();
          };
        });
      };
      const pick = () => {
        off();
        c.remove();
        audio.sfx('ok');
        res(sel);
      };
      const off = input.on((a) => {
        if (a === 'up' || a === 'down') {
          sel = (sel + (a === 'up' ? -1 : 1) + options.length) % options.length;
          audio.sfx('cursor');
          render();
        } else if (a === 'ok') pick();
      });
      this.box.appendChild(c);
      render();
    });
  }
}

export function toast(html, ms = 3000) {
  const t = el('div', 'toast', html);
  ui().appendChild(t);
  setTimeout(() => t.remove(), ms);
}

export const dialogue = new Dialogue();

export function fade(to, ms = 600, white = false) {
  const f = document.getElementById('fade');
  f.classList.toggle('white', white);
  f.style.transition = `opacity ${ms}ms`;
  f.style.opacity = to;
  return sleep(ms);
}
