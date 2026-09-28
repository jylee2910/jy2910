// ─────────────────────────────────────────────────────────────
//  캐릭터 상태 / 스탯 / 장비 / 어빌리티 (숙련·습득·등록·공명)
//
//  어빌리티 사용 규칙
//   1) 고유(innate) 어빌리티: 항상 활성
//   2) 장착 무기의 어빌리티: 장착 중에는 등록 없이 활성 ("무기 부여")
//   3) 습득한 어빌리티: 코스트 한도 안에서 등록(set)해야 활성
//  전투에서 얻은 AP는 장착 무기의 미습득 어빌리티에 쌓이고, 다 차면 영구 습득.
// ─────────────────────────────────────────────────────────────
import { CHARACTERS, abilityCapacity, expForLevel, MAX_LEVEL } from '../data/characters.js';
import { ABILITIES, SYNERGIES } from '../data/abilities.js';
import { WEAPONS, ARMORS, ACCESSORIES } from '../data/items.js';
import { WEAPON_TYPES } from '../data/elements.js';

export const STAT_KEYS = ['hp', 'mp', 'atk', 'def', 'mag', 'mdf', 'spd', 'luk'];

export function newChar(id, lv = 1) {
  const def = CHARACTERS[id];
  const cs = { id, lv, exp: expForLevel(lv), hp: 1, mp: 1, equip: { weapon: def.start.weapon, armor: def.start.armor || null, acc: null }, learned: [], ap: {}, set: [] };
  const st = getStats(cs);
  cs.hp = st.hp; cs.mp = st.mp;
  return cs;
}

export function weaponOf(cs) { return cs.equip.weapon ? WEAPONS[cs.equip.weapon] : null; }

// 스프라이트 생성용 무기 외형
export function weaponLook(cs) {
  const w = weaponOf(cs);
  return w ? { type: w.type, tint: w.tint } : null;
}

export function weaponElem(cs) {
  const w = weaponOf(cs);
  return w ? WEAPON_TYPES[w.type].elem : 'strike';
}

function equipStats(cs) {
  const s = {};
  for (const [slot, table] of [['weapon', WEAPONS], ['armor', ARMORS], ['acc', ACCESSORIES]]) {
    const it = cs.equip[slot] && table[cs.equip[slot]];
    if (it) for (const [k, v] of Object.entries(it.stats)) s[k] = (s[k] || 0) + v;
  }
  return s;
}

export function baseStats(cs) {
  const d = CHARACTERS[cs.id];
  const o = {};
  for (const k of STAT_KEYS) o[k] = Math.floor(d.base[k] + d.growth[k] * (cs.lv - 1));
  return o;
}

// 장비 + 패시브 반영 최종 스탯
export function getStats(cs, loadout = activeLoadout(cs)) {
  const b = baseStats(cs), e = equipStats(cs), out = {};
  for (const k of STAT_KEYS) {
    let v = b[k] + (e[k] || 0);
    const pct = loadout.mods.filter(m => m.m === 'stat' && m.stat === k).reduce((a, m) => a + m.pct, 0);
    out[k] = Math.max(k === 'hp' ? 1 : 0, Math.floor(v * (1 + pct / 100)));
  }
  return out;
}

// ── 어빌리티 ──
export function capacity(cs) { return abilityCapacity(cs.lv); }
export function costUsed(cs) { return cs.set.reduce((a, id) => a + (ABILITIES[id]?.cost || 0), 0); }
export function weaponAbilities(cs) { return weaponOf(cs)?.abilities || []; }
export function isLearned(cs, id) { return cs.learned.includes(id); }

// 현재 활성 어빌리티 전체 + 수집된 패시브 mods + 발동 중인 공명
export function activeLoadout(cs) {
  const src = new Map();
  for (const id of CHARACTERS[cs.id].innate) src.set(id, 'innate');
  for (const id of weaponAbilities(cs)) if (!src.has(id)) src.set(id, 'weapon');
  for (const id of cs.set) if (!src.has(id)) src.set(id, 'set');
  const ids = [...src.keys()];
  const actives = ids.filter(id => ABILITIES[id].kind === 'active').map(id => ({ ...ABILITIES[id], source: src.get(id) }));
  const passives = ids.filter(id => ABILITIES[id].kind === 'passive').map(id => ({ ...ABILITIES[id], source: src.get(id) }));
  const synergies = SYNERGIES.filter(s => s.needs.every(n => src.has(n)));
  const mods = [...passives.flatMap(p => p.mods), ...synergies.flatMap(s => s.mods)];
  return { ids, src, actives, passives, synergies, mods };
}

// 등록하면 새로 켜질 공명 미리보기 (UI 힌트용)
export function synergyPreview(cs, abId) {
  const before = new Set(activeLoadout(cs).synergies.map(s => s.id));
  const fake = { ...cs, set: [...cs.set, abId] };
  return activeLoadout(fake).synergies.filter(s => !before.has(s.id));
}

// 이 캐릭터와 관련된 공명 목록 (필요 어빌리티 중 하나라도 접근 가능한 것)
export function relatedSynergies(cs) {
  const reach = new Set([...CHARACTERS[cs.id].innate, ...cs.learned, ...weaponAbilities(cs)]);
  return SYNERGIES.filter(s => s.needs.some(n => reach.has(n)));
}

export function canRegister(cs, id) {
  const a = ABILITIES[id];
  if (!a || a.innate || !isLearned(cs, id)) return { ok: false, why: '미습득' };
  if (cs.set.includes(id)) return { ok: true };
  if (costUsed(cs) + a.cost > capacity(cs)) return { ok: false, why: '코스트 부족' };
  return { ok: true };
}

export function toggleRegister(cs, id) {
  const i = cs.set.indexOf(id);
  if (i >= 0) { cs.set.splice(i, 1); clampHP(cs); return true; }
  if (!canRegister(cs, id).ok) return false;
  cs.set.push(id);
  return true;
}

// 전투 후 숙련: 장착 무기의 미습득 어빌리티 전부에 AP 적립
export function gainAP(cs, amount) {
  const mul = 1 + activeLoadout(cs).mods.filter(m => m.m === 'apUp').reduce((a, m) => a + m.pct, 0) / 100;
  const amt = Math.round(amount * mul);
  const learnedNow = [];
  for (const id of weaponAbilities(cs)) {
    if (isLearned(cs, id)) continue;
    cs.ap[id] = Math.min(ABILITIES[id].ap, (cs.ap[id] || 0) + amt);
    if (cs.ap[id] >= ABILITIES[id].ap) {
      cs.learned.push(id);
      learnedNow.push(id);
      // 한도 안이면 자동 등록 → 무기를 바꿔도 바로 이어서 사용
      if (canRegister(cs, id).ok) cs.set.push(id);
    }
  }
  return { amount: amt, learned: learnedNow };
}

export function gainExp(cs, amount) {
  const ups = [];
  if (cs.lv >= MAX_LEVEL) return ups;
  cs.exp += amount;
  while (cs.lv < MAX_LEVEL && cs.exp >= expForLevel(cs.lv + 1)) {
    const before = getStats(cs);
    cs.lv++;
    const after = getStats(cs);
    cs.hp += after.hp - before.hp; cs.mp += after.mp - before.mp;
    ups.push({ lv: cs.lv, before, after });
  }
  return ups;
}

export function clampHP(cs) {
  const st = getStats(cs);
  cs.hp = Math.min(cs.hp, st.hp); cs.mp = Math.min(cs.mp, st.mp);
}

export function fullHeal(cs) { const st = getStats(cs); cs.hp = st.hp; cs.mp = st.mp; }

// ── 장비 ──
export function canEquip(cs, itemId) {
  const d = CHARACTERS[cs.id];
  if (WEAPONS[itemId]) return d.weapons.includes(WEAPONS[itemId].type);
  if (ARMORS[itemId]) return d.armors.includes(ARMORS[itemId].cat);
  if (ACCESSORIES[itemId]) return true;
  return false;
}
export function slotOf(itemId) { return WEAPONS[itemId] ? 'weapon' : ARMORS[itemId] ? 'armor' : ACCESSORIES[itemId] ? 'acc' : null; }

// inv: 게임 인벤토리 {id: count}
export function equipItem(cs, inv, itemId) {
  const slot = slotOf(itemId);
  if (!slot || !canEquip(cs, itemId) || !(inv[itemId] > 0)) return false;
  const old = cs.equip[slot];
  if (old) inv[old] = (inv[old] || 0) + 1;
  inv[itemId]--; if (!inv[itemId]) delete inv[itemId];
  cs.equip[slot] = itemId;
  clampHP(cs);
  return true;
}
export function unequip(cs, inv, slot) {
  if (slot === 'weapon') return false; // 무기는 항상 하나 장착
  const old = cs.equip[slot];
  if (!old) return false;
  inv[old] = (inv[old] || 0) + 1; cs.equip[slot] = null; clampHP(cs); return true;
}

// 장착 시 스탯 변화 미리보기
export function previewEquip(cs, itemId) {
  const slot = slotOf(itemId);
  const fake = { ...cs, equip: { ...cs.equip, [slot]: itemId } };
  return { before: getStats(cs), after: getStats(fake) };
}

// 무기 한 자루의 숙련 진행도 요약 (UI)
export function weaponMastery(cs, weaponId) {
  const w = WEAPONS[weaponId];
  return w.abilities.map(id => ({ id, ab: ABILITIES[id], ap: isLearned(cs, id) ? ABILITIES[id].ap : (cs.ap[id] || 0), learned: isLearned(cs, id) }));
}
