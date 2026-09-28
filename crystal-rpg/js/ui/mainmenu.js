// 메인 메뉴: 파티 / 장비 / 어빌리티 / 아이템 / 퀘스트 / 저장 / 설정
import { el, win, ListMenu, root, esc, bar, toast, icon, choice } from './ui.js';
import { iconURL, weaponIconURL } from '../art/assets.js';
import { G, saveGame, addItem } from '../core/state.js';
import { CHARACTERS, PARTY_SIZE } from '../data/characters.js';
import { ABILITIES } from '../data/abilities.js';
import { WEAPONS, ARMORS, ACCESSORIES, CONSUMABLES, KEY_ITEMS, itemInfo } from '../data/items.js';
import { ELEMENTS, STAT_SHORT, WEAPON_TYPES } from '../data/elements.js';
import { QUESTS } from '../data/quests.js';
import * as P from '../sys/party.js';
import * as Q from '../sys/quests.js';
import { sfx, audioSettings, applyVolumes } from '../core/audio.js';
import { input } from '../core/input.js';

const STATS = ['atk', 'def', 'mag', 'mdf', 'spd', 'luk'];
const fmtTime = s => { s = Math.floor(s); return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

function abIcon(a) {
  if (a.kind === 'passive') return 'passive';
  if (a.elem) return ELEMENTS[a.elem].icon;
  return a.type === 'heal' ? 'heart' : 'active';
}
function pips(n, cls = '') { return `<span class="pips ${cls}">${'◆'.repeat(n)}</span>`; }

export function openMenu(app, onClose) {
  const m = new MainMenu(app, onClose);
  m.open();
  return m;
}

class MainMenu {
  constructor(app, onClose) { this.app = app; this.onClose = onClose; this.ci = 0; }

  open() {
    const r = this.root = el('div', 'mm');
    root().appendChild(r);
    this.nav = win('mm-nav', r);
    this.body = win('mm-body', r);
    this.foot = win('mm-foot', r);
    this.renderFoot();
    const items = [
      { label: '파티', data: 'party' }, { label: '장비', data: 'equip' }, { label: '어빌리티', data: 'ability' },
      { label: '아이템', data: 'items' }, { label: '퀘스트', data: 'quests' }, { label: '저장', data: 'save' },
      { label: '설정', data: 'settings' }, { label: '닫기', data: 'close' },
    ];
    this.navMenu = new ListMenu(this.nav, items, {
      onSelect: it => this.go(it.data),
      onCancel: () => this.close(),
      onMenu: () => this.close(),
      onFocus: it => { if (!this.section) this.home(); },
    });
    this.home();
  }

  close() {
    this.clearSection();
    this.navMenu.destroy();
    this.root.remove();
    this.onClose?.();
  }

  renderFoot() { this.foot.innerHTML = `${icon('gold')} <span class="num">${G.s.gold} G</span><span class="pt">플레이 <span class="num">${fmtTime(G.s.playTime)}</span></span>`; }

  clearSection() {
    for (const m of this.menus || []) m.destroy();
    this.menus = [];
    this.section = null;
    this.body.innerHTML = '';
  }

  back() {
    this.clearSection();
    this.navMenu.setActive(true);
    input.remove(this.navMenu.handler); input.push(this.navMenu.handler);
    this.home();
  }

  enterSection(name) {
    this.clearSection();
    this.section = name;
    this.navMenu.setActive(false);
  }

  go(what) {
    if (what === 'close') return this.close();
    if (what === 'save') { const ok = saveGame(); sfx(ok ? 'save' : 'buzz'); toast(ok ? `${icon('star')} 여정을 기록했다.` : '저장할 수 없는 환경이다.'); return; }
    this.enterSection(what);
    this[what]();
  }

  // 파티 요약 카드 (홈)
  home() {
    this.body.innerHTML = '';
    const wrap = el('div', 'cards');
    for (const id of G.s.party) wrap.appendChild(this.card(id));
    this.body.appendChild(el('div', 'wtitle', '파티'));
    this.body.appendChild(wrap);
    const reserve = Object.keys(G.s.roster).filter(id => !G.s.party.includes(id));
    if (reserve.length) {
      this.body.appendChild(el('div', 'wtitle sub', '대기'));
      const w2 = el('div', 'cards small'); for (const id of reserve) w2.appendChild(this.card(id)); this.body.appendChild(w2);
    }
  }
  card(id) {
    const cs = G.s.roster[id], d = CHARACTERS[id], st = P.getStats(cs);
    const c = el('div', 'card');
    c.innerHTML = `<img class="face" src="${iconURL('face_' + id)}"><div class="ci"><div><b>${d.name}</b> <span class="job">${d.job}</span> <span class="lv">Lv <span class="num">${cs.lv}</span></span></div>
      <div class="hpmp"><span>HP <span class="num">${cs.hp}/${st.hp}</span></span>${bar(cs.hp, st.hp, 'hp')}<span>MP <span class="num">${cs.mp}/${st.mp}</span></span>${bar(cs.mp, st.mp, 'mp')}</div></div>`;
    return c;
  }

  // 캐릭터 탭 (좌우 키/탭으로 전환)
  charTabs(list, onChange) {
    const t = el('div', 'ctabs');
    list.forEach((id, i) => {
      const b = el('button', 'ctab' + (i === this.ci ? ' on' : ''), `<img src="${iconURL('face_' + id)}"><span>${CHARACTERS[id].name}</span>`);
      b.onclick = e => { e.stopPropagation(); this.ci = i; sfx('cursor'); onChange(); };
      t.appendChild(b);
    });
    t.appendChild(el('span', 'lrhint', '◀ ▶ 캐릭터 변경'));
    return t;
  }
  lr(list, render) { return d => { this.ci = (this.ci + d + list.length) % list.length; sfx('cursor'); render(); }; }

  statTable(cs, cmp) {
    const st = P.getStats(cs);
    return `<div class="stats">${['hp', 'mp', ...STATS].map(k => {
      const v = st[k], n = cmp ? cmp[k] : v, diff = n - v;
      return `<div class="sr"><span>${STAT_SHORT[k]}</span><b class="num">${v}</b>${cmp ? `<i class="num ${diff > 0 ? 'up' : diff < 0 ? 'dn' : ''}">${diff ? '→ ' + n : ''}</i>` : ''}</div>`;
    }).join('')}</div>`;
  }

  // ── 파티 ──
  party(focus = 0) {
    this.clearSection(); this.section = 'party';
    const ids = Object.keys(G.s.roster).sort((a, b) => (G.s.party.includes(a) ? G.s.party.indexOf(a) : 9) - (G.s.party.includes(b) ? G.s.party.indexOf(b) : 9));
    this.body.appendChild(el('div', 'wtitle', '파티 편성 <small>두 명을 차례로 골라 자리를 바꾼다 (최대 3명 출전)</small>'));
    const grid = el('div', 'split'); this.body.appendChild(grid);
    const left = el('div', 'col'), right = el('div', 'col detail'); grid.append(left, right);
    let picked = null;
    const items = ids.map(id => {
      const cs = G.s.roster[id], inP = G.s.party.includes(id);
      return { label: `${CHARACTERS[id].name} <small>${CHARACTERS[id].job}</small>`, right: inP ? `출전 ${G.s.party.indexOf(id) + 1}` : '대기', iconURL: iconURL('face_' + id), icon: 'x', data: id, cls: inP ? 'inparty' : 'reserve', tapFocus: true };
    });
    const m = new ListMenu(left, items, {
      index: focus,
      onFocus: it => {
        const id = it.data, cs = G.s.roster[id], d = CHARACTERS[id];
        right.innerHTML = `<div class="dh"><img class="face big" src="${iconURL('face_' + id)}"><div><b>${d.name}</b> · ${d.job} · Lv ${cs.lv}<div class="bio">${esc(d.bio)}</div>
          <div class="wt">장착 가능: ${d.weapons.map(w => `<img class="ic" src="${weaponIconURL(w)}">${WEAPON_TYPES[w].name}`).join(' ')}</div></div></div>
          ${this.statTable(cs)}<div class="exp">다음 레벨까지 <span class="num">${Math.max(0, expNeed(cs))}</span> EXP</div>`;
      },
      onSelect: it => {
        if (!picked) { picked = it.data; m.nodes[m.index].classList.add('picked'); return; }
        const a = picked, b = it.data; picked = null;
        if (a !== b) {
          const pa = G.s.party.indexOf(a), pb = G.s.party.indexOf(b);
          if (pa >= 0 && pb >= 0) { G.s.party[pa] = b; G.s.party[pb] = a; }
          else if (pa >= 0) G.s.party[pa] = b;
          else if (pb >= 0) G.s.party[pb] = a;
          sfx('ok');
        }
        m.destroy(); this.party(ids.indexOf(b));
      },
      onCancel: () => { if (picked) { picked = null; m.nodes.forEach(n => n.classList.remove('picked')); } else this.back(); },
    });
    this.menus.push(m);
  }

  // ── 장비 ──
  equip(slotIdx = 0) {
    this.clearSection(); this.section = 'equip';
    const list = Object.keys(G.s.roster);
    this.ci = Math.min(this.ci, list.length - 1);
    const id = list[this.ci], cs = G.s.roster[id];
    const render = () => this.equip(0);
    this.body.appendChild(this.charTabs(list, render));
    const grid = el('div', 'split'); this.body.appendChild(grid);
    const left = el('div', 'col'), right = el('div', 'col detail'); grid.append(left, right);
    const slotName = { weapon: '무기', armor: '방어구', acc: '장신구' };
    const slotItems = ['weapon', 'armor', 'acc'].map(s => {
      const itId = cs.equip[s], info = itId && itemInfo(itId);
      return { label: `<small class="slot">${slotName[s]}</small> ${info ? esc(info.name) : '<span class="none">— 없음 —</span>'}`, data: s,
        iconURL: s === 'weapon' && info ? weaponIconURL(info.type, info.tint) : iconURL(s === 'armor' ? 'armor' : 'ring'), icon: 'x' };
    });
    const showCur = () => { right.innerHTML = this.statTable(cs) + this.weaponInfo(cs, cs.equip.weapon); };
    const m = new ListMenu(left, slotItems, {
      index: slotIdx,
      onLR: this.lr(list, render),
      onFocus: showCur,
      onSelect: it => (m.setActive(false), this.pickEquip(cs, it.data, left, right, () => { m.destroy(); this.menus = this.menus.filter(x => x !== m); this.equip(['weapon', 'armor', 'acc'].indexOf(it.data)); })),
      onCancel: () => this.back(),
    });
    this.menus.push(m);
  }

  weaponInfo(cs, wid) {
    if (!wid || !WEAPONS[wid]) return '';
    const w = WEAPONS[wid];
    return `<div class="winfo"><div class="wh"><img class="ic" src="${weaponIconURL(w.type, w.tint)}"> <b>${esc(w.name)}</b> <small>${WEAPON_TYPES[w.type].name}</small></div>
      <div class="wdesc">${esc(w.desc || '')}</div><div class="wab">${P.weaponMastery(cs, wid).map(x => apRow(x)).join('')}</div></div>`;
  }

  pickEquip(cs, slot, left, right, done) {
    const inv = G.s.inv;
    const table = slot === 'weapon' ? WEAPONS : slot === 'armor' ? ARMORS : ACCESSORIES;
    const opts = Object.keys(inv).filter(k => table[k] && P.canEquip(cs, k));
    const items = opts.map(k => {
      const info = itemInfo(k);
      return { label: esc(info.name), right: inv[k] > 1 ? '×' + inv[k] : '', data: k, iconURL: slot === 'weapon' ? weaponIconURL(info.type, info.tint) : iconURL(slot === 'armor' ? 'armor' : 'ring'), icon: 'x', tapFocus: true };
    });
    if (slot !== 'weapon' && cs.equip[slot]) items.push({ label: '장비 해제', data: null });
    const box = win('pick', this.body);
    box.appendChild(el('div', 'wtitle', '장착할 것을 고른다'));
    if (!items.length) box.appendChild(el('div', 'empty', '장착할 수 있는 장비가 없다'));
    const m = new ListMenu(box, items, {
      onFocus: it => {
        if (!it.data) { right.innerHTML = this.statTable(cs); return; }
        const pv = P.previewEquip(cs, it.data);
        right.innerHTML = this.statTable(cs, pv.after) + this.weaponInfo(cs, it.data);
      },
      onSelect: it => {
        if (it.data) P.equipItem(cs, inv, it.data); else P.unequip(cs, inv, slot);
        sfx('ok'); m.destroy(); box.remove(); done();
      },
      onCancel: () => { m.destroy(); box.remove(); done(); },
    });
    if (!items.length) m.handler.onKey = k => { if (k === 'cancel' || k === 'ok') { sfx('cancel'); m.destroy(); box.remove(); done(); } return true; };
    box.addEventListener('click', e => e.stopPropagation());
  }

  // ── 어빌리티 ──
  ability(focus = 0) {
    this.clearSection(); this.section = 'ability';
    const list = Object.keys(G.s.roster);
    this.ci = Math.min(this.ci, list.length - 1);
    const id = list[this.ci], cs = G.s.roster[id], d = CHARACTERS[id];
    const render = () => this.ability(0);
    this.body.appendChild(this.charTabs(list, render));
    const lo = P.activeLoadout(cs);
    const cap = P.capacity(cs), used = P.costUsed(cs);
    const head = el('div', 'abhead');
    const w = P.weaponOf(cs);
    head.innerHTML = `<div class="cost">코스트 <span class="pipbar">${'<i class="u"></i>'.repeat(used)}${'<i></i>'.repeat(Math.max(0, cap - used))}</span> <span class="num">${used}/${cap}</span></div>
      <div class="curw">${w ? `<img class="ic" src="${weaponIconURL(w.type, w.tint)}"> ${esc(w.name)}` : ''}</div>`;
    this.body.appendChild(head);
    const grid = el('div', 'split ab'); this.body.appendChild(grid);
    const left = el('div', 'col list'), right = el('div', 'col detail'); grid.append(left, right);

    const items = [];
    const H = t => items.push({ header: true, label: t });
    H('고유 어빌리티 <small>항상 사용</small>');
    for (const aid of d.innate) items.push({ label: esc(ABILITIES[aid].name), icon: abIcon(ABILITIES[aid]), right: '<span class="tg innate">고유</span>', data: { aid, kind: 'innate' }, tapFocus: true });
    if (w) {
      H(`무기 부여 — ${esc(w.name)} <small>장착 중 사용 · 전투로 숙련</small>`);
      for (const x of P.weaponMastery(cs, cs.equip.weapon)) {
        items.push({ label: esc(x.ab.name), icon: abIcon(x.ab), cls: x.learned ? 'learned' : 'training',
          right: x.learned ? '<span class="tg ok">습득</span>' : `<span class="apmini"><i style="width:${Math.round(x.ap / x.ab.ap * 100)}%"></i></span><span class="num">${x.ap}/${x.ab.ap}</span>`,
          data: { aid: x.id, kind: 'weapon' }, tapFocus: true });
      }
    }
    H(`습득한 어빌리티 <small>선택해서 등록/해제</small>`);
    const learned = cs.learned.slice().sort((a, b) => (ABILITIES[a].kind > ABILITIES[b].kind ? 1 : -1));
    if (!learned.length) items.push({ label: '<span class="none">아직 없다 — 무기 숙련을 채우면 익힌다</span>', data: null, disabled: true });
    for (const aid of learned) {
      const a = ABILITIES[aid], on = cs.set.includes(aid), viaW = P.weaponAbilities(cs).includes(aid);
      const can = on || P.canRegister(cs, aid).ok;
      items.push({ label: `<span class="chk ${on ? 'on' : ''}">${on ? '●' : '○'}</span> ${esc(a.name)}${viaW && !on ? ' <small class="vw">⚔사용 중</small>' : ''}`, icon: abIcon(a),
        right: pips(a.cost, on ? 'on' : can ? '' : 'over'), data: { aid, kind: 'learned' }, cls: on ? 'reg' : can ? '' : 'over', tapFocus: true });
    }
    // 보유 무기로 배울 수 있는 것
    const owned = [...new Set([...Object.keys(G.s.inv).filter(k => WEAPONS[k]), ...Object.values(G.s.roster).map(c => c.equip.weapon)])].filter(k => k && k !== cs.equip.weapon && P.canEquip(cs, k));
    const todo = owned.flatMap(k => WEAPONS[k].abilities.filter(a => !cs.learned.includes(a)).map(a => ({ k, a })));
    if (todo.length) {
      H('보유 무기로 배울 수 있는 어빌리티');
      for (const { k, a } of todo) items.push({ label: `${esc(ABILITIES[a].name)} <small class="vw">${esc(WEAPONS[k].name)}</small>`, icon: abIcon(ABILITIES[a]), right: `<span class="num">${cs.ap[a] || 0}/${ABILITIES[a].ap}</span>`, data: { aid: a, kind: 'other', wid: k }, cls: 'other', tapFocus: true });
    }
    // 공명
    const rel = P.relatedSynergies(cs);
    if (rel.length) {
      H('공명 <small>필요 어빌리티가 모두 활성이면 발동</small>');
      for (const s of rel) {
        const on = lo.synergies.some(x => x.id === s.id);
        items.push({ label: `${on ? '✦' : '✧'} ${esc(s.name)}`, right: s.needs.map(n => `<span class="need ${lo.src.has(n) ? 'ok' : ''}">${esc(ABILITIES[n].name)}</span>`).join(''), data: { syn: s }, cls: 'syn' + (on ? ' on' : ''), tapFocus: true });
      }
    }

    const m = new ListMenu(left, items, {
      index: focus,
      onLR: this.lr(list, render),
      onFocus: it => { right.innerHTML = this.abDetail(cs, it.data, lo); },
      onSelect: it => {
        const dd = it.data;
        if (!dd || dd.syn) return;
        if (dd.kind !== 'learned') { sfx('buzz'); right.innerHTML = this.abDetail(cs, dd, lo, dd.kind === 'innate' ? '고유 어빌리티는 항상 활성이다.' : dd.kind === 'weapon' ? '무기를 장착한 동안에는 자동으로 사용할 수 있다. 숙련을 채우면 습득한다.' : '해당 무기를 장착하고 싸워서 숙련하자.'); return; }
        const before = new Set(lo.synergies.map(s => s.id));
        if (!P.toggleRegister(cs, dd.aid)) { sfx('buzz'); right.innerHTML = this.abDetail(cs, dd, lo, '코스트가 부족하다! 다른 어빌리티를 해제하거나 레벨을 올리자.'); return; }
        const after = P.activeLoadout(cs).synergies.filter(s => !before.has(s.id));
        if (after.length) { sfx('learn'); toast(`✦ 공명 발동: <b>${after.map(s => s.name).join(', ')}</b>`); }
        const idx = m.index; m.destroy(); this.menus = []; this.ability(idx);
      },
      onCancel: () => this.back(),
    });
    this.menus.push(m);
  }

  abDetail(cs, dd, lo, note = '') {
    if (!dd) return '';
    if (dd.syn) {
      const s = dd.syn;
      return `<div class="abd"><div class="abn">✦ ${esc(s.name)}</div><div class="abdesc">${esc(s.desc)}</div><div class="needs">필요: ${s.needs.map(n => `<span class="need ${lo.src.has(n) ? 'ok' : ''}">${lo.src.has(n) ? '✓' : '·'} ${esc(ABILITIES[n].name)}</span>`).join(' ')}</div></div>`;
    }
    const a = ABILITIES[dd.aid];
    const where = Object.entries(WEAPONS).filter(([, w]) => w.abilities.includes(dd.aid)).map(([, w]) => w.name);
    const prev = dd.kind === 'learned' && !cs.set.includes(dd.aid) ? P.synergyPreview(cs, dd.aid) : [];
    const syns = (P.relatedSynergies(cs).filter(s => s.needs.includes(dd.aid)));
    return `<div class="abd"><div class="abn"><img class="ic" src="${iconURL(abIcon(a))}"> ${esc(a.name)} <span class="tg ${a.kind}">${a.kind === 'active' ? '액티브' : '패시브'}</span></div>
      <div class="abmeta">${a.innate ? '고유' : `코스트 ${pips(a.cost, 'on')}`}${a.mp ? ` · MP ${a.mp}` : ''}${a.elem ? ` · <img class="ic" src="${iconURL(ELEMENTS[a.elem].icon)}">${ELEMENTS[a.elem].name}` : ''}${a.ap ? ` · 숙련 ${a.ap} AP` : ''}</div>
      <div class="abdesc">${esc(a.desc)}</div>
      ${where.length ? `<div class="from">익힐 수 있는 무기: ${where.map(esc).join(', ')}</div>` : ''}
      ${syns.length ? `<div class="from">공명: ${syns.map(s => `<b>${esc(s.name)}</b>`).join(', ')}</div>` : ''}
      ${prev.length ? `<div class="hint">등록하면 공명 발동 → <b>${prev.map(s => esc(s.name)).join(', ')}</b></div>` : ''}
      ${note ? `<div class="note">${esc(note)}</div>` : ''}</div>`;
  }

  // ── 아이템 ──
  items(focus = 0) {
    this.clearSection(); this.section = 'items';
    const inv = G.s.inv;
    const grid = el('div', 'split'); this.body.appendChild(grid);
    const left = el('div', 'col'), right = el('div', 'col detail'); grid.append(left, right);
    const ids = Object.keys(inv).sort((a, b) => (itemInfo(a)?.cat || '').localeCompare(itemInfo(b)?.cat || ''));
    const catName = { item: '소모품', key: '중요', weapon: '무기', armor: '방어구', acc: '장신구' };
    const items = ids.map(k => {
      const info = itemInfo(k);
      return { label: esc(info.name), right: '×' + inv[k], data: k, iconURL: info.cat === 'weapon' ? weaponIconURL(info.type, info.tint) : iconURL(info.icon || (info.cat === 'armor' ? 'armor' : 'ring')), icon: 'x', sub: '', tapFocus: true, cls: 'cat-' + info.cat };
    });
    if (!items.length) left.appendChild(el('div', 'empty', '아무것도 없다'));
    const m = new ListMenu(left, items, {
      index: focus,
      onFocus: it => {
        const info = itemInfo(it.data);
        right.innerHTML = `<div class="abd"><div class="abn">${esc(info.name)} <span class="tg">${catName[info.cat]}</span></div><div class="abdesc">${esc(info.desc || '')}</div>
          ${info.stats ? `<div class="from">${Object.entries(info.stats).map(([k, v]) => `${STAT_SHORT[k]} ${v > 0 ? '+' : ''}${v}`).join(' · ')}</div>` : ''}
          ${info.cat === 'weapon' ? `<div class="from">어빌리티: ${info.abilities.map(a => esc(ABILITIES[a].name)).join(', ')}</div>` : ''}</div>`;
      },
      onSelect: async it => {
        const info = itemInfo(it.data);
        if (info.cat !== 'item') { sfx('buzz'); return; }
        m.setActive(false);
        const who = await choice(G.s.party.map(id => { const cs = G.s.roster[id], st = P.getStats(cs); return { label: `${CHARACTERS[id].name}  HP ${cs.hp}/${st.hp}  MP ${cs.mp}/${st.mp}` }; }).concat([{ label: '그만둔다' }]), { title: `${info.name}을(를) 누구에게?` });
        m.setActive(true);
        if (who < G.s.party.length) {
          const cs = G.s.roster[G.s.party[who]], st = P.getStats(cs), ef = info.effect;
          let used = false;
          if (ef.revive && cs.hp <= 0) { cs.hp = Math.max(1, Math.floor(st.hp * ef.revive / 100)); used = true; }
          else if (cs.hp > 0) {
            if (ef.hp && cs.hp < st.hp) { cs.hp = Math.min(st.hp, cs.hp + ef.hp); used = true; }
            if (ef.mp && cs.mp < st.mp) { cs.mp = Math.min(st.mp, cs.mp + ef.mp); used = true; }
            if (ef.cure) used = true;
          }
          if (used) { addItem(it.data, -1); sfx('heal'); toast(`${CHARACTERS[G.s.party[who]].name}에게 ${info.name}을(를) 사용했다.`); }
          else sfx('buzz');
        }
        const idx = m.index; m.destroy(); this.menus = []; this.items(Math.min(idx, Object.keys(G.s.inv).length - 1));
      },
      onCancel: () => this.back(),
    });
    if (!items.length) m.handler.onKey = k => { if (k === 'cancel') { sfx('cancel'); this.back(); } return true; };
    this.menus.push(m);
  }

  // ── 퀘스트 ──
  quests() {
    const grid = el('div', 'split'); this.body.appendChild(grid);
    const left = el('div', 'col'), right = el('div', 'col detail'); grid.append(left, right);
    const ids = Q.activeQuests();
    const label = { active: '진행 중', complete: '보고 가능', done: '완료' };
    const items = ids.map(id => { const q = QUESTS[id], st = Q.qstate(id), p = Q.progress(id); return { label: `${q.main ? '<span class="main">★</span> ' : ''}${esc(q.name)}`, right: `<span class="qs ${st}">${label[st]}</span>`, data: id, cls: 'q-' + st, tapFocus: true }; });
    if (!items.length) left.appendChild(el('div', 'empty', '받은 퀘스트가 없다. 마을 사람들과 이야기해 보자.'));
    const m = new ListMenu(left, items, {
      onFocus: it => {
        const q = QUESTS[it.data], p = Q.progress(it.data);
        const rw = [q.reward.gold ? q.reward.gold + ' G' : '', ...Object.entries(q.reward.items || {}).map(([k, n]) => itemInfo(k).name + (n > 1 ? ' ×' + n : ''))].filter(Boolean);
        right.innerHTML = `<div class="abd"><div class="abn">${esc(q.name)}</div><div class="from">의뢰인: ${esc(q.giver)}</div><div class="abdesc">${esc(q.desc)}</div>
          ${q.type !== 'flag' ? `<div class="qprog">${bar(p.cur, p.max, 'hp')}<span class="num">${p.cur}/${p.max}</span></div>` : ''}
          ${rw.length ? `<div class="from">보상: ${rw.map(esc).join(', ')}</div>` : ''}</div>`;
      },
      onSelect: () => {},
      onCancel: () => this.back(),
    });
    if (!items.length) m.handler.onKey = k => { if (k === 'cancel') { sfx('cancel'); this.back(); } return true; };
    this.menus.push(m);
  }

  // ── 설정 ──
  settings(focus = 0) {
    this.clearSection(); this.section = 'settings';
    const pct = v => `${'■'.repeat(Math.round(v * 10))}${'□'.repeat(10 - Math.round(v * 10))}`;
    const items = [
      { label: '배경음', right: pct(audioSettings.bgm), data: 'bgm' },
      { label: '효과음', right: pct(audioSettings.sfx), data: 'sfx' },
      { label: '전투 속도', right: this.app.battleSpeed > 1 ? '빠르게 ×2' : '보통 ×1', data: 'speed' },
      { label: '타이틀로 돌아가기', data: 'title' },
    ];
    this.body.appendChild(el('div', 'wtitle', '설정 <small>◀ ▶ 로 조절</small>'));
    const adj = (key, d) => {
      if (key === 'bgm' || key === 'sfx') { audioSettings[key] = Math.max(0, Math.min(1, Math.round((audioSettings[key] + d * 0.1) * 10) / 10)); applyVolumes(); try { localStorage.setItem('crystal-rpg-audio', JSON.stringify(audioSettings)); } catch (e) { /* 무시 */ } }
      if (key === 'speed') this.app.battleSpeed = this.app.battleSpeed > 1 ? 1 : 2;
      sfx('cursor');
      const idx = m.index; m.destroy(); this.menus = []; this.settings(idx);
    };
    const m = new ListMenu(this.body, items, {
      index: focus,
      onLR: d => adj(m.items[m.index].data, d),
      onSelect: it => { if (it.data === 'title') { this.close(); this.app.toTitle(); } else adj(it.data, 1); },
      onCancel: () => this.back(),
    });
    this.menus.push(m);
  }
}

function apRow(x) {
  const pct = Math.round(x.ap / x.ab.ap * 100);
  return `<div class="apbar${x.learned ? ' done' : ''}"><span><img class="ic" src="${iconURL(abIcon(x.ab))}">${esc(x.ab.name)}</span><i><em style="width:${pct}%"></em></i><small>${x.learned ? '습득' : x.ap + '/' + x.ab.ap}</small></div>`;
}

import { expForLevel } from '../data/characters.js';
function expNeed(cs) { return expForLevel(cs.lv + 1) - cs.exp; }
