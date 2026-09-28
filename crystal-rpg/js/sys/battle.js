// ─────────────────────────────────────────────────────────────
//  전투 모델 (연출과 분리된 순수 로직)
//  - CT(카운트 타임) 방식 턴 순서: 민첩에 비례해 게이지가 차고 100에 도달한 유닛이 행동
//  - 행동 결과는 이벤트 배열로 반환 → 전투 씬이 순서대로 연출
//  - 적은 약점 실드를 가지며, 약점 공격으로 0이 되면 BREAK(다음 턴 행동 불가 + 받는 피해 증가)
// ─────────────────────────────────────────────────────────────
import { ABILITIES } from '../data/abilities.js';
import { ENEMIES, ENEMY_SKILLS } from '../data/enemies.js';
import { CHARACTERS } from '../data/characters.js';
import { CONSUMABLES } from '../data/items.js';
import { ELEMENTS } from '../data/elements.js';
import { getStats, activeLoadout, weaponElem, weaponOf } from './party.js';

const ENEMY_DMG = 1.6; // 적 피해 배율 (밸런스 조정용)
const BREAK_MUL = 1.6, WEAK_MUL = 1.45, RESIST_MUL = 0.5, CRIT_MUL = 1.6;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

export const ATTACK = { id: 'attack', name: '공격', kind: 'active', target: 'enemy', type: 'phys', power: 1, tags: ['attack'] };

export class Battle {
  constructor(game, enemyIds, opts = {}) {
    this.game = game;
    this.opts = opts;
    this.units = [];
    this.turn = 0;
    this.over = null;
    game.party.forEach((id, i) => {
      const cs = game.roster[id];
      const lo = activeLoadout(cs);
      const st = getStats(cs, lo);
      const u = {
        side: 'party', id, idx: i, name: CHARACTERS[id].name, cs, lo, base: st,
        maxhp: st.hp, hp: Math.min(cs.hp, st.hp), maxmp: st.mp, mp: Math.min(cs.mp, st.mp),
        alive: cs.hp > 0, buffs: [], status: {}, ct: rand(25, 55), mods: lo.mods,
      };
      for (const m of u.mods.filter(m => m.m === 'startBuff')) u.buffs.push({ stat: m.stat, pct: m.pct, turns: m.turns });
      this.units.push(u);
    });
    const counts = {};
    enemyIds.forEach((eid, i) => {
      const d = ENEMIES[eid];
      counts[eid] = (counts[eid] || 0) + 1;
      const same = enemyIds.filter(x => x === eid).length;
      const u = {
        side: 'enemy', id: eid, idx: i, def: d, name: d.name + (same > 1 ? ' ' + 'ABCD'[counts[eid] - 1] : ''),
        base: { ...d.stats, mp: 999 }, maxhp: d.stats.hp, hp: d.stats.hp, mp: 999, maxmp: 999,
        alive: true, buffs: [], status: {}, ct: rand(0, 40), mods: [],
        weak: [...d.weak], resist: [...(d.resist || [])], absorb: [...(d.absorb || [])],
        shield: d.shield, maxShield: d.shield, broken: false, brokenSkip: false,
        actions: d.actions, phase: 0, design: d.design, spdMul: 1, boss: !!d.boss,
        revealed: new Set(game.bestiary?.[eid]?.revealed || []),
      };
      this.units.push(u);
    });
  }

  get party() { return this.units.filter(u => u.side === 'party'); }
  get enemies() { return this.units.filter(u => u.side === 'enemy'); }
  foes(u) { return this.units.filter(x => x.side !== u.side && x.alive); }
  friends(u) { return this.units.filter(x => x.side === u.side && x.alive); }

  stat(u, k) {
    let pct = 0;
    for (const b of u.buffs) if (b.stat === k) pct += b.pct;
    let v = u.base[k] * Math.max(0.4, Math.min(2.2, 1 + pct / 100));
    if (k === 'spd') v *= u.spdMul || 1;
    return v;
  }
  modSum(u, m, filter = () => true) { return u.mods.filter(x => x.m === m && filter(x)).reduce((a, x) => a + (x.pct ?? x.n ?? x.chance ?? 0), 0); }
  hasMod(u, m) { return u.mods.some(x => x.m === m); }

  // ── 턴 순서 ──
  timeTo(u, ct = u.ct) { return Math.max(0, 100 - ct) / Math.max(1, this.stat(u, 'spd')); }

  predictOrder(n = 8) {
    const sim = this.units.filter(u => u.alive).map(u => ({ u, ct: u.ct, spd: Math.max(1, this.stat(u, 'spd')) }));
    const out = [];
    while (out.length < n && sim.length) {
      let best = null, bt = Infinity;
      for (const s of sim) { const t = Math.max(0, 100 - s.ct) / s.spd; if (t < bt) { bt = t; best = s; } }
      for (const s of sim) s.ct += s.spd * bt;
      out.push(best.u);
      best.ct = 0;
    }
    return out;
  }

  // 다음 행동 유닛 결정 + 턴 시작 처리. {unit, events, skip, auto}
  next() {
    const alive = this.units.filter(u => u.alive);
    let best = null, bt = Infinity;
    for (const u of alive) { const t = this.timeTo(u); if (t < bt) { bt = t; best = u; } }
    for (const u of alive) u.ct += this.stat(u, 'spd') * bt;
    const u = best;
    u.ct = 0;
    this.turn++;
    this.current = u;
    const ev = [];
    // 브레이크 회복
    if (u.brokenSkip) {
      u.brokenSkip = false; u.broken = false; u.shield = u.maxShield;
      ev.push({ e: 'recover', t: u });
      return { unit: u, events: ev, skip: true };
    }
    u.guarding = false;
    // 지속 효과
    if (u.status.poison) {
      const d = Math.max(1, Math.floor(u.maxhp * 0.07));
      u.hp = Math.max(1, u.hp - d);
      ev.push({ e: 'dot', t: u, dmg: d, hpAfter: u.hp, text: '독' });
      if (--u.status.poison.turns <= 0) { delete u.status.poison; ev.push({ e: 'status', t: u, text: '독 회복', color: '#aaffaa' }); }
    }
    const regen = (u.status.regen ? u.status.regen.pct : 0) + this.modSum(u, 'regen');
    if (regen > 0 && u.hp < u.maxhp) {
      const h = Math.floor(u.maxhp * regen / 100);
      u.hp = Math.min(u.maxhp, u.hp + h);
      ev.push({ e: 'hot', t: u, heal: h, hpAfter: u.hp });
    }
    if (u.status.regen && --u.status.regen.turns <= 0) delete u.status.regen;
    for (const b of u.buffs) b.turns--;
    const expired = u.buffs.filter(b => b.turns <= 0);
    u.buffs = u.buffs.filter(b => b.turns > 0);
    if (expired.length) ev.push({ e: 'buffs', t: u });
    if (u.provoke && --u.provoke <= 0) u.provoke = 0;
    if (u.enchant && --u.enchant.turns <= 0) { u.enchant = null; ev.push({ e: 'status', t: u, text: '마법검 해제', color: '#ccc' }); }
    // 도약 착지 (자동 행동)
    if (u.airborne) return { unit: u, events: ev, auto: 'land' };
    return { unit: u, events: ev };
  }

  mpCost(u, ab) {
    if (!ab.mp || u.side === 'enemy') return 0;
    return Math.max(0, Math.ceil(ab.mp * (1 + this.modSum(u, 'mpCost') / 100)));
  }

  // 파티 유닛의 사용 가능한 어빌리티 목록
  commandsFor(u) {
    return u.lo.actives.map(a => ({ ab: a, cost: this.mpCost(u, a), usable: u.mp >= this.mpCost(u, a) && this.validTargets(u, a).length > 0 }));
  }

  validTargets(u, ab) {
    switch (ab.target) {
      case 'enemy': case 'enemies': return this.foes(u).filter(t => !t.airborne);
      case 'ally': case 'allies': return this.friends(u);
      case 'self': return [u];
      case 'allyKO': return this.units.filter(x => x.side === u.side && !x.alive);
    }
    return [];
  }

  // ── 행동 실행 ──
  // action: {type:'attack'|'ability'|'item'|'guard'|'escape', ab, item, target}
  act(u, action) {
    const ev = [];
    if (action.type === 'guard') {
      u.guarding = true; u.ct = 30;
      ev.push({ e: 'guard', u });
      const gh = this.modSum(u, 'guardHeal');
      if (gh) { const h = Math.floor(u.maxhp * gh / 100); u.hp = Math.min(u.maxhp, u.hp + h); ev.push({ e: 'hot', t: u, heal: h, hpAfter: u.hp }); }
      if (u.mp < u.maxmp) { const m = Math.max(1, Math.floor(u.maxmp * 0.05)); u.mp = Math.min(u.maxmp, u.mp + m); ev.push({ e: 'mp', t: u, amount: m, mpAfter: u.mp }); }
      return this.finish(ev);
    }
    if (action.type === 'escape') {
      const ok = !this.opts.noEscape && Math.random() < 0.75;
      ev.push({ e: 'escape', u, ok });
      if (ok) this.over = 'escape';
      return ev;
    }
    if (action.type === 'item') return this.finish(this.useItem(u, action.item, action.target, ev));
    const ab = action.type === 'attack' ? ATTACK : action.ab;
    this.perform(u, ab, action.target, ev);
    return this.finish(ev);
  }

  autoLand(u) {
    const ev = [];
    const j = u.airborne; u.airborne = null;
    let t = j.target;
    if (!t.alive) t = pick(this.foes(u));
    ev.push({ e: 'land', u, t });
    if (t) this.doHits(u, j.ab, [t], ev, { landing: true });
    ev.push({ e: 'end', u });
    return this.finish(ev);
  }

  perform(u, ab, target, ev) {
    const cost = this.mpCost(u, ab);
    u.mp -= cost;
    let targets;
    const pool = this.validTargets(u, ab);
    if (ab.target === 'enemies' || ab.target === 'allies') targets = pool;
    else if (ab.target === 'self') targets = [u];
    else targets = [pool.includes(target) ? target : pick(pool)].filter(Boolean);
    // 수호: 단일 물리 공격이 빈사 아군을 노리면 가로챔
    if (u.side === 'enemy' && ab.type === 'phys' && targets.length === 1 && ab.target === 'enemy') {
      const t = targets[0];
      if (t.hp < t.maxhp * 0.35) {
        const cov = this.friends(t).find(x => x !== t && !x.airborne && this.hasMod(x, 'cover') && x.hp > x.maxhp * 0.25);
        if (cov) { targets = [cov]; ev.push({ e: 'status', t: cov, text: '수호!', color: '#8ad8ff', cover: true, from: t }); }
      }
    }
    const isJump = ab.effects?.some(e => e.t === 'jump');
    ev.push({ e: 'act', u, ab, targets, mpCost: cost, name: ab.id === 'attack' ? null : ab.name, anim: ab.anim || (ab.type === 'phys' ? 'attack' : 'cast'), jump: isJump });
    if (isJump) {
      u.airborne = { ab, target: targets[0] };
      u.ct = 45;
      ev.push({ e: 'jumpUp', u });
      return;
    }
    if (ab.type === 'phys' || ab.type === 'mag') this.doHits(u, ab, targets, ev);
    else if (ab.type === 'heal') this.doHeal(u, ab, targets, ev);
    this.applyEffects(u, ab, targets, ev);
    // 마법검: 속성 마법 사용 시 일반 공격에 속성 부여
    if (u.side === 'party' && ab.type === 'mag' && ab.elem && this.hasMod(u, 'enchant')) {
      const turns = u.mods.find(m => m.m === 'enchant').turns;
      u.enchant = { elem: ab.elem, turns: turns + 1 };
      ev.push({ e: 'enchant', u, elem: ab.elem });
    }
    ev.push({ e: 'end', u });
    // 반격
    if (u.side === 'enemy' && ab.type === 'phys' && u.alive && !this.over) {
      for (const t of targets) {
        if (!t.alive || t.side !== 'party' || t.airborne) continue;
        const ch = this.modSum(t, 'counter');
        if (ch > 0 && Math.random() * 100 < ch) {
          ev.push({ e: 'status', t, text: '반격!', color: '#ffd070' });
          ev.push({ e: 'act', u: t, ab: ATTACK, targets: [u], anim: 'attack', counter: true });
          this.doHits(t, ATTACK, [u], ev);
          ev.push({ e: 'end', u: t });
          break;
        }
      }
    }
  }

  attackElems(u, ab) {
    if (u.side === 'enemy') return [ab.elem || 'strike'];
    if (ab.id === 'attack') {
      const el = [weaponElem(u.cs)];
      if (u.enchant) el.push(u.enchant.elem);
      return el;
    }
    if (ab.type === 'phys') return ab.elem ? (ELEMENTS[ab.elem].phys ? [ab.elem] : [weaponElem(u.cs), ab.elem]) : [weaponElem(u.cs)];
    return ab.elem ? [ab.elem] : [];
  }

  affinity(t, elems) {
    if (t.side !== 'enemy') return 'normal';
    if (elems.some(e => t.weak.includes(e))) return 'weak';
    if (elems.some(e => t.absorb.includes(e))) return 'absorb';
    if (elems.some(e => t.resist.includes(e))) return 'resist';
    return 'normal';
  }

  doHits(u, ab, targets, ev, opt = {}) {
    const elems = this.attackElems(u, ab);
    let hits = ab.hits || 1;
    if (ab.id === 'attack' && u.enchant) hits += this.modSum(u, 'enchantHits');
    const seq = [];
    if (ab.random) { for (let i = 0; i < hits; i++) { const p = targets.filter(t => t.alive); if (p.length) seq.push(pick(p)); } }
    else for (const t of targets) for (let i = 0; i < hits; i++) seq.push(t);
    const extraShield = ab.effects?.find(e => e.t === 'shield')?.n || 0;
    const shieldDone = new Set();
    seq.forEach((t, i) => {
      if (!t.alive) return;
      const h = this.calcHit(u, ab, t, elems);
      h.index = i;
      if (h.miss) { ev.push({ e: 'hit', u, t, miss: true, ab, index: i }); return; }
      if (h.absorb) {
        t.hp = Math.min(t.maxhp, t.hp + h.dmg);
        ev.push({ e: 'hit', u, t, ab, heal: h.dmg, absorb: true, elems, hpAfter: t.hp, index: i });
        this.reveal(t, elems, h.aff);
        return;
      }
      t.hp = Math.max(0, t.hp - h.dmg);
      const hit = { e: 'hit', u, t, ab, dmg: h.dmg, crit: h.crit, weak: h.aff === 'weak', resist: h.aff === 'resist', elems, hpAfter: t.hp, index: i };
      this.reveal(t, elems, h.aff);
      // 실드 감소 / 브레이크
      if (t.side === 'enemy' && !t.broken) {
        let dec = 0;
        if (h.aff === 'weak') {
          dec = 1 + this.modSum(u, 'elemShield', m => elems.includes(m.elem)) + this.modSum(u, 'tagShield', m => ab.tags?.includes(m.tag));
          const wm = this.modSum(u, 'weakMp');
          if (wm && u.side === 'party') { u.mp = Math.min(u.maxmp, u.mp + wm); ev.push({ e: 'mp', t: u, amount: wm, mpAfter: u.mp, quiet: true }); }
        }
        if (extraShield && !shieldDone.has(t)) { dec += extraShield + (h.aff === 'weak' ? 0 : 0); shieldDone.add(t); }
        if (dec > 0) {
          t.shield = Math.max(0, t.shield - dec);
          if (t.shield === 0) { t.broken = true; t.brokenSkip = true; t.ct = Math.min(t.ct, 0); hit.broke = true; }
        }
      }
      hit.shield = t.shield;
      // 흡수(드레인)
      const drainPct = (ab.effects?.find(e => e.t === 'drain')?.pct || 0) + (ab.type === 'phys' ? this.modSum(u, 'drain') : 0);
      if (drainPct && u.alive) { const d = Math.floor(h.dmg * drainPct / 100); u.hp = Math.min(u.maxhp, u.hp + d); hit.drain = d; hit.uHpAfter = u.hp; }
      if (t.hp <= 0) { t.alive = false; hit.kill = true; t.airborne = null; t.buffs = []; t.status = {}; }
      ev.push(hit);
    });
  }

  calcHit(u, ab, t, elems) {
    if (t.airborne) return { miss: true };
    const mag = ab.type === 'mag';
    const a = this.stat(u, mag ? 'mag' : 'atk'), d = this.stat(t, mag ? 'mdf' : 'def');
    let base = Math.max(a * 0.35, a * (mag ? 2.3 : 2.2) - d * 1.05);
    let dmg = base * (ab.power || 1) * rand(0.93, 1.07);
    const aff = this.affinity(t, elems);
    let pct = 0;
    pct += this.modSum(u, 'elemDmg', m => elems.includes(m.elem));
    pct += this.modSum(u, 'tagDmg', m => ab.tags?.includes(m.tag));
    if (aff === 'weak') pct += this.modSum(u, 'weakDmg');
    if (t.broken) pct += this.modSum(u, 'breakDmg');
    if (u.hp < u.maxhp * 0.3) pct += this.modSum(u, 'lowHpDmg');
    dmg *= 1 + pct / 100;
    if (aff === 'weak') dmg *= WEAK_MUL;
    if (aff === 'resist') dmg *= RESIST_MUL;
    if (t.broken) dmg *= BREAK_MUL;
    if (t.guarding) dmg *= 0.5;
    if (u.side === 'enemy') dmg *= ENEMY_DMG;
    let critCh = 4 + this.stat(u, 'luk') / 3 + this.modSum(u, 'crit') + this.modSum(u, 'critElem', m => elems.includes(m.elem));
    if (mag) critCh *= 0.5;
    const crit = aff !== 'absorb' && Math.random() * 100 < critCh;
    if (crit) dmg *= CRIT_MUL;
    dmg = Math.max(1, Math.round(dmg));
    if (aff === 'absorb') return { absorb: true, dmg: Math.round(dmg * 0.6), aff };
    return { dmg, crit, aff };
  }

  reveal(t, elems, aff) {
    if (t.side !== 'enemy') return;
    for (const e of elems) {
      if (t.weak.includes(e) || t.resist.includes(e) || t.absorb.includes(e)) t.revealed.add(e);
    }
    this.saveReveal(t);
  }
  saveReveal(t) {
    const b = this.game.bestiary = this.game.bestiary || {};
    const key = t.phase ? t.id + '#' + t.phase : t.id;
    b[key] = { revealed: [...t.revealed] };
  }

  doHeal(u, ab, targets, ev) {
    const healUp = this.modSum(u, 'healUp');
    const regenT = u.mods.find(m => m.m === 'healRegen');
    for (const t of targets) {
      if (!ab.power) continue;
      if (!t.alive) continue;
      const amt = Math.round(this.stat(u, 'mag') * 2.4 * ab.power * (1 + healUp / 100) * rand(0.95, 1.05) + 8);
      t.hp = Math.min(t.maxhp, t.hp + amt);
      ev.push({ e: 'hit', u, t, ab, heal: amt, hpAfter: t.hp });
      if (regenT) { t.status.regen = { pct: 6, turns: regenT.turns }; ev.push({ e: 'status', t, text: '재생', color: '#9dffb0' }); }
    }
  }

  applyEffects(u, ab, targets, ev) {
    for (const ef of ab.effects || []) {
      for (const t of targets) {
        if (ef.t === 'revive') {
          if (t.alive) continue;
          t.alive = true; t.hp = Math.max(1, Math.floor(t.maxhp * ef.pct / 100)); t.ct = 0;
          ev.push({ e: 'revive', t, hpAfter: t.hp });
          continue;
        }
        if (!t.alive) continue;
        if (ef.t === 'buff' || ef.t === 'debuff') {
          const pct = ef.t === 'buff' ? ef.pct : -ef.pct;
          t.buffs = t.buffs.filter(b => !(b.stat === ef.stat && Math.sign(b.pct) === Math.sign(pct)));
          t.buffs.push({ stat: ef.stat, pct, turns: ef.turns + (t === u ? 1 : 0) });
          ev.push({ e: 'status', t, text: `${statLabel(ef.stat)}${pct > 0 ? '↑' : '↓'}`, color: pct > 0 ? '#ffd070' : '#b0a0ff' });
        } else if (ef.t === 'status') {
          if (Math.random() * 100 < ef.chance && !t.status[ef.s]) {
            t.status[ef.s] = { turns: ef.turns };
            ev.push({ e: 'status', t, text: ef.s === 'poison' ? '독!' : ef.s, color: '#c080ff' });
          }
        } else if (ef.t === 'regen') {
          t.status.regen = { pct: ef.pct, turns: ef.turns };
          ev.push({ e: 'status', t, text: '재생', color: '#9dffb0' });
        } else if (ef.t === 'cleanse') {
          if (t.status.poison) { delete t.status.poison; ev.push({ e: 'status', t, text: '해독', color: '#9dffb0' }); }
        } else if (ef.t === 'delay') {
          if (t.side === 'enemy' && !t.broken) { t.ct -= ef.n; ev.push({ e: 'status', t, text: '지연', color: '#8ad8ff' }); }
        } else if (ef.t === 'provoke') {
          t.provoke = ef.turns + 1;
          ev.push({ e: 'status', t, text: '도발', color: '#ff9a70' });
        } else if (ef.t === 'scan') {
          for (const e of [...t.weak, ...t.resist, ...t.absorb]) t.revealed.add(e);
          t.scanned = true; this.saveReveal(t);
          ev.push({ e: 'scan', t });
        }
      }
    }
  }

  useItem(u, itemId, target, ev) {
    const it = CONSUMABLES[itemId];
    const inv = this.game.inv;
    if (!(inv[itemId] > 0)) return ev;
    inv[itemId]--; if (!inv[itemId]) delete inv[itemId];
    ev.push({ e: 'act', u, ab: { id: 'item', name: it.name, fx: 'item', type: 'item' }, targets: [target], name: it.name, anim: 'cast', item: itemId });
    const t = target, ef = it.effect;
    if (ef.revive) {
      if (!t.alive) { t.alive = true; t.hp = Math.max(1, Math.floor(t.maxhp * ef.revive / 100)); t.ct = 0; ev.push({ e: 'revive', t, hpAfter: t.hp }); }
    } else if (t.alive) {
      if (ef.hp) { const h = Math.min(ef.hp, t.maxhp - t.hp); t.hp += h; ev.push({ e: 'hit', u, t, heal: ef.hp, hpAfter: t.hp }); }
      if (ef.mp) { t.mp = Math.min(t.maxmp, t.mp + ef.mp); ev.push({ e: 'mp', t, amount: ef.mp, mpAfter: t.mp }); }
      if (ef.cure && t.status.poison) { delete t.status.poison; ev.push({ e: 'status', t, text: '해독', color: '#9dffb0' }); }
    }
    ev.push({ e: 'end', u });
    return ev;
  }

  // ── 적 AI ──
  enemyAction(u) {
    const opts = u.actions.filter(a => {
      if (a.if?.hpBelow && u.hp / u.maxhp > a.if.hpBelow) return false;
      const sk = ENEMY_SKILLS[a.use];
      if (sk?.target === 'self' && sk.effects?.some(e => e.t === 'buff' && u.buffs.some(b => b.stat === e.stat && b.pct > 0))) return false;
      return true;
    });
    let r = Math.random() * opts.reduce((s, a) => s + a.w, 0);
    let choice = opts[0];
    for (const a of opts) { r -= a.w; if (r <= 0) { choice = a; break; } }
    const ab = choice.use === 'attack' ? { ...ATTACK, fx: 'hit', elem: u.def.attackElem || 'strike' } : ENEMY_SKILLS[choice.use];
    // 대상: 도발 우선, 아니면 무작위 (도약 중인 대상 제외)
    let target = null;
    if (ab.target === 'enemy') {
      const pool = this.foes(u).filter(t => !t.airborne);
      const prov = pool.filter(t => t.provoke > 0);
      target = prov.length ? pick(prov) : pick(pool);
      if (!target) { return this.finish([{ e: 'status', t: u, text: '…', color: '#ccc' }]); }
    }
    const ev = [];
    this.perform(u, ab, target, ev);
    return this.finish(ev);
  }

  // 행동 후: 보스 페이즈 체크 + 승패 판정
  finish(ev) {
    for (const u of this.enemies) {
      if (!u.alive || !u.def.phases) continue;
      const ph = u.def.phases[u.phase];
      if (ph && u.hp / u.maxhp <= ph.hpBelow) {
        u.phase++;
        u.name = ph.name;
        u.weak = [...ph.weak]; u.resist = [...ph.resist]; u.absorb = [...(ph.absorb || [])];
        u.maxShield = u.shield = ph.shield; u.broken = false; u.brokenSkip = false;
        u.actions = ph.actions; u.spdMul = ph.spdMul || 1; u.buffs = u.buffs.filter(b => b.pct < 0);
        if (ph.design) u.design = ph.design;
        u.revealed = new Set(this.game.bestiary?.[u.id + '#' + u.phase]?.revealed || []);
        ev.push({ e: 'phase', t: u, phase: ph });
      }
    }
    if (!this.enemies.some(e => e.alive)) this.over = 'win';
    else if (!this.party.some(p => p.alive)) this.over = 'lose';
    return ev;
  }

  rewards() {
    let exp = 0, gold = 0, ap = 0; const drops = [];
    for (const e of this.enemies) {
      const d = e.def;
      exp += d.exp; gold += d.gold; ap += d.ap;
      for (const dr of d.drops || []) if (Math.random() < dr.chance) drops.push(dr.id);
    }
    return { exp, gold, ap, drops };
  }

  // 전투 종료 후 캐릭터 상태 반영
  writeBack() {
    for (const u of this.party) {
      u.cs.hp = u.alive ? Math.max(1, u.hp) : 0;
      u.cs.mp = u.mp;
    }
  }
}

function statLabel(s) { return { atk: '공격', def: '방어', mag: '마력', mdf: '정신', spd: '민첩' }[s] || s; }
