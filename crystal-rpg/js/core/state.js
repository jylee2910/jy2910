// 게임 진행 상태 + 저장/불러오기 (localStorage, 모든 접근은 try/catch)
import { newChar, fullHeal } from '../sys/party.js';

const SAVE_KEY = 'crystal-rpg-save-v1';
export const G = { s: null, listeners: [] };

export function newGameState() {
  const s = {
    version: 1,
    party: ['leon', 'sera'],
    roster: {},
    gold: 150,
    inv: { potion: 4, antidote: 2 },
    flags: {},
    quests: {},
    kills: {},
    bestiary: {},
    chests: {},
    loc: { scene: 'field', map: 'town', x: 12, y: 13, dir: 'up' },
    playTime: 0,
    steps: 0,
  };
  for (const id of s.party) s.roster[id] = newChar(id);
  return s;
}

export function recruit(id, lv) {
  const s = G.s;
  if (s.roster[id]) return false;
  const avg = Math.round(Object.values(s.roster).reduce((a, c) => a + c.lv, 0) / Object.keys(s.roster).length);
  s.roster[id] = newChar(id, Math.max(lv || 1, avg));
  if (s.party.length < 3) s.party.push(id);
  return true;
}

export function addItem(id, n = 1) { const inv = G.s.inv; inv[id] = (inv[id] || 0) + n; if (inv[id] <= 0) delete inv[id]; emit('item', id); }
export function itemCount(id) { return G.s.inv[id] || 0; }
export function flag(k, v) { if (v === undefined) return !!G.s.flags[k]; G.s.flags[k] = v; emit('flag', k); }
export function recordKill(id) { G.s.kills[id] = (G.s.kills[id] || 0) + 1; emit('kill', id); }
export function healAll() { for (const cs of Object.values(G.s.roster)) fullHeal(cs); }

export function on(fn) { G.listeners.push(fn); }
function emit(type, id) { for (const f of G.listeners) f(type, id); }

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}
export function saveGame() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.s)); return true; } catch (e) { console.warn('저장 실패', e); return false; }
}
export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (!s || s.version !== 1 || !s.roster) return false;
    G.s = s;
    return true;
  } catch (e) { console.warn('불러오기 실패', e); return false; }
}
export function deleteSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }
