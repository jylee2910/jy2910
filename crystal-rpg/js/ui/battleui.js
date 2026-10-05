// 전투 UI: 턴 순서, 파티 상태, 커맨드/어빌리티/아이템 메뉴, 대상 선택, 적 약점 태그, 데미지 팝업
import { el, win, ListMenu, icon, bar, esc, root } from './ui.js';
import { iconURL } from '../art/assets.js';
import { monsterSheet } from '../art/assets.js';
import { ELEMENTS, ELEMENT_ORDER } from '../data/elements.js';
import { CONSUMABLES } from '../data/items.js';
import { input } from '../core/input.js';
import { sfx } from '../core/audio.js';

const SRC_LABEL = { innate: '고유', weapon: '무기', set: '등록' };

function monsterIconURL(design) {
  const sh = monsterSheet(design);
  const m = sh.meta;
  const c = document.createElement('canvas');
  const s = Math.max(m.bodyW, m.bodyH);
  c.width = c.height = s;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  x.drawImage(sh.canvas, (m.frameW - m.bodyW) / 2, m.frameH - m.bodyH, m.bodyW, m.bodyH, (s - m.bodyW) / 2, (s - m.bodyH) / 2, m.bodyW, m.bodyH);
  return c.toDataURL();
}
const monIconCache = {};

export class BattleUI {
  constructor(scene) {
    this.scene = scene;
    this.battle = scene.battle;
    this.layer = el('div', 'battle-ui');
    root().appendChild(this.layer);
    this.tags = el('div', 'etags');
    this.layer.appendChild(this.tags);
    this.order = el('div', 'turn-order');
    this.layer.appendChild(this.order);
    this.help = el('div', 'win help', ''); this.help.hidden = true;
    this.layer.appendChild(this.help);
    this.bottom = el('div', 'battle-bottom');
    this.layer.appendChild(this.bottom);
    this.cmdBox = el('div', 'cmd-area');
    this.bottom.appendChild(this.cmdBox);
    this.status = win('party-status', this.bottom);
    this.pops = el('div', 'pops');
    this.layer.appendChild(this.pops);
    this.speedBtn = el('button', 'speed-btn win', '▶▶ ×1');
    this.speedBtn.onclick = e => { e.stopPropagation(); this.scene.toggleSpeed(); };
    this.layer.appendChild(this.speedBtn);
    this.rows = {};
    this.tagEls = new Map();
    this.buildStatus();
    this.buildTags();
    this.targetCursor = el('img', 'tcursor'); this.targetCursor.src = iconURL('cursor'); this.targetCursor.hidden = true;
    this.layer.appendChild(this.targetCursor);
  }

  setSpeedLabel(x) { this.speedBtn.textContent = x > 1 ? '▶▶ ×2' : '▶ ×1'; }

  buildStatus() {
    this.status.innerHTML = '';
    for (const u of this.battle.party) {
      const r = el('div', 'prow');
      r.innerHTML = `<img class="face" src="${iconURL('face_' + u.id)}"><div class="pn"><b>${esc(u.name)}</b><span class="st"></span></div>
        <div class="pv"><div class="hpn"></div><div class="hpb"></div></div><div class="pv mp"><div class="mpn"></div><div class="mpb"></div></div>`;
      this.status.appendChild(r);
      this.rows[u.id] = r;
      r.addEventListener('click', e => { e.stopPropagation(); this.onRowPick?.(u); });
      this.updateUnit(u, u.hp, u.mp);
    }
  }

  updateUnit(u, hp = u.hp, mp = u.mp) {
    if (u.side !== 'party') { this.updateTag(u); return; }
    const r = this.rows[u.id]; if (!r) return;
    r.querySelector('.hpn').innerHTML = `<small>HP</small> <span class="num${hp < u.maxhp * 0.25 ? ' low' : ''}">${hp}</span><small>/${u.maxhp}</small>`;
    r.querySelector('.hpb').innerHTML = bar(hp, u.maxhp, 'hp');
    r.querySelector('.mpn').innerHTML = `<small>MP</small> <span class="num">${mp}</span>`;
    r.querySelector('.mpb').innerHTML = bar(mp, u.maxmp, 'mp');
    r.classList.toggle('ko', hp <= 0);
    const st = [];
    for (const b of u.buffs) st.push(`<i class="${b.pct > 0 ? 'up' : 'dn'}">${{ atk: '공', def: '방', mag: '마', mdf: '정', spd: '민' }[b.stat]}${b.pct > 0 ? '▲' : '▼'}</i>`);
    if (u.status.poison) st.push('<i class="psn">독</i>');
    if (u.status.regen) st.push('<i class="up">재</i>');
    if (u.provoke) st.push('<i class="prov">도</i>');
    if (u.enchant) st.push(`<i class="ench"><img src="${iconURL(ELEMENTS[u.enchant.elem].icon)}"></i>`);
    if (u.airborne) st.push('<i class="up">空</i>');
    r.querySelector('.st').innerHTML = st.join('');
  }
  setActive(u) { for (const [id, r] of Object.entries(this.rows)) r.classList.toggle('active', u && u.side === 'party' && u.id === id); }

  refreshOrder(current) {
    const list = this.battle.predictOrder(7);
    this.order.innerHTML = '<span class="lbl">순서</span>' + list.map((u, i) => {
      const src = u.side === 'party' ? iconURL('face_' + u.id) : (monIconCache[u.design] ||= monsterIconURL(u.design));
      return `<div class="to ${u.side}${i === 0 ? ' now' : ''}${u.broken ? ' broken' : ''}"><img src="${src}"></div>`;
    }).join('');
  }

  // ── 적 태그 (실드 수 + 약점 아이콘) ──
  buildTags() {
    for (const u of this.battle.enemies) {
      const t = el('div', 'etag');
      this.tags.appendChild(t);
      this.tagEls.set(u, t);
      this.updateTag(u);
    }
  }
  updateTag(u, hp = u.hp) {
    const t = this.tagEls.get(u); if (!t) return;
    if (!u.alive && hp <= 0) { t.classList.add('dead'); return; }
    const known = el => u.revealed.has(el);
    const slots = [...u.weak].map(e => known(e) ? `<img src="${iconURL(ELEMENTS[e].icon)}">` : `<img class="unk" src="${iconURL('unknown')}">`);
    t.innerHTML = `<div class="shield${u.broken ? ' brk' : ''}"><span>${u.broken ? 'BREAK' : u.shield}</span></div><div class="weak">${slots.join('')}</div>
      <div class="ehp">${bar(hp, u.maxhp, 'ehpb')}</div>`;
  }
  positionTags() {
    for (const [u, t] of this.tagEls) {
      const s = this.scene.sprites.get(u); if (!s) continue;
      const p = this.scene.stage.project(s.group.position);
      t.style.transform = `translate(${p.x}px, ${p.y + 4}px) translateX(-50%)`;
    }
    if (this.tgtUnit) {
      const s = this.scene.sprites.get(this.tgtUnit);
      const p = this.scene.stage.project(s.group.position.clone().setY(s.height * 0.92 + 0.1));
      this.targetCursor.style.transform = `translate(${p.x}px, ${p.y}px)`;
    }
  }

  // ── 팝업 ──
  popup(worldPos, text, cls = '') {
    const p = this.scene.stage.project(worldPos);
    const d = el('div', 'pop ' + cls, text);
    d.style.left = p.x + (Math.random() - 0.5) * 16 + 'px'; d.style.top = p.y + 'px';
    this.pops.appendChild(d);
    setTimeout(() => d.remove(), 1300);
  }

  showHelp(html) { this.help.innerHTML = html; this.help.hidden = !html; }

  // ── 커맨드 선택 → Promise<action> ──
  chooseCommand(u) {
    return new Promise(resolve => {
      this.resolveCmd = resolve;
      this.mainMenu(u);
    });
  }
  clearCmd() { if (this.menu) { this.menu.destroy(); this.menu = null; } this.cmdBox.innerHTML = ''; this.showHelp(''); }

  mainMenu(u, index = 0) {
    this.clearCmd();
    const w = win('cmd', this.cmdBox);
    w.appendChild(el('div', 'wtitle', esc(u.name)));
    const items = [
      { label: '공격', data: 'attack' },
      { label: '어빌리티', data: 'ability' },
      { label: '아이템', data: 'item', disabled: !Object.keys(this.scene.game.inv).some(k => CONSUMABLES[k]) },
      { label: '방어', data: 'guard' },
      { label: '도망', data: 'escape', disabled: !!this.battle.opts.noEscape },
    ];
    this.menu = new ListMenu(w, items, {
      index,
      onSelect: it => {
        if (it.data === 'attack') this.pickTarget(u, { id: 'attack', target: 'enemy', name: '공격' }, t => this.done({ type: 'attack', target: t }), () => this.mainMenu(u, 0));
        else if (it.data === 'ability') this.abilityMenu(u);
        else if (it.data === 'item') this.itemMenu(u);
        else if (it.data === 'guard') this.done({ type: 'guard' });
        else if (it.data === 'escape') this.done({ type: 'escape' });
      },
      onFocus: it => this.showHelp({ attack: '장착 무기로 공격한다.', ability: '어빌리티를 사용한다.', item: '아이템을 사용한다.', guard: '받는 피해를 절반으로 줄이고 MP를 조금 회복. 다음 차례가 빨라진다.', escape: '전투에서 도망친다.' }[it.data]),
    });
  }

  abilityMenu(u, index = 0) {
    this.clearCmd();
    const w = win('cmd abil', this.cmdBox);
    w.appendChild(el('div', 'wtitle', '어빌리티'));
    const cmds = this.battle.commandsFor(u);
    if (!cmds.length) { w.appendChild(el('div', 'empty', '사용할 수 있는 어빌리티가 없다')); }
    const items = cmds.map(c => ({
      label: esc(c.ab.name), right: c.cost ? `${c.cost}` : '-', icon: c.ab.elem ? ELEMENTS[c.ab.elem].icon : (c.ab.type === 'heal' ? 'heart' : 'active'),
      disabled: !c.usable, data: c, cls: 'src-' + c.ab.source,
    }));
    this.menu = new ListMenu(w, items, {
      index,
      onSelect: it => this.pickTarget(u, it.data.ab, t => this.done({ type: 'ability', ab: it.data.ab, target: t }), () => this.abilityMenu(u, this.menu?.index || 0)),
      onCancel: () => this.mainMenu(u, 1),
      onFocus: it => this.showHelp(`<b>${esc(it.data.ab.name)}</b> <span class="tagsrc ${it.data.ab.source}">${SRC_LABEL[it.data.ab.source]}</span> <span class="mpc">MP ${it.data.cost}</span><br>${esc(it.data.ab.desc || '')}`),
    });
    if (!items.length) this.menu.handler.onKey = k => { if (k === 'cancel') { sfx('cancel'); this.mainMenu(u, 1); } return true; };
  }

  itemMenu(u, index = 0) {
    this.clearCmd();
    const w = win('cmd abil', this.cmdBox);
    w.appendChild(el('div', 'wtitle', '아이템'));
    const inv = this.scene.game.inv;
    const items = Object.keys(inv).filter(k => CONSUMABLES[k]).map(k => ({ label: CONSUMABLES[k].name, right: '×' + inv[k], icon: CONSUMABLES[k].icon, data: k }));
    this.menu = new ListMenu(w, items, {
      index,
      onSelect: it => {
        const ci = CONSUMABLES[it.data];
        this.pickTarget(u, { id: 'item', target: ci.target, name: ci.name }, t => this.done({ type: 'item', item: it.data, target: t }), () => this.itemMenu(u, this.menu?.index || 0));
      },
      onCancel: () => this.mainMenu(u, 2),
      onFocus: it => this.showHelp(`<b>${CONSUMABLES[it.data].name}</b><br>${CONSUMABLES[it.data].desc}`),
    });
  }

  done(action) {
    this.clearCmd();
    const r = this.resolveCmd; this.resolveCmd = null;
    r?.(action);
  }

  // ── 대상 선택 ──
  pickTarget(u, ab, ok, back) {
    const b = this.battle;
    let pool;
    if (ab.target === 'enemy' || ab.target === 'enemies') pool = b.foes(u).filter(t => !t.airborne);
    else if (ab.target === 'ally' || ab.target === 'allies') pool = b.friends(u);
    else if (ab.target === 'allyKO') pool = b.units.filter(x => x.side === 'party' && !x.alive);
    else if (ab.target === 'self') { ok(u); return; }
    if (!pool.length) { sfx('buzz'); return; }
    const all = ab.target === 'enemies' || ab.target === 'allies';
    const prevMenu = this.menu;
    if (prevMenu) prevMenu.setActive(false);
    let i = this.lastTarget && pool.includes(this.lastTarget) ? pool.indexOf(this.lastTarget) : 0;
    // 대상 목록 창: 이름 + HP, 탭 한 번으로 결정
    const panel = win('cmd target-panel', this.cmdBox);
    panel.appendChild(el('div', 'wtitle', `${esc(ab.name)} — 대상 선택`));
    const items = all ? [{ label: `<b>${pool[0].side === 'enemy' ? '적 전체' : '아군 전체'}</b> (${pool.length})`, data: -1 }]
      : pool.map((t, k) => ({ label: `<b>${esc(t.name)}</b>`, right: t.side === 'enemy' ? '' : `HP ${t.hp}/${t.maxhp}`, data: k,
        iconURL: t.side === 'party' ? iconURL('face_' + t.id) : null, icon: t.side === 'party' ? 'x' : (t.broken ? 'star' : null) }));
    let done = false;
    const show = () => {
      this.tgtUnit = all ? null : pool[i];
      this.targetCursor.hidden = all;
      this.scene.highlight(all ? pool : [pool[i]]);
      for (const [id, r] of Object.entries(this.rows)) r.classList.toggle('targeted', (all ? pool : [pool[i]]).some(t => t.side === 'party' && t.id === id));
      const t = pool[i];
      const info = t.side === 'enemy' ? this.enemyInfo(t) : `${esc(t.name)}  HP ${t.hp}/${t.maxhp}`;
      this.showHelp(all ? `<b>${esc(ab.name)}</b> → 전체` : `<b>${esc(ab.name)}</b> → ${info}`);
      this.positionTags();
    };
    const finish = target => {
      if (done) return; done = true;
      menu.destroy(); panel.remove(); this.scene.onPick = null; this.onRowPick = null;
      for (const r of Object.values(this.rows)) r.classList.remove('targeted', 'pickable');
      this.targetCursor.hidden = true; this.tgtUnit = null; this.scene.highlight([]);
      if (prevMenu) prevMenu.setActive(true);
      if (target) { this.lastTarget = target; ok(target); } else { sfx('cancel'); back(); }
    };
    const menu = new ListMenu(panel, items, {
      index: all ? 0 : i, cls: 'big',
      onFocus: it => { if (it.data >= 0) i = it.data; show(); },
      onSelect: it => finish(all ? pool[0] : pool[it.data]),
      onCancel: () => finish(null),
    });
    this.menu = menu;
    // 스프라이트 탭: 다른 대상이면 선택, 같은 대상이면 결정
    this.scene.onPick = unit => {
      if (!unit) return;
      const k = pool.indexOf(unit);
      if (k < 0) return;
      if (all || k === i) { sfx('ok'); finish(pool[i]); } else { i = k; menu.focus(k); }
    };
    // 파티 상태창 행 탭
    for (const [id, r] of Object.entries(this.rows)) r.classList.toggle('pickable', pool.some(t => t.side === 'party' && t.id === id));
    this.onRowPick = unit => { const k = pool.indexOf(unit); if (k < 0) return; if (all || k === i) { sfx('ok'); finish(pool[i]); } else { i = k; menu.focus(k); } };
    const back2 = el('button', 'win back-btn', '◀ 취소'); back2.onclick = e => { e.stopPropagation(); finish(null); };
    panel.appendChild(back2);
    show();
  }

  enemyInfo(t) {
    const rev = ELEMENT_ORDER.filter(e => t.revealed.has(e));
    const w = rev.filter(e => t.weak.includes(e)), r = rev.filter(e => t.resist.includes(e)), a = rev.filter(e => t.absorb.includes(e));
    const ic = arr => arr.map(e => `<img class="ic" src="${iconURL(ELEMENTS[e].icon)}">`).join('');
    const unknown = t.weak.length - w.length;
    return `${esc(t.name)} <span class="wk">약점 ${ic(w)}${'<img class="ic" src="' + iconURL('unknown') + '">'.repeat(unknown)}</span>` +
      (r.length ? ` <span class="rs">내성 ${ic(r)}</span>` : '') + (a.length ? ` <span class="ab">흡수 ${ic(a)}</span>` : '');
  }

  destroy() { this.clearCmd(); this.layer.remove(); }
}
