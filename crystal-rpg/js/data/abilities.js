// ─────────────────────────────────────────────────────────────
//  어빌리티 데이터. 여기에 항목을 추가하고 무기 abilities에 id를 넣으면 끝.
//
//  공통: id(키), name, kind:'active'|'passive', cost(등록 코스트), ap(습득 필요 숙련), desc
//  액티브: mp, target('enemy'|'enemies'|'ally'|'allies'|'self'|'allyKO'),
//          type('phys'|'mag'|'heal'|'support'), elem, power, hits, random(무작위 대상 연타),
//          effects: [{t:'buff'|'debuff', stat, pct, turns}, {t:'status', s, chance, turns},
//                    {t:'regen', pct, turns}, {t:'revive', pct}, {t:'shield', n}(추가 실드 감소),
//                    {t:'delay', n}(턴 지연), {t:'provoke', turns}, {t:'scan'}, {t:'cleanse'},
//                    {t:'drain', pct}, {t:'jump'}(공중으로 도약 후 다음 턴 착지)]
//          fx: 연출 키, tags: 시너지/패시브 판정용
//  패시브: mods: [{m:'stat', stat, pct} | {m:'elemDmg', elem, pct} | {m:'tagDmg', tag, pct}
//          | {m:'tagShield', tag, n} | {m:'elemShield', elem, n} | {m:'critElem', elem, pct}
//          | {m:'counter', chance} | {m:'cover'} | {m:'regen', pct} | {m:'breakDmg', pct}
//          | {m:'weakMp', n} | {m:'weakDmg', pct} | {m:'enchant', turns} | {m:'enchantHits', n}
//          | {m:'crit', pct} | {m:'healUp', pct} | {m:'healRegen', turns} | {m:'mpCost', pct}
//          | {m:'apUp', pct} | {m:'guardHeal', pct} | {m:'lowHpDmg', pct} | {m:'startBuff', stat, pct, turns}]
// ─────────────────────────────────────────────────────────────
export const ABILITIES = {
  // ── 고유 (캐릭터 전용, 항상 사용 가능) ──
  dualStrike: { name: '연속베기', kind: 'active', innate: true, mp: 4, target: 'enemy', type: 'phys', power: 0.85, hits: 2, fx: 'slash2',
    desc: '무기로 두 번 벤다. 약점을 찌르면 실드를 2 깎는다.' },
  prayer: { name: '기도', kind: 'active', innate: true, mp: 6, target: 'allies', type: 'heal', power: 0.7, fx: 'heal', anim: 'cast',
    desc: '아군 전체의 HP를 조금 회복한다.' },
  enchant: { name: '마법검', kind: 'passive', innate: true, mods: [{ m: 'enchant', turns: 3 }],
    desc: '속성 마법을 쓰면 3턴 동안 일반 공격에 그 속성이 깃든다.' },
  jump: { name: '도약', kind: 'active', innate: true, mp: 5, target: 'enemy', type: 'phys', elem: 'pierce', power: 2.1, fx: 'jump', effects: [{ t: 'jump' }], tags: ['jump'],
    desc: '하늘 높이 뛰어올라 공격을 피하고, 다음 턴에 내리꽂는다.' },
  ironWall: { name: '철벽', kind: 'active', innate: true, mp: 5, target: 'self', type: 'support', fx: 'guard', anim: 'guard',
    effects: [{ t: 'buff', stat: 'def', pct: 60, turns: 3 }, { t: 'provoke', turns: 3 }],
    desc: '방어력을 크게 올리고 적의 공격을 자신에게 끌어들인다.' },

  // ── 검 ──
  powerSlash: { name: '강베기', kind: 'active', cost: 2, ap: 10, mp: 3, target: 'enemy', type: 'phys', power: 1.7, fx: 'slashBig',
    desc: '힘을 실어 크게 벤다.' },
  hpUp: { name: '체력 강화', kind: 'passive', cost: 1, ap: 12, mods: [{ m: 'stat', stat: 'hp', pct: 12 }], desc: '최대 HP +12%' },
  fireSlash: { name: '화염참', kind: 'active', cost: 2, ap: 18, mp: 5, target: 'enemy', type: 'phys', elem: 'fire', power: 1.5, fx: 'fireSlash', tags: ['fire'],
    desc: '불꽃을 두른 칼날로 벤다. (불 속성 물리)' },
  fireBoost: { name: '불꽃 강화', kind: 'passive', cost: 2, ap: 22, mods: [{ m: 'elemDmg', elem: 'fire', pct: 30 }], desc: '불 속성 피해 +30%' },
  iceSlash: { name: '빙결참', kind: 'active', cost: 2, ap: 20, mp: 5, target: 'enemy', type: 'phys', elem: 'ice', power: 1.4, fx: 'iceSlash', tags: ['ice'],
    effects: [{ t: 'delay', n: 25 }], desc: '얼음 칼날로 베어 적의 행동을 늦춘다.' },
  counter: { name: '반격', kind: 'passive', cost: 3, ap: 28, mods: [{ m: 'counter', chance: 30 }], desc: '물리 공격을 받으면 30% 확률로 반격한다.' },
  provoke: { name: '도발', kind: 'active', cost: 1, ap: 10, mp: 2, target: 'self', type: 'support', fx: 'guard', anim: 'guard',
    effects: [{ t: 'provoke', turns: 3 }], desc: '3턴 동안 적의 단일 공격을 자신에게 끌어들인다.' },
  cover: { name: '수호', kind: 'passive', cost: 2, ap: 20, mods: [{ m: 'cover' }], desc: 'HP가 낮은 아군을 대신해 물리 공격을 받는다.' },
  boltSlash: { name: '뇌격참', kind: 'active', cost: 3, ap: 26, mp: 7, target: 'enemy', type: 'phys', elem: 'bolt', power: 1.4, hits: 2, fx: 'boltSlash', tags: ['bolt'],
    desc: '번개를 실어 두 번 벤다.' },
  critUp: { name: '치명 강화', kind: 'passive', cost: 2, ap: 24, mods: [{ m: 'crit', pct: 15 }], desc: '치명타 확률 +15%' },

  // ── 대검 ──
  groundSplit: { name: '대지 가르기', kind: 'active', cost: 3, ap: 16, mp: 7, target: 'enemies', type: 'phys', power: 0.95, fx: 'quake',
    desc: '땅을 갈라 적 전체를 벤다.' },
  atkUp: { name: '공격 강화', kind: 'passive', cost: 2, ap: 16, mods: [{ m: 'stat', stat: 'atk', pct: 10 }], desc: '공격력 +10%' },
  shatter: { name: '파쇄격', kind: 'active', cost: 2, ap: 22, mp: 6, target: 'enemy', type: 'phys', elem: 'strike', power: 1.3, fx: 'shatter',
    effects: [{ t: 'shield', n: 2 }], desc: '실드를 부수는 일격. 약점과 무관하게 실드 2 감소.' },
  breakDmg: { name: '브레이크 추격', kind: 'passive', cost: 2, ap: 24, mods: [{ m: 'breakDmg', pct: 40 }], desc: '브레이크 상태의 적에게 주는 피해 +40%' },

  // ── 창 ──
  pierceThrust: { name: '꿰뚫기', kind: 'active', cost: 2, ap: 12, mp: 4, target: 'enemy', type: 'phys', power: 1.6, fx: 'thrust',
    effects: [{ t: 'debuff', stat: 'def', pct: 25, turns: 3 }], desc: '갑옷을 꿰뚫어 방어력을 낮춘다.' },
  spdUp: { name: '민첩 강화', kind: 'passive', cost: 1, ap: 14, mods: [{ m: 'stat', stat: 'spd', pct: 12 }], desc: '민첩 +12%' },
  galeLance: { name: '질풍창', kind: 'active', cost: 3, ap: 22, mp: 7, target: 'enemies', type: 'phys', elem: 'wind', power: 0.65, hits: 3, random: true, fx: 'wind', tags: ['wind'],
    desc: '바람을 두른 창으로 무작위 적을 3번 찌른다.' },
  highJump: { name: '고공 낙하', kind: 'passive', cost: 2, ap: 22, mods: [{ m: 'tagDmg', tag: 'jump', pct: 50 }], desc: '도약 피해 +50%' },
  lightLance: { name: '성창', kind: 'active', cost: 3, ap: 26, mp: 8, target: 'enemy', type: 'phys', elem: 'light', power: 1.7, fx: 'light', tags: ['light'],
    desc: '빛의 창을 내리꽂는다. (빛 속성 물리)' },
  drain: { name: '생명 흡수', kind: 'passive', cost: 2, ap: 24, mods: [{ m: 'drain', pct: 12 }], desc: '물리 피해의 12%만큼 HP 회복' },

  // ── 지팡이 ──
  cure: { name: '치유', kind: 'active', cost: 1, ap: 8, mp: 5, target: 'ally', type: 'heal', power: 1.5, fx: 'heal', anim: 'cast', tags: ['heal'],
    desc: '아군 한 명의 HP를 회복한다.' },
  scan: { name: '간파', kind: 'active', cost: 1, ap: 10, mp: 2, target: 'enemy', type: 'support', fx: 'scan', anim: 'cast',
    effects: [{ t: 'scan' }], desc: '적의 약점과 내성을 모두 밝혀낸다.' },
  holy: { name: '성광', kind: 'active', cost: 2, ap: 20, mp: 8, target: 'enemy', type: 'mag', elem: 'light', power: 1.6, fx: 'light', anim: 'cast', tags: ['light'],
    desc: '성스러운 빛으로 적을 태운다.' },
  healUp: { name: '회복 강화', kind: 'passive', cost: 2, ap: 20, mods: [{ m: 'healUp', pct: 30 }], desc: '회복량 +30%' },
  cureAll: { name: '광역 치유', kind: 'active', cost: 3, ap: 24, mp: 12, target: 'allies', type: 'heal', power: 1.1, fx: 'heal', anim: 'cast', tags: ['heal'],
    desc: '아군 전체의 HP를 회복한다.' },
  raise: { name: '소생', kind: 'active', cost: 2, ap: 22, mp: 14, target: 'allyKO', type: 'heal', fx: 'raise', anim: 'cast',
    effects: [{ t: 'revive', pct: 40 }], desc: '쓰러진 아군을 HP 40%로 되살린다.' },
  regen: { name: '재생의 기도', kind: 'active', cost: 2, ap: 20, mp: 7, target: 'ally', type: 'support', fx: 'heal', anim: 'cast',
    effects: [{ t: 'regen', pct: 8, turns: 4 }, { t: 'cleanse' }], desc: '4턴 동안 매 턴 HP 8% 회복. 상태이상 해제.' },

  // ── 로드 ──
  fire: { name: '화염구', kind: 'active', cost: 1, ap: 10, mp: 5, target: 'enemy', type: 'mag', elem: 'fire', power: 1.4, fx: 'fire', anim: 'cast', tags: ['fire', 'spell'],
    desc: '불덩이를 날린다.' },
  ice: { name: '빙창', kind: 'active', cost: 1, ap: 10, mp: 5, target: 'enemy', type: 'mag', elem: 'ice', power: 1.4, fx: 'ice', anim: 'cast', tags: ['ice', 'spell'],
    desc: '얼음 창을 쏘아낸다.' },
  thunder: { name: '뇌운', kind: 'active', cost: 1, ap: 14, mp: 6, target: 'enemy', type: 'mag', elem: 'bolt', power: 1.5, fx: 'bolt', anim: 'cast', tags: ['bolt', 'spell'],
    desc: '번개를 떨어뜨린다.' },
  gust: { name: '질풍', kind: 'active', cost: 2, ap: 18, mp: 9, target: 'enemies', type: 'mag', elem: 'wind', power: 1.0, fx: 'wind', anim: 'cast', tags: ['wind', 'spell'],
    desc: '돌풍으로 적 전체를 벤다.' },
  darkOrb: { name: '암흑구', kind: 'active', cost: 2, ap: 22, mp: 9, target: 'enemy', type: 'mag', elem: 'dark', power: 1.8, fx: 'dark', anim: 'cast', tags: ['dark', 'spell'],
    desc: '모든 것을 삼키는 어둠의 구체.' },
  weakMp: { name: '공명 흡수', kind: 'passive', cost: 1, ap: 16, mods: [{ m: 'weakMp', n: 3 }], desc: '약점을 찌를 때마다 MP 3 회복' },
  mpSave: { name: 'MP 절약', kind: 'passive', cost: 2, ap: 22, mods: [{ m: 'mpCost', pct: -30 }], desc: '소비 MP -30%' },
  magUp: { name: '마력 강화', kind: 'passive', cost: 2, ap: 18, mods: [{ m: 'stat', stat: 'mag', pct: 12 }], desc: '마력 +12%' },

  // ── 장신구 없이 무기에서만 얻는 유틸 ──
  apUp: { name: '숙련 가속', kind: 'passive', cost: 1, ap: 15, mods: [{ m: 'apUp', pct: 50 }], desc: '전투 후 얻는 숙련 포인트 +50%' },
  guardHeal: { name: '호흡법', kind: 'passive', cost: 1, ap: 12, mods: [{ m: 'guardHeal', pct: 10 }], desc: '방어하면 최대 HP의 10%를 회복' },
  lastStand: { name: '배수의 진', kind: 'passive', cost: 2, ap: 20, mods: [{ m: 'lowHpDmg', pct: 50 }], desc: 'HP 30% 이하일 때 주는 피해 +50%' },
};

// ─────────────────────────────────────────────────────────────
//  공명(시너지): needs의 어빌리티가 한 캐릭터에 동시에 활성화되면 발동
// ─────────────────────────────────────────────────────────────
export const SYNERGIES = [
  { id: 'crimson', name: '홍련검', needs: ['fireSlash', 'fireBoost'],
    mods: [{ m: 'critElem', elem: 'fire', pct: 30 }, { m: 'elemShield', elem: 'fire', n: 1 }],
    desc: '불 속성 공격의 치명타 +30%, 약점 적중 시 실드 추가 1 감소' },
  { id: 'unyield', name: '불굴의 방패', needs: ['counter', 'cover'],
    mods: [{ m: 'counter', chance: 40 }, { m: 'stat', stat: 'def', pct: 10 }],
    desc: '반격 확률 +40%, 방어력 +10%' },
  { id: 'skyfall', name: '천공낙하', needs: ['highJump', 'jump'],
    mods: [{ m: 'tagShield', tag: 'jump', n: 2 }],
    desc: '도약 적중 시 실드 추가 2 감소' },
  { id: 'lifeTide', name: '생명의 물결', needs: ['healUp', 'cureAll'],
    mods: [{ m: 'healRegen', turns: 2 }],
    desc: '회복 마법이 2턴간 재생 효과를 함께 부여' },
  { id: 'arcCircuit', name: '마력 회로', needs: ['weakMp', 'magUp'],
    mods: [{ m: 'weakDmg', pct: 25 }],
    desc: '약점 공격 피해 +25%' },
  { id: 'spellsword', name: '마검 연무', needs: ['enchant', 'atkUp'],
    mods: [{ m: 'enchantHits', n: 1 }],
    desc: '마법검 상태의 일반 공격이 2회 공격이 된다' },
  { id: 'crusher', name: '파쇄 연계', needs: ['shatter', 'breakDmg'],
    mods: [{ m: 'breakDmg', pct: 25 }, { m: 'tagShield', tag: 'shatter', n: 1 }],
    desc: '브레이크 추가 피해 +25%, 파쇄격 실드 감소 +1' },
  { id: 'stormEdge', name: '뇌풍일섬', needs: ['boltSlash', 'critUp'],
    mods: [{ m: 'critElem', elem: 'bolt', pct: 25 }, { m: 'elemDmg', elem: 'bolt', pct: 15 }],
    desc: '번개 속성 치명타 +25%, 번개 피해 +15%' },
];

for (const [id, a] of Object.entries(ABILITIES)) { a.id = id; a.tags = a.tags || []; if (!a.tags.includes(id)) a.tags.push(id); }
