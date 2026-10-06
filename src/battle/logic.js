// Battle rules: CTB timeline, damage, break / full break / extra phase, resonance.
// Pure logic; presentation is delegated to `hooks`.
import { ECHOES, ENEMIES, ITEMS, SKILLS, TROOPS } from '../data/db.js';

const CT_MAX = 1000;
const LETTERS = 'ABCDEFGH';

export class Unit {
  constructor(side, o) {
    Object.assign(this, o);
    this.side = side;
    this.ct = 0;
    this.buffs = [];
    this.broken = false;
    this.guard = false;
    this.ko = this.hp <= 0;
  }
  get alive() {
    return !this.ko;
  }
  stat(k) {
    let v = this.stats[k];
    for (const b of this.buffs) if (b.stat === k) v *= 1 + b.amount;
    return v;
  }
}

function rnd(a, b) {
  return a + Math.random() * (b - a);
}

export class Battle {
  constructor(game, troopId, hooks) {
    this.game = game;
    this.troop = TROOPS[troopId];
    this.troopId = troopId;
    this.hooks = hooks;
    this.heroes = game.state.party.map((m, i) => {
      const s = m.stats;
      return new Unit('hero', {
        id: m.id, member: m, name: m.name, sprite: m.def.sprite, stats: s, hp: m.hp, mp: m.mp, maxhp: s.hp, maxmp: s.mp,
        skills: m.skills, echo: m.echo, echoSkills: m.echoSkills, res: m.resonance ?? 0, index: i,
      });
    });
    const counts = {};
    this.troop.enemies.forEach((e) => (counts[e] = (counts[e] || 0) + 1));
    const seen = {};
    this.enemies = this.troop.enemies.map((eid, i) => {
      const d = ENEMIES[eid];
      seen[eid] = (seen[eid] || 0) + 1;
      return new Unit('enemy', {
        id: eid + i, kind: eid, data: d, name: d.name, sprite: d.sprite, letter: counts[eid] > 1 ? LETTERS[seen[eid] - 1] : '',
        stats: { hp: d.hp, mp: 99, atk: d.atk, def: d.def, mag: d.mag, mdf: d.mdf, spd: d.spd }, hp: d.hp, maxhp: d.hp, mp: 99, maxmp: 99,
        brk: d.brk, brkMax: d.brk, index: i, boss: !!d.boss,
      });
    });
    // initial CT spread by speed so the timeline isn't uniform
    for (const u of this.all) u.ct = u.stats.spd * rnd(6, 14) + (u.side === 'hero' ? 120 : 0);
    this.extraUsed = false;
    this.inExtra = false;
    this.turn = 0;
    this.over = false;
    this.result = null;
  }

  get all() {
    return [...this.heroes, ...this.enemies];
  }
  get living() {
    return this.all.filter((u) => u.alive);
  }

  // ---------------------------------------------------------------- CTB
  timeToAct(u, ct = u.ct) {
    return (CT_MAX - ct) / Math.max(1, u.stat('spd'));
  }

  predict(n = 12) {
    const sim = this.living.map((u) => ({ u, ct: u.ct }));
    const out = [];
    for (let k = 0; k < n && sim.length; k++) {
      let best = sim[0], bt = Infinity;
      for (const s of sim) {
        const t = (CT_MAX - s.ct) / Math.max(1, s.u.stat('spd'));
        if (t < bt) { bt = t; best = s; }
      }
      for (const s of sim) s.ct += s.u.stat('spd') * bt;
      out.push(best.u);
      best.ct = 0;
    }
    return out;
  }

  advance() {
    let best = null, bt = Infinity;
    for (const u of this.living) {
      const t = this.timeToAct(u);
      if (t < bt) { bt = t; best = u; }
    }
    for (const u of this.living) u.ct += u.stat('spd') * bt;
    return best;
  }

  // ---------------------------------------------------------------- main loop
  async run() {
    await this.hooks.intro?.();
    while (!this.over) {
      const u = this.advance();
      this.turn++;
      await this.takeTurn(u);
      if (this.checkEnd()) break;
      await this.checkFullBreak();
      if (this.checkEnd()) break;
    }
    return this.result;
  }

  async takeTurn(u, extra = false) {
    u.guard = false;
    // buffs tick down at the start of the owner's turn
    u.buffs = u.buffs.filter((b) => --b.turns > 0);
    if (u.broken && !extra) {
      // broken units spend their turn recovering
      u.broken = false;
      u.brk = u.brkMax;
      u.ct = 0;
      if (this.enemies.every((e) => !e.broken)) this.extraUsed = false;
      await this.hooks.recover?.(u);
      this.hooks.update?.();
      return;
    }
    let action;
    if (u.side === 'hero') action = await this.hooks.chooseCommand(u, { extra, battle: this });
    else action = this.enemyAI(u);
    if (!action) return;
    await this.execute(u, action);
    if (!extra) u.ct = -(action.delay ?? 0) * 8;
    this.hooks.update?.();
  }

  enemyAI(u) {
    const list = u.data.skills;
    let tot = list.reduce((a, [, w]) => a + w, 0);
    let r = Math.random() * tot, sk = list[0][0];
    for (const [s, w] of list) {
      if ((r -= w) <= 0) { sk = s; break; }
    }
    const S = SKILLS[sk];
    if (S.type === 'buff' && u.buffs.some((b) => b.stat === S.stat)) sk = list[0][0];
    const skill = SKILLS[sk];
    const heroes = this.heroes.filter((h) => h.alive);
    let targets;
    if (skill.target === 'enemies') targets = heroes;
    else if (skill.target === 'self') targets = [u];
    else {
      // prefer the weakest sometimes
      targets = [Math.random() < 0.3 ? heroes.reduce((a, b) => (a.hp / a.maxhp < b.hp / b.maxhp ? a : b)) : heroes[Math.floor(Math.random() * heroes.length)]];
    }
    return { kind: 'skill', skill: sk, targets };
  }

  // ---------------------------------------------------------------- execution
  async execute(u, a) {
    if (a.kind === 'guard') {
      u.guard = true;
      u.res = Math.min(100, u.res + 6);
      await this.hooks.present(u, a, []);
      return;
    }
    if (a.kind === 'escape') {
      const ok = !this.troop.noEscape && Math.random() < 0.8;
      await this.hooks.present(u, a, [{ escaped: ok }]);
      if (ok) {
        this.over = true;
        this.result = 'escape';
      }
      return;
    }
    if (a.kind === 'item') {
      const it = ITEMS[a.item];
      this.game.state.items[a.item]--;
      const res = [];
      for (const t of a.targets) {
        if (it.type === 'heal' && t.alive) {
          const v = Math.min(it.amount, t.maxhp - t.hp);
          t.hp += v;
          res.push({ target: t, heal: v });
        } else if (it.type === 'mp' && t.alive) {
          const v = Math.min(it.amount, t.maxmp - t.mp);
          t.mp += v;
          res.push({ target: t, mpHeal: v });
        } else if (it.type === 'revive' && t.ko) {
          t.ko = false;
          t.hp = Math.round(t.maxhp * it.amount);
          res.push({ target: t, revive: t.hp });
        }
      }
      await this.hooks.present(u, { ...a, fx: it.fx, name: it.name }, res);
      return;
    }
    // skill / resonance
    let skill = a.kind === 'resonance' ? ECHOES[u.echo].resonance : SKILLS[a.skill];
    if (a.kind === 'resonance') u.res = 0;
    else if (skill.mp) u.mp = Math.max(0, u.mp - skill.mp);
    // retarget if target died
    let targets = skill.full ? [...this.heroes] : a.targets.filter((t) => (skill.type === 'revive' ? t.ko : t.alive));
    if (!targets.length) {
      const pool = (u.side === 'hero') === (skill.target.startsWith('enem')) ? this.enemies : this.heroes;
      const alt = pool.filter((t) => t.alive);
      if (!alt.length) return;
      targets = skill.target === 'enemies' || skill.target === 'allies' ? alt : [alt[0]];
    }
    const results = [];
    const hits = skill.hits || 1;
    for (const t of targets) {
      for (let h = 0; h < hits; h++) results.push(this.resolve(u, skill, t, h));
    }
    if (u.side === 'hero') u.res = Math.min(100, u.res + (a.kind === 'resonance' ? 0 : 9));
    await this.hooks.present(u, { ...a, skillDef: skill }, results);
    // break events after the presentation
    for (const r of results) {
      if (r.breakNow) {
        await this.hooks.breakUnit?.(r.target);
      }
      if (r.koNow) await this.hooks.ko?.(r.target);
    }
  }

  resolve(u, s, t, hitIdx) {
    const r = { target: t, hit: hitIdx };
    if (s.type === 'heal') {
      if (!t.alive) return r;
      const v = s.full ? t.maxhp : Math.round(u.stat('mag') * 4.2 * s.power * rnd(0.95, 1.05) + 30);
      const heal = Math.min(v, t.maxhp - t.hp);
      t.hp += heal;
      r.heal = heal;
      if (s.full && t.ko) {
        t.ko = false;
        t.hp = t.maxhp;
        r.revive = t.hp;
      }
      return r;
    }
    if (s.type === 'revive') {
      if (t.ko) {
        t.ko = false;
        t.hp = Math.round(t.maxhp * s.power);
        r.revive = t.hp;
      }
      return r;
    }
    if (s.type === 'buff') {
      const b = t.buffs.find((b) => b.stat === s.stat);
      if (b) b.turns = s.turns + 1;
      else t.buffs.push({ stat: s.stat, amount: s.amount, turns: s.turns + 1 });
      r.buff = s.stat;
      return r;
    }
    // damage
    const phys = s.type === 'phys';
    const atk = phys ? u.stat('atk') : u.stat('mag');
    const def = phys ? t.stat('def') : t.stat('mdf');
    let dmg = Math.max(1, atk * 2.2 - def * 1.1) * s.power * rnd(0.93, 1.07);
    let weak = false, resist = false, absorb = false;
    const d = t.data;
    if (s.el && d) {
      if (d.absorb?.includes(s.el)) absorb = true;
      else if (d.weak?.includes(s.el)) weak = true;
      else if (d.resist?.includes(s.el)) resist = true;
    }
    if (s.el && t.side === 'hero') {
      // heroes have no elemental affinities in the tutorial
    }
    const crit = phys && Math.random() < 0.08;
    if (crit) dmg *= 1.5;
    if (weak) dmg *= 1.6;
    if (resist) dmg *= 0.5;
    if (t.broken) dmg *= 1.6;
    if (t.guard) dmg *= 0.5;
    dmg = Math.round(dmg);
    if (absorb) {
      const v = Math.min(dmg, t.maxhp - t.hp);
      t.hp += v;
      r.heal = v;
      r.absorb = true;
      return r;
    }
    t.hp = Math.max(0, t.hp - dmg);
    Object.assign(r, { dmg, weak, resist, crit });
    if (t.side === 'hero') t.res = Math.min(100, t.res + 4);
    // break gauge
    if (t.side === 'enemy' && !t.broken && s.brk) {
      const bd = s.brk * (weak ? 2.2 : 1) * (resist ? 0.5 : 1) * (crit ? 1.3 : 1);
      t.brk = Math.max(0, t.brk - bd);
      r.brkDmg = bd;
      if (t.brk <= 0 && t.hp > 0) {
        t.broken = true;
        t.ct -= 450;
        r.breakNow = true;
        if (u.side === 'hero') u.res = Math.min(100, u.res + 18);
      }
    }
    if (t.hp <= 0) {
      t.ko = true;
      t.broken = false;
      t.buffs = [];
      r.koNow = true;
    }
    return r;
  }

  async checkFullBreak() {
    const alive = this.enemies.filter((e) => e.alive);
    if (!alive.length || this.extraUsed || this.inExtra) return;
    if (alive.every((e) => e.broken)) {
      this.extraUsed = true;
      this.inExtra = true;
      await this.hooks.fullBreak?.(alive.length === 1 && this.enemies.length === 1);
      for (const h of this.heroes) {
        if (!h.alive) continue;
        if (this.enemies.every((e) => !e.alive)) break;
        await this.hooks.extraTurn?.(h);
        await this.takeTurn(h, true);
        if (this.checkEnd()) break;
      }
      this.inExtra = false;
      await this.hooks.extraEnd?.();
    }
  }

  checkEnd() {
    if (this.over) return true;
    if (this.enemies.every((e) => !e.alive)) {
      this.over = true;
      this.result = 'win';
    } else if (this.heroes.every((h) => !h.alive)) {
      this.over = true;
      this.result = 'lose';
    }
    return this.over;
  }

  // write HP/MP/resonance back to the persistent party
  commit() {
    for (const h of this.heroes) {
      h.member.hp = h.ko ? 1 : h.hp;
      h.member.mp = h.mp;
      h.member.resonance = h.res;
    }
  }

  rewards() {
    let exp = 0, gold = 0;
    for (const e of this.enemies) {
      exp += e.data.exp;
      gold += e.data.gold;
    }
    return { exp, gold };
  }
}
