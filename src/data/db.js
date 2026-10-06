// Game database: heroes, skills, echoes (legendary hero spirits), enemies, items.
// element keys: fire ice thunder water wind earth light dark (null = none)

export const ELEMENTS = {
  fire: { name: '화염', color: '#ff7a3a' },
  ice: { name: '냉기', color: '#7ad8ff' },
  thunder: { name: '번개', color: '#c8a8ff' },
  light: { name: '빛', color: '#ffe48a' },
  dark: { name: '어둠', color: '#d07ae8' },
  wind: { name: '바람', color: '#9af0b0' },
};

// --------------------------------------------------------------- skills
// type: phys | mag | heal | buff | revive | item
// target: enemy | enemies | ally | allies | self | ko
export const SKILLS = {
  attack: { name: '싸우기', type: 'phys', target: 'enemy', power: 1.0, brk: 12, mp: 0, fx: 'slash', desc: '장착한 무기로 물리 공격을 가한다.', delay: 0 },
  // Kael
  braver: { name: '브레이버', type: 'phys', target: 'enemy', power: 1.9, brk: 30, mp: 12, fx: 'slash_x', desc: '[검기] 혼신의 일격. 브레이크 효과가 높다.', delay: 20 },
  thunder_surge: { name: '썬더 서지', type: 'phys', target: 'enemy', power: 1.35, brk: 18, mp: 6, el: 'thunder', fx: 'thunder', desc: '[마법검] 번개 속성의 물리 공격.', delay: 5 },
  // Argen
  flash_cut: { name: '섬광베기', type: 'phys', target: 'enemy', power: 1.15, brk: 14, mp: 5, fx: 'slash', desc: '[발도] 빠른 일섬. 다음 차례가 빨리 온다.', delay: -25 },
  moon_fang: { name: '월영참', type: 'phys', target: 'enemy', power: 0.7, hits: 3, brk: 10, mp: 14, el: 'dark', fx: 'dark', desc: '[발도] 어둠 속성 3연격.', delay: 15 },
  // Mira
  heal: { name: '힐', type: 'heal', target: 'ally', power: 1.6, mp: 6, fx: 'heal', desc: '[백마법] 아군 한 명의 HP를 회복한다.', delay: 0 },
  holy_light: { name: '홀리 라이트', type: 'mag', target: 'enemy', power: 1.4, brk: 16, mp: 8, el: 'light', fx: 'holy', desc: '[백마법] 빛 속성 마법 공격.', delay: 5 },
  // Nell
  gear_smash: { name: '기어 스매시', type: 'phys', target: 'enemy', power: 1.25, brk: 34, mp: 8, fx: 'hit', desc: '[기공] 육중한 타격. 브레이크 효과가 매우 높다.', delay: 15 },
  firebomb: { name: '화염병', type: 'mag', target: 'enemies', power: 0.85, brk: 10, mp: 10, el: 'fire', fx: 'fire', desc: '[기공] 적 전체에 화염 속성 공격.', delay: 10 },
  first_aid: { name: '응급처치', type: 'heal', target: 'ally', power: 1.0, mp: 4, fx: 'heal', desc: '[기공] 아군 HP를 조금 회복한다.', delay: -10 },
  // Echo: Astrea (paladin)
  holy_blade: { name: '홀리 블레이드', type: 'phys', target: 'enemy', power: 1.7, brk: 22, mp: 14, el: 'light', fx: 'holy', desc: '[에코: 아스트레아] 빛 속성 성검 일격.', delay: 10 },
  protect: { name: '프로텍트', type: 'buff', target: 'allies', stat: 'def', amount: 0.3, turns: 4, mp: 12, fx: 'buff', desc: '[에코: 아스트레아] 아군 전체의 방어력을 올린다.', delay: 5 },
  // Echo: Liriel (saint)
  curaga: { name: '케어라', type: 'heal', target: 'allies', power: 1.3, mp: 16, fx: 'heal', desc: '[에코: 리리엘] 아군 전체의 HP를 회복한다.', delay: 10 },
  raise: { name: '레이즈', type: 'revive', target: 'ko', power: 0.4, mp: 20, fx: 'holy', desc: '[에코: 리리엘] 전투불능인 아군을 되살린다.', delay: 10 },
  // Echo: Voltaire (sage)
  fira: { name: '파이라', type: 'mag', target: 'enemy', power: 1.8, brk: 20, mp: 12, el: 'fire', fx: 'fire', desc: '[에코: 볼테르] 화염 속성 중급 마법.', delay: 10 },
  blizzara: { name: '블리자라', type: 'mag', target: 'enemy', power: 1.8, brk: 20, mp: 12, el: 'ice', fx: 'ice', desc: '[에코: 볼테르] 냉기 속성 중급 마법.', delay: 10 },
  thundara: { name: '썬더라', type: 'mag', target: 'enemies', power: 1.1, brk: 14, mp: 18, el: 'thunder', fx: 'thunder', desc: '[에코: 볼테르] 적 전체에 번개 속성 마법.', delay: 15 },
  // enemy skills
  claw: { name: '할퀴기', type: 'phys', target: 'enemy', power: 1.0, fx: 'hit_red' },
  dark_ball: { name: '다크 볼', type: 'mag', target: 'enemy', power: 1.1, el: 'dark', fx: 'dark' },
  bite: { name: '물어뜯기', type: 'phys', target: 'enemy', power: 1.15, fx: 'hit_red' },
  howl: { name: '하울링', type: 'buff', target: 'self', stat: 'atk', amount: 0.3, turns: 3, fx: 'debuff' },
  pinch: { name: '집게 공격', type: 'phys', target: 'enemy', power: 1.25, fx: 'hit_red' },
  ember_shot: { name: '불꽃탄', type: 'mag', target: 'enemy', power: 1.1, el: 'fire', fx: 'fire' },
  tail_lash: { name: '꼬리 후려치기', type: 'phys', target: 'enemies', power: 0.8, fx: 'hit_red' },
  flame_breath: { name: '화염 브레스', type: 'mag', target: 'enemies', power: 1.05, el: 'fire', fx: 'fire' },
  roar: { name: '포효', type: 'buff', target: 'self', stat: 'atk', amount: 0.35, turns: 3, fx: 'debuff' },
  dive: { name: '급강하', type: 'phys', target: 'enemy', power: 1.8, fx: 'hit_red' },
};

// --------------------------------------------------------------- echoes
export const ECHOES = {
  astrea: {
    name: '아스트레아', title: '빛의 성기사', sprite: 'echo_paladin', portrait: 'echo_paladin', color: 0x8ad0ff,
    job: '나이트', bonus: { hp: 60, def: 8, atk: 4 }, skills: ['holy_blade', 'protect'],
    resonance: { name: '아스트랄 브레이버', desc: '성기사의 검이 하늘을 가른다. 적 하나에 빛 속성 극대 피해.', type: 'phys', target: 'enemy', power: 5.2, brk: 120, el: 'light', fx: 'holy' },
    lore: '먼 옛날 크리스탈을 지켜낸 기사단의 시조. 그 검은 별빛을 품었다고 전해진다.',
  },
  liriel: {
    name: '리리엘', title: '새벽의 성녀', sprite: 'echo_saint', portrait: 'echo_saint', color: 0x9affc8,
    job: '힐러', bonus: { mp: 30, mag: 6, mdf: 10 }, skills: ['curaga', 'raise'],
    resonance: { name: '세인트 블레스', desc: '성녀의 축복. 아군 전원 완전 회복 및 전투불능 회복.', type: 'heal', target: 'allies', power: 99, fx: 'heal', full: true },
    lore: '역병의 시대에 수많은 생명을 구한 성녀. 그녀의 기도는 지금도 크리스탈에 울린다.',
  },
  voltaire: {
    name: '볼테르', title: '심연의 현자', sprite: 'echo_sage', portrait: 'echo_sage', color: 0xffb070,
    job: '흑마도사', bonus: { mag: 12, mp: 20 }, skills: ['fira', 'blizzara', 'thundara'],
    resonance: { name: '메테오 레인', desc: '하늘에서 운석을 불러낸다. 적 전체에 무속성 극대 피해.', type: 'mag', target: 'enemies', power: 3.4, brk: 80, fx: 'fire' },
    lore: '별의 궤도를 읽었다는 대마도사. 금단의 마법 「메테오」를 봉인한 장본인.',
  },
};

// --------------------------------------------------------------- heroes
export const HEROES = {
  kael: {
    name: '카엘', title: '비공정 부대장', sprite: 'kael', role: '디펜더', level: 5,
    base: { hp: 420, mp: 48, atk: 38, def: 28, mag: 16, mdf: 20, spd: 22 },
    grow: { hp: 34, mp: 3, atk: 3, def: 2.4, mag: 1.2, mdf: 1.6, spd: 0.8 },
    skills: ['braver', 'thunder_surge'], weapon: '크림슨 세이버', armor: '레더 아머', acc: '체력의 이어링',
    color: '#f2c84a',
  },
  argen: {
    name: '아르젠', title: '검성의 제자', sprite: 'argen', role: '어태커', level: 5,
    base: { hp: 360, mp: 52, atk: 44, def: 20, mag: 20, mdf: 18, spd: 28 },
    grow: { hp: 28, mp: 3, atk: 3.6, def: 1.6, mag: 1.4, mdf: 1.4, spd: 1.1 },
    skills: ['flash_cut', 'moon_fang'], weapon: '무라사메', armor: '흑요 코트', acc: '은빛 머리끈',
    color: '#a080e0',
  },
  mira: {
    name: '미라', title: '수습 백마도사', sprite: 'mira', role: '힐러', level: 5,
    base: { hp: 300, mp: 92, atk: 16, def: 16, mag: 40, mdf: 34, spd: 20 },
    grow: { hp: 22, mp: 6, atk: 1, def: 1.2, mag: 3.2, mdf: 2.6, spd: 0.8 },
    skills: ['heal', 'holy_light'], weapon: '크리스탈 로드', armor: '견습 로브', acc: '분홍 리본',
    color: '#f08ab0',
  },
  nell: {
    name: '넬', title: '떠돌이 기공사', sprite: 'nell', role: '브레이커', level: 5,
    base: { hp: 340, mp: 44, atk: 32, def: 22, mag: 24, mdf: 20, spd: 31 },
    grow: { hp: 26, mp: 3, atk: 2.6, def: 1.8, mag: 1.8, mdf: 1.6, spd: 1.2 },
    skills: ['gear_smash', 'firebomb', 'first_aid'], weapon: '기어 해머', armor: '작업 재킷', acc: '황동 고글',
    color: '#ff8a3a',
  },
};

// --------------------------------------------------------------- enemies
export const ENEMIES = {
  imp: { name: '임프', sprite: 'm_imp', hp: 210, atk: 26, def: 14, mag: 22, mdf: 12, spd: 18, brk: 60, weak: ['light', 'fire'], resist: ['dark'], skills: [['claw', 3], ['dark_ball', 1]], exp: 24, gold: 18, scale: 1.0 },
  wolf: { name: '황혼 늑대', sprite: 'm_wolf', hp: 280, atk: 32, def: 16, mag: 10, mdf: 10, spd: 26, brk: 70, weak: ['fire'], resist: [], skills: [['bite', 4], ['howl', 1]], exp: 30, gold: 22, scale: 1.0 },
  crawler: { name: '가시 갑각게', sprite: 'm_crawler', hp: 620, atk: 38, def: 34, mag: 10, mdf: 14, spd: 14, brk: 150, weak: ['thunder'], resist: ['fire'], skills: [['pinch', 1]], exp: 60, gold: 50, scale: 1.0 },
  ember: { name: '불꽃 정령', sprite: 'm_ember', hp: 200, atk: 18, def: 14, mag: 30, mdf: 22, spd: 24, brk: 55, weak: ['ice'], resist: ['fire'], absorb: ['fire'], skills: [['ember_shot', 1]], exp: 28, gold: 20, scale: 1.0 },
  wyvern: {
    name: '고룡 그림윙', sprite: 'm_wyvern', hp: 4200, atk: 48, def: 30, mag: 40, mdf: 26, spd: 24, brk: 420, weak: ['ice', 'thunder'], resist: ['fire'], boss: true,
    skills: [['tail_lash', 2], ['dive', 2], ['flame_breath', 2], ['roar', 1]], exp: 600, gold: 500, scale: 1.0,
  },
};

export const ITEMS = {
  potion: { name: '회복약', desc: '아군 한 명의 HP를 250 회복한다.', type: 'heal', target: 'ally', amount: 250, fx: 'heal' },
  ether: { name: '마나수', desc: '아군 한 명의 MP를 40 회복한다.', type: 'mp', target: 'ally', amount: 40, fx: 'buff' },
  phoenix: { name: '불사조의 깃털', desc: '전투불능인 아군을 HP 30%로 되살린다.', type: 'revive', target: 'ko', amount: 0.3, fx: 'holy' },
};

// battle formations (enemy groups) -------------------------------------------
export const TROOPS = {
  tut_imps: { enemies: ['imp', 'imp'], arena: 'plains', tutorial: 'basic' },
  wolves: { enemies: ['wolf', 'wolf', 'imp'], arena: 'plains', tutorial: 'break' },
  plains_mix: { enemies: ['imp', 'ember', 'imp'], arena: 'plains' },
  crawler: { enemies: ['crawler'], arena: 'plains' },
  embers: { enemies: ['ember', 'ember'], arena: 'plains' },
  boss: { enemies: ['wyvern'], arena: 'shrine', boss: true, tutorial: 'resonance', noEscape: true },
};

export function expForLevel(lv) {
  return Math.round(40 * lv * lv + 60 * lv);
}
