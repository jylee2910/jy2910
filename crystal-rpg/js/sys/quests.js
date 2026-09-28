// 퀘스트 진행: 수주 → 조건 충족(complete) → 보고(done, 보상 지급)
import { QUESTS } from '../data/quests.js';
import { G, addItem, itemCount, on } from '../core/state.js';
import { itemInfo } from '../data/items.js';
import { toast, icon } from '../ui/ui.js';
import { sfx } from '../core/audio.js';

export function qstate(id) { return G.s.quests[id]?.state || 'none'; }
export function available(id) { const q = QUESTS[id]; return qstate(id) === 'none' && (!q.requires || qstate(q.requires) === 'done'); }

export function accept(id) {
  const q = QUESTS[id];
  G.s.quests[id] = { state: 'active', base: q.type === 'kill' ? (G.s.kills[q.target] || 0) : 0 };
  sfx('ok');
  toast(`${icon('star')} 퀘스트 수주: <b>${q.name}</b>`);
  check();
}

export function progress(id) {
  const q = QUESTS[id], st = G.s.quests[id];
  if (!st) return { cur: 0, max: q.count || 1 };
  if (st.state === 'done' || st.state === 'complete') return { cur: q.count || 1, max: q.count || 1 };
  if (q.type === 'kill') return { cur: Math.min(q.count, (G.s.kills[q.target] || 0) - st.base), max: q.count };
  if (q.type === 'collect') return { cur: Math.min(q.count, itemCount(q.item)), max: q.count };
  if (q.type === 'flag') return { cur: G.s.flags[q.flag] ? 1 : 0, max: 1 };
  return { cur: 0, max: 1 };
}

export function check() {
  for (const [id, st] of Object.entries(G.s.quests)) {
    const q = QUESTS[id];
    if (st.state === 'active') {
      const p = progress(id);
      if (p.cur >= p.max) { st.state = 'complete'; toast(`${icon('star')} <b>${q.name}</b> 달성! ${q.main ? '' : q.giver + '에게 보고하자.'}`, 3000); sfx('learn'); }
    } else if (st.state === 'complete' && q.type === 'collect' && itemCount(q.item) < q.count) st.state = 'active';
  }
}

export function turnIn(id) {
  const q = QUESTS[id];
  if (q.consume) addItem(q.item, -q.count);
  G.s.quests[id].state = 'done';
  const r = q.reward || {};
  const got = [];
  if (r.gold) { G.s.gold += r.gold; got.push(`${r.gold} G`); }
  for (const [it, n] of Object.entries(r.items || {})) { addItem(it, n); got.push(`${itemInfo(it).name}${n > 1 ? ' ×' + n : ''}`); }
  sfx('chest');
  return got;
}

export function activeQuests() { return Object.keys(QUESTS).filter(id => ['active', 'complete', 'done'].includes(qstate(id))); }

on(type => { if (type === 'kill' || type === 'item' || type === 'flag') check(); });
