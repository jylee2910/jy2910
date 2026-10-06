// Persistent game state: party roster, levels, echoes, inventory, flags.
import { ECHOES, HEROES, expForLevel } from '../data/db.js';

export class Member {
  constructor(id, data = {}) {
    this.id = id;
    this.def = HEROES[id];
    this.level = data.level ?? this.def.level;
    this.exp = data.exp ?? expForLevel(this.level - 1);
    this.echo = data.echo ?? null;
    this.hp = data.hp ?? null;
    this.mp = data.mp ?? null;
    this.resonance = data.resonance ?? 0;
    if (this.hp == null) {
      this.hp = this.stats.hp;
      this.mp = this.stats.mp;
    }
  }

  get name() {
    return this.def.name;
  }

  get stats() {
    const b = this.def.base, g = this.def.grow, lv = this.level - this.def.level;
    const s = {};
    for (const k of Object.keys(b)) s[k] = Math.round(b[k] + g[k] * lv);
    const e = this.echo && ECHOES[this.echo];
    if (e) for (const [k, v] of Object.entries(e.bonus)) s[k] = (s[k] || 0) + v;
    return s;
  }

  get skills() {
    return [...this.def.skills];
  }

  get echoSkills() {
    const e = this.echo && ECHOES[this.echo];
    return e ? [...e.skills] : [];
  }

  toJSON() {
    return { level: this.level, exp: this.exp, echo: this.echo, hp: this.hp, mp: this.mp, resonance: this.resonance };
  }
}

export class GameState {
  constructor() {
    this.reset();
  }

  reset() {
    this.members = { kael: new Member('kael', { echo: 'astrea' }), argen: new Member('argen') };
    this.order = ['kael', 'argen'];
    this.echoes = ['astrea'];
    this.items = { potion: 5, ether: 2, phoenix: 1 };
    this.gold = 300;
    this.flags = {};
    this.fieldPos = null;
    this.chapter = 1;
    this.objective = '그란벨 성으로 가자';
  }

  get party() {
    return this.order.map((id) => this.members[id]);
  }

  join(id) {
    if (!this.members[id]) this.members[id] = new Member(id);
    if (!this.order.includes(id)) this.order.push(id);
  }

  leaderSprite() {
    return this.members[this.order[0]].def.sprite;
  }

  healAll() {
    for (const m of this.party) {
      const s = m.stats;
      m.hp = s.hp;
      m.mp = s.mp;
    }
  }

  gainEcho(id) {
    if (!this.echoes.includes(id)) this.echoes.push(id);
  }

  equipEcho(memberId, echoId) {
    // an echo can only be bound to one member at a time
    for (const m of Object.values(this.members)) if (m.echo === echoId) m.echo = null;
    const m = this.members[memberId];
    const before = m.stats;
    m.echo = echoId;
    const after = m.stats;
    m.hp = Math.min(after.hp, m.hp + Math.max(0, after.hp - before.hp));
    m.mp = Math.min(after.mp, m.mp + Math.max(0, after.mp - before.mp));
  }

  save() {
    try {
      const data = {
        members: Object.fromEntries(Object.entries(this.members).map(([k, v]) => [k, v.toJSON()])),
        order: this.order, echoes: this.echoes, items: this.items, gold: this.gold, flags: this.flags, fieldPos: this.fieldPos, objective: this.objective,
      };
      localStorage.setItem('crystal-echoes-save', JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  load() {
    try {
      const raw = localStorage.getItem('crystal-echoes-save');
      if (!raw) return false;
      const d = JSON.parse(raw);
      this.members = {};
      for (const [k, v] of Object.entries(d.members)) this.members[k] = new Member(k, v);
      Object.assign(this, { order: d.order, echoes: d.echoes, items: d.items, gold: d.gold, flags: d.flags, fieldPos: d.fieldPos, objective: d.objective });
      return true;
    } catch (e) {
      return false;
    }
  }

  static hasSave() {
    try {
      return !!localStorage.getItem('crystal-echoes-save');
    } catch (e) {
      return false;
    }
  }
}
