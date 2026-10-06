// Battle HUD: CTB timeline, command window, party status, enemy gauges,
// targeting, damage popups, banners, tutorial popups, results.
import * as THREE from 'three';
import { ECHOES, ITEMS, SKILLS } from '../data/db.js';
import { assets } from '../engine/assets.js';
import { audio } from '../engine/audio.js';
import { input } from '../engine/input.js';
import { el, icon, portraitURL, sleep, toScreen } from './dom.js';
import { showTutorial } from './tutorial.js';

const ICON_FOR = { phys: 'attack', mag: 'skill', heal: 'heal', buff: 'resonance', revive: 'light' };
const EL_ICON = { fire: 'fire', ice: 'ice', thunder: 'thunder', light: 'light', dark: 'dark' };

export function faceStyle(unit) {
  if (unit.side === 'hero') {
    return `background-image:url(${portraitURL(unit.sprite)});background-size:260%;background-position:50% 30%`;
  }
  const a = assets.atlas[unit.sprite];
  if (!a) return '';
  const fr = a.meta.anims['battle.idle'].frames[0];
  const [x, y, w, h] = fr;
  const [fx, fy, zoom] = unit.data?.face || [0.55, 0.5, 2.0];
  const s = (52 / h) * zoom;
  const cx = x + w * fx, cy = y + h * fy;
  return `background-image:url(./assets/sprites/${a.meta.image});background-size:${a.w * s}px ${a.h * s}px;background-position:${26 - cx * s}px ${26 - cy * s}px;transform:translate(-50%,-50%) rotate(-45deg) scaleX(-1)`;
}

export class BattleUI {
  constructor(scene) {
    this.scene = scene;
    this.root = el('div', 'battle-ui');
    document.getElementById('ui').appendChild(this.root);
    this.timeline = el('div', 'timeline np');
    this.root.appendChild(this.timeline);
    this.partyEl = el('div', 'party np');
    this.root.appendChild(this.partyEl);
    this.gaugeLayer = el('div', 'np');
    this.root.appendChild(this.gaugeLayer);
    this.fxLayer = el('div', 'np');
    this.root.appendChild(this.fxLayer);
    this.footer = el('div', 'footer', `<span class="spd">▶<b>▷▷</b></span><span><span class="k">F</span>배속</span><span><span class="k">H</span>도움말</span>`);
    this.root.appendChild(this.footer);
    this.footer.querySelector('.spd').onclick = () => this.scene.toggleSpeed();
    this.panels = {};
    this.gauges = {};
    this.cmdOpen = false;
  }

  destroy() {
    this.root.remove();
  }

  // ---------------------------------------------------------------- party
  buildParty(heroes) {
    this.partyEl.innerHTML = '';
    for (const h of heroes) {
      const p = el(
        'div',
        'pm panel thin',
        `<div class="nm">${h.name}${h.echo ? `<span class="ech">${ECHOES[h.echo].name}</span>` : ''}</div>
        <div class="row"><span class="lab hp">HP</span><span class="val hpv"></span></div>
        <div class="bar hp"><i class="lag"></i><i class="v"></i></div>
        <div class="row"><span class="lab mp">MP</span><span class="val mpv"></span></div>
        <div class="bar mp"><i class="v"></i></div>
        <div class="bar res"><i class="v"></i></div>`,
      );
      this.partyEl.appendChild(p);
      this.panels[h.id] = p;
    }
    this.updateParty(heroes);
  }

  updateParty(heroes, active = null) {
    for (const h of heroes) {
      const p = this.panels[h.id];
      if (!p) continue;
      const hv = p.querySelector('.hpv');
      hv.textContent = h.hp;
      hv.className = 'val hpv' + (h.hp / h.maxhp < 0.25 ? ' crit' : h.hp / h.maxhp < 0.5 ? ' low' : '');
      p.querySelector('.mpv').textContent = h.mp;
      const hpw = (100 * h.hp) / h.maxhp + '%';
      p.querySelector('.bar.hp .v').style.width = hpw;
      p.querySelector('.bar.hp .lag').style.width = hpw;
      p.querySelector('.bar.mp .v').style.width = (100 * h.mp) / h.maxmp + '%';
      const rb = p.querySelector('.bar.res');
      rb.querySelector('.v').style.width = Math.min(100, h.res) + '%';
      rb.classList.toggle('full', h.res >= 100 && !!h.echo);
      p.classList.toggle('active', active === h);
      p.classList.toggle('ko', !h.alive);
    }
  }

  // ---------------------------------------------------------------- enemy gauges
  buildGauges(enemies) {
    this.gaugeLayer.innerHTML = '';
    for (const e of enemies) {
      const g = el(
        'div',
        'eg' + (e.boss ? ' boss' : ''),
        `${e.letter ? `<div class="letter">${e.letter}</div>` : ''}<div class="bar ehp"><i class="lag"></i><i class="v"></i></div><div class="bar brk"><i class="v"></i></div><div class="brklab"></div>`,
      );
      this.gaugeLayer.appendChild(g);
      this.gauges[e.id] = g;
    }
  }

  updateGauges(enemies, camera) {
    for (const e of enemies) {
      const g = this.gauges[e.id];
      if (!g) continue;
      if (!e.alive && !e.dying) {
        g.style.display = 'none';
        continue;
      }
      const a = this.scene.actors.get(e);
      if (!a) continue;
      const p = toScreen(a.position.clone().add(new THREE.Vector3(0, -0.1, 0.4)), camera);
      g.style.left = p.x + 'px';
      g.style.top = p.y + 8 + 'px';
      const hpw = (100 * e.hp) / e.maxhp + '%';
      g.querySelector('.ehp .v').style.width = hpw;
      g.querySelector('.ehp .lag').style.width = hpw;
      g.querySelector('.brk .v').style.width = (e.broken ? 100 : (100 * e.brk) / e.brkMax) + '%';
      g.querySelector('.brk').classList.toggle('broken', e.broken);
      g.querySelector('.brklab').textContent = e.broken ? 'BREAK' : '';
    }
  }

  // ---------------------------------------------------------------- timeline
  updateTimeline(current, upcoming) {
    const t = this.timeline;
    t.innerHTML = '';
    const cur = el('div', 'tl-cur' + (current.side === 'enemy' ? ' enemy' : ''), `<div class="face" style="${faceStyle(current).replace('scaleX(-1)', 'scaleX(-1)').replace(/translate\(-50%,-50%\) rotate\(-45deg\)/, 'translate(-50%,-50%) rotate(-45deg)')}"></div>`);
    t.appendChild(cur);
    t.appendChild(el('div', 'tl-line'));
    const W = t.clientWidth || 900;
    const n = Math.min(upcoming.length, 11);
    for (let i = 0; i < 12; i++) {
      const node = el('div', 'tl-node');
      node.style.left = 92 + (i * (W - 110)) / 11 + 'px';
      t.appendChild(node);
    }
    for (let i = 0; i < n; i++) {
      const u = upcoming[i];
      const d = el('div', 'tl-unit' + (u.side === 'enemy' ? ' enemy below' : '') + (u.broken ? ' broken' : ''), `<div class="dia"><div class="face" style="${faceStyle(u)}"></div></div>${u.letter ? `<div class="letter">${u.letter}</div>` : ''}`);
      d.style.left = 98 + (i * (W - 110)) / 11 + 'px';
      t.appendChild(d);
    }
  }

  // ---------------------------------------------------------------- banners & popups
  banner(text, enemy = false) {
    this.hideBanner();
    this._banner = el('div', 'banner np' + (enemy ? ' enemy' : ''), text);
    this.root.appendChild(this._banner);
  }
  hideBanner() {
    this._banner?.remove();
    this._banner = null;
  }

  damage(worldPos, camera, value, kind = '', tag = '') {
    const p = toScreen(worldPos, camera);
    const d = el('div', 'dmg ' + kind, `${tag ? `<span class="tag ${kind === 'resist' ? 'res' : ''}">${tag}</span>` : ''}${value}`);
    d.style.left = p.x + (Math.random() - 0.5) * 30 + 'px';
    d.style.top = p.y + 'px';
    this.fxLayer.appendChild(d);
    setTimeout(() => d.remove(), 1200);
  }

  announce(text, sub = '', blue = false, ms = 1600) {
    const s = el('div', 'streak');
    this.fxLayer.appendChild(s);
    const a = el('div', 'announce' + (blue ? ' blue' : ''), `${text}${sub ? `<span class="sub">${sub}</span>` : ''}`);
    this.fxLayer.appendChild(a);
    setTimeout(() => {
      a.remove();
      s.remove();
    }, ms);
    return sleep(ms * 0.8);
  }

  async cutin(hero, echoId, title) {
    const e = ECHOES[echoId];
    const c = el(
      'div',
      'cutin',
      `<div class="band"></div><div class="port hero" style="background-image:url(${portraitURL(hero.sprite, 'angry')})"></div><div class="port echo" style="background-image:url(${portraitURL(e.portrait)})"></div><div class="title"><small>RESONANCE</small>${title}</div>`,
    );
    this.fxLayer.appendChild(c);
    await sleep(2300);
    c.remove();
  }

  tutorial(pages) {
    return showTutorial(pages, this.root);
  }

  // ---------------------------------------------------------------- command menu
  chooseCommand(unit, battle, ctx) {
    return new Promise((resolve) => {
      const echo = unit.echo ? ECHOES[unit.echo] : null;
      const main = [
        { id: 'attack', label: '싸우기', ic: 'attack', desc: SKILLS.attack.desc },
        { id: 'skills', label: '기술', ic: 'skill', desc: '고유 기술을 사용한다.' },
      ];
      if (echo) main.push({ id: 'echo', label: `${echo.name}의 기술`, ic: 'echo', desc: `에코 「${echo.name}」에게서 빌린 기술을 사용한다.` });
      if (echo && unit.res >= 100) main.push({ id: 'resonance', label: `레조넌스: ${echo.resonance.name}`, ic: 'resonance', desc: echo.resonance.desc, reso: true });
      main.push({ id: 'guard', label: '막기', ic: 'guard', desc: '방어 태세를 취해 받는 피해를 절반으로 줄인다.' });
      main.push({ id: 'item', label: '아이템', ic: 'item', desc: '아이템을 사용한다.' });
      main.push({ id: 'escape', label: '도주하기', ic: 'run', desc: battle.troop.noEscape ? '이 전투에서는 도망칠 수 없다.' : '전투에서 도망친다.', dis: !!battle.troop.noEscape || ctx.extra });

      const stack = [];
      let list = main, sel = this._lastSel?.[unit.id] ?? 0, title = '';
      const port = el('div', 'cmd-portrait', `<div class="pimg" style="background-image:url(${portraitURL(unit.sprite, ctx.extra ? 'smile' : 'normal')})"></div><div class="pname">${unit.name}</div><div class="psub">${ctx.extra ? 'EXTRA PHASE' : unit.member.def.title}</div>`);
      const box = el('div', 'cmd panel');
      const tip = el('div', 'tip panel np');
      this.root.append(port, box, tip);

      const render = () => {
        sel = Math.max(0, Math.min(list.length - 1, sel));
        box.innerHTML = (title ? `<div class="cmd-title">${title}</div>` : '') + list.map((it, i) => `<div class="cmd-item${i === sel ? ' sel' : ''}${it.dis ? ' dis' : ''}${it.reso ? ' reso' : ''}" data-i="${i}"><span class="ic">${icon(it.ic)}</span><span>${it.label}</span>${it.mp != null ? `<span class="mp">${it.mpLabel || 'MP'}<b>${it.mp}</b></span>` : ''}</div>`).join('');
        box.querySelectorAll('.cmd-item').forEach((d) => {
          d.onmouseenter = () => {
            const i = +d.dataset.i;
            if (i !== sel) {
              sel = i;
              audio.sfx('cursor');
              render();
            }
          };
          d.onclick = () => {
            sel = +d.dataset.i;
            choose();
          };
        });
        const it = list[sel];
        const row = box.querySelectorAll('.cmd-item')[sel];
        if (it?.desc && row) {
          tip.style.display = 'block';
          const sk = it.skill ? SKILLS[it.skill] : null;
          const bars = sk && sk.type !== 'heal' && sk.type !== 'buff' && sk.type !== 'revive' ? `<div class="bars"><span>위력<span class="pips">${pips(sk.power * (sk.hits || 1), 2.2, 'p')}</span></span><span>브레이크<span class="pips">${pips(sk.brk || 0, 36, 'b')}</span></span>${sk.el ? icon(EL_ICON[sk.el]) : ''}</div>` : '';
          tip.innerHTML = bars + it.desc;
          tip.style.top = box.offsetTop + row.offsetTop - 6 + 'px';
        } else tip.style.display = 'none';
      };

      const close = (val) => {
        off();
        port.remove();
        box.remove();
        tip.remove();
        (this._lastSel ||= {})[unit.id] = stack.length ? stack[0].sel : sel;
        resolve(val);
      };

      const pickTargets = async (spec, kind) => {
        box.style.opacity = '0.4';
        tip.style.display = 'none';
        offInput();
        const t = await this.selectTarget(unit, battle, spec);
        onInput();
        box.style.opacity = '';
        return t;
      };

      const choose = async () => {
        const it = list[sel];
        if (!it || it.dis) {
          audio.sfx('buzz');
          return;
        }
        audio.sfx('ok');
        if (list === main) {
          if (it.id === 'attack') {
            const t = await pickTargets('enemy');
            if (t) close({ kind: 'skill', skill: 'attack', targets: t });
            else render();
          } else if (it.id === 'skills' || it.id === 'echo') {
            const ids = it.id === 'skills' ? unit.skills : unit.echoSkills;
            stack.push({ list, sel, title });
            title = it.id === 'skills' ? '기술' : `${echo.name}의 기술`;
            list = ids.map((id) => {
              const s = SKILLS[id];
              return { id, skill: id, label: s.name, ic: s.el ? EL_ICON[s.el] : ICON_FOR[s.type], mp: s.mp, desc: s.desc, dis: unit.mp < s.mp || (s.type === 'revive' && !battle.heroes.some((h) => h.ko)) };
            });
            sel = 0;
            render();
          } else if (it.id === 'resonance') {
            const r = echo.resonance;
            const t = await pickTargets(r.target);
            if (t) close({ kind: 'resonance', targets: t });
            else render();
          } else if (it.id === 'guard') close({ kind: 'guard', delay: -20 });
          else if (it.id === 'escape') close({ kind: 'escape' });
          else if (it.id === 'item') {
            stack.push({ list, sel, title });
            title = '아이템';
            const inv = battle.game.state.items;
            list = Object.keys(ITEMS)
              .filter((k) => inv[k] > 0)
              .map((k) => ({ id: k, item: k, label: ITEMS[k].name, ic: 'item', mp: inv[k], mpLabel: '×', desc: ITEMS[k].desc, dis: ITEMS[k].type === 'revive' && !battle.heroes.some((h) => h.ko) }));
            if (!list.length) list = [{ id: 'none', label: '아이템이 없다', ic: 'item', dis: true }];
            sel = 0;
            render();
          }
        } else if (it.skill) {
          const s = SKILLS[it.skill];
          const t = await pickTargets(s.target);
          if (t) close({ kind: 'skill', skill: it.skill, targets: t, delay: s.delay });
          else render();
        } else if (it.item) {
          const t = await pickTargets(ITEMS[it.item].target);
          if (t) close({ kind: 'item', item: it.item, targets: t });
          else render();
        }
      };

      const back = () => {
        if (stack.length) {
          audio.sfx('cancel');
          ({ list, sel, title } = stack.pop());
          render();
        }
      };

      const handler = (a) => {
        if (a === 'up') {
          sel = (sel - 1 + list.length) % list.length;
          audio.sfx('cursor');
          render();
        } else if (a === 'down') {
          sel = (sel + 1) % list.length;
          audio.sfx('cursor');
          render();
        } else if (a === 'ok') choose();
        else if (a === 'cancel') back();
      };
      let off = input.on(handler);
      const offInput = () => off();
      const onInput = () => (off = input.on(handler));
      render();
    });
  }

  selectTarget(unit, battle, spec) {
    return new Promise((resolve) => {
      let pool;
      let multi = false;
      if (spec === 'enemy' || spec === 'enemies') pool = battle.enemies.filter((e) => e.alive);
      else if (spec === 'ko') pool = battle.heroes.filter((h) => h.ko);
      else if (spec === 'self') pool = [unit];
      else pool = battle.heroes.filter((h) => h.alive);
      if (spec === 'enemies' || spec === 'allies') multi = true;
      if (!pool.length) return resolve(null);
      let i = spec === 'ally' ? Math.max(0, pool.indexOf(unit)) : 0;
      const cursors = [];
      const label = el('div', 'tname panel np');
      this.root.appendChild(label);
      const draw = () => {
        cursors.forEach((c) => c.remove());
        cursors.length = 0;
        const targets = multi ? pool : [pool[i]];
        for (const t of targets) {
          const c = el('div', 'tcursor np', icon('down', true));
          this.root.appendChild(c);
          c.dataset.id = t.id;
          cursors.push(c);
        }
        label.textContent = multi ? (spec === 'enemies' ? '적 전체' : '아군 전체') : pool[i].name + (pool[i].letter ? ' ' + pool[i].letter : '');
        this.scene.highlight(targets);
      };
      this._cursorTick = () => {
        for (const c of cursors) {
          const u = pool.find((p) => p.id === c.dataset.id);
          const a = u && this.scene.actors.get(u);
          if (!a) continue;
          const p = toScreen(a.position.clone().add(new THREE.Vector3(0, a.headY() + 0.25, 0)), this.scene.camera);
          c.style.left = p.x + 'px';
          c.style.top = p.y + 'px';
        }
      };
      const done = (v) => {
        off();
        cursors.forEach((c) => c.remove());
        label.remove();
        this._cursorTick = null;
        this.scene.highlight([]);
        resolve(v);
      };
      const off = input.on((a) => {
        if (!multi && (a === 'left' || a === 'up' || a === 'right' || a === 'down')) {
          const d = a === 'left' || a === 'up' ? -1 : 1;
          i = (i + d + pool.length) % pool.length;
          audio.sfx('cursor');
          draw();
        } else if (a === 'ok') {
          audio.sfx('ok');
          done(multi ? pool : [pool[i]]);
        } else if (a === 'cancel') {
          audio.sfx('cancel');
          done(null);
        }
      });
      // click on canvas picks the nearest target on screen
      this.scene.onPick = (sx, sy) => {
        let best = -1, bd = 1e9;
        pool.forEach((u, k) => {
          const a = this.scene.actors.get(u);
          const p = toScreen(a.position.clone().add(new THREE.Vector3(0, 0.8, 0)), this.scene.camera);
          const d = Math.hypot(p.x - sx, p.y - sy);
          if (d < bd) {
            bd = d;
            best = k;
          }
        });
        if (best >= 0 && bd < 160) {
          if (!multi && best !== i) {
            i = best;
            draw();
          } else done(multi ? pool : [pool[i]]);
        }
      };
      draw();
    });
  }

  tick() {
    this._cursorTick?.();
  }

  // ---------------------------------------------------------------- results
  results(rew, levelups) {
    return new Promise((res) => {
      const box = el(
        'div',
        'results panel',
        `<h2>VICTORY</h2>
        <div class="rw"><span>획득 경험치</span><span>${rew.exp} EXP</span></div>
        <div class="rw"><span>획득 골드</span><span>${rew.gold} G</span></div>
        <div class="who">${levelups.map((l) => `<div>${l.name}<br>Lv ${l.level}${l.up ? ' <span class="lvup">LEVEL UP!</span>' : ''}</div>`).join('')}</div>
        <div class="pg" style="text-align:right;margin-top:12px;font-size:12px;color:#9fb6d6">계속 ▼</div>`,
      );
      this.root.appendChild(box);
      let ready = false;
      setTimeout(() => (ready = true), 600);
      if (this.scene.game.auto) setTimeout(() => { off(); box.remove(); res(); }, 3000);
      const off = input.on((a) => {
        if (ready && (a === 'ok' || a === 'cancel')) {
          off();
          box.remove();
          res();
        }
      });
      box.onclick = () => {
        if (ready) {
          off();
          box.remove();
          res();
        }
      };
    });
  }
}

function pips(v, max, cls) {
  const n = Math.max(1, Math.min(5, Math.round((v / max) * 5)));
  let s = '';
  for (let i = 0; i < 5; i++) s += `<span class="pip ${i < n ? 'on ' + cls : ''}"></span>`;
  return s;
}
