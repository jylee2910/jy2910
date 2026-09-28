// 무기 / 방어구 / 장신구 / 소모품 / 중요 아이템
// 무기: type(검/대검/창/지팡이/로드), stats, abilities(이 무기로 숙련할 수 있는 어빌리티), tint(도트 색 변경)
export const WEAPONS = {
  // 검
  bronzeSword: { name: '브론즈 소드', type: 'sword', price: 80, stats: { atk: 8 }, abilities: ['powerSlash', 'hpUp'], desc: '견습 검사의 검.' },
  knightSword: { name: '수호자의 검', type: 'sword', price: 260, stats: { atk: 12, def: 4 }, abilities: ['provoke', 'cover'], tint: { W: 'goldL', b: 'gold', T: 'blue', G: 'blueL' }, desc: '동료를 지키는 기사의 맹세가 깃든 검.' },
  flameTongue: { name: '홍염검', type: 'sword', price: 620, stats: { atk: 17 }, abilities: ['fireSlash', 'fireBoost'], tint: { W: 'fireL', b: 'fireS', B: 'fire', G: 'fire' }, desc: '칼날에 꺼지지 않는 불씨가 산다.' },
  frostBlade: { name: '빙설검', type: 'sword', price: 640, stats: { atk: 18, spd: 2 }, abilities: ['iceSlash', 'counter'], tint: { W: 'iceL', b: 'iceS', B: 'ice', G: 'ice' }, desc: '서리가 서린 푸른 칼.' },
  thunderBlade: { name: '뇌명검', type: 'sword', price: 0, stats: { atk: 26, luk: 4 }, abilities: ['boltSlash', 'critUp'], tint: { W: 'boltL', b: 'boltS', B: 'bolt', G: 'bolt', T: 'darkMetal' }, desc: '휘두를 때마다 천둥이 운다.' },
  // 대검
  ironClaymore: { name: '강철 대검', type: 'greatsword', price: 240, stats: { atk: 15, spd: -1 }, abilities: ['groundSplit', 'atkUp'], desc: '무겁지만 믿음직한 대검.' },
  breaker: { name: '파쇄대검', type: 'greatsword', price: 0, stats: { atk: 24, spd: -2 }, abilities: ['shatter', 'breakDmg'], tint: { W: 'stoneL', B: 'stone', b: 'stoneS', T: 'darkMetal', G: 'magenta' }, desc: '바위도 깨부수는 둔중한 칼날.' },
  // 창
  ironSpear: { name: '철창', type: 'spear', price: 90, stats: { atk: 10, spd: 1 }, abilities: ['pierceThrust', 'spdUp'], desc: '곧게 뻗은 철제 창.' },
  galeSpear: { name: '폭풍창', type: 'spear', price: 600, stats: { atk: 17, spd: 3 }, abilities: ['galeLance', 'highJump'], tint: { W: 'windL', B: 'wind', b: 'windS', G: 'wind' }, desc: '바람을 가르는 초록 창날.' },
  holyLance: { name: '성창 루미나', type: 'spear', price: 0, stats: { atk: 23, mdf: 4 }, abilities: ['lightLance', 'drain'], tint: { W: 'white', B: 'light', b: 'lightS', G: 'crystal', T: 'gold' }, desc: '빛을 머금은 성스러운 창.' },
  // 지팡이
  oakStaff: { name: '떡갈나무 지팡이', type: 'staff', price: 70, stats: { mag: 6, atk: 3 }, abilities: ['cure', 'scan'], tint: { G: 'green', g: 'greenS', W: 'greenL' }, desc: '마을 약사가 깎아 준 지팡이.' },
  lightStaff: { name: '성광의 지팡이', type: 'staff', price: 580, stats: { mag: 12, mdf: 4, atk: 4 }, abilities: ['holy', 'healUp'], tint: { G: 'light', g: 'lightS', W: 'white' }, desc: '끝에 작은 태양이 깃들어 있다.' },
  lifeStaff: { name: '생명의 지팡이', type: 'staff', price: 0, stats: { mag: 16, mdf: 6, atk: 5 }, abilities: ['cureAll', 'raise', 'regen'], tint: { G: 'flowerPink', g: 'magentaS', W: 'white', T: 'green' }, desc: '숲의 생명력이 흐르는 지팡이.' },
  // 로드
  apprenticeRod: { name: '견습 로드', type: 'rod', price: 90, stats: { mag: 7, atk: 2 }, abilities: ['fire', 'ice', 'apUp'], tint: { G: 'fire', g: 'fireS', W: 'fireL' }, desc: '마법 학교의 첫 로드.' },
  stormRod: { name: '폭풍 로드', type: 'rod', price: 560, stats: { mag: 12, atk: 3 }, abilities: ['thunder', 'gust', 'magUp'], tint: { G: 'bolt', g: 'boltS', W: 'boltL' }, desc: '구름을 부르는 로드.' },
  shadowRod: { name: '그림자 로드', type: 'rod', price: 0, stats: { mag: 18, atk: 4, mp: 10 }, abilities: ['darkOrb', 'weakMp', 'mpSave'], tint: { G: 'dark', g: 'darkS', W: 'darkL', T: 'darkMetal' }, desc: '밤의 조각을 깎아 만든 로드.' },
};

export const ARMORS = {
  leather: { name: '가죽 갑옷', cat: 'light', price: 60, stats: { def: 4 } },
  mageRobe: { name: '마도 로브', cat: 'robe', price: 90, stats: { def: 2, mdf: 5, mag: 2 } },
  chainMail: { name: '사슬 갑옷', cat: 'heavy', price: 150, stats: { def: 9, spd: -1 } },
  scaleVest: { name: '비늘 조끼', cat: 'light', price: 380, stats: { def: 9, spd: 1 } },
  silkRobe: { name: '비단 로브', cat: 'robe', price: 420, stats: { def: 5, mdf: 10, mag: 4 } },
  mithril: { name: '미스릴 갑옷', cat: 'heavy', price: 520, stats: { def: 15, mdf: 5 } },
};

export const ACCESSORIES = {
  powerRing: { name: '힘의 반지', price: 300, stats: { atk: 5 } },
  guardCharm: { name: '수호 부적', price: 300, stats: { def: 4, mdf: 4 } },
  swiftBoots: { name: '질풍의 장화', price: 0, stats: { spd: 5 } },
  sageBrooch: { name: '현자의 브로치', price: 0, stats: { mag: 6, mp: 15 } },
  luckyClover: { name: '네잎 클로버', price: 0, stats: { luk: 12 } },
};

// 소모품: effect = {hp, hpPct, mp, revive, cure}
export const CONSUMABLES = {
  potion: { name: '포션', icon: 'potion', price: 30, effect: { hp: 120 }, target: 'ally', desc: 'HP를 120 회복' },
  hiPotion: { name: '하이포션', icon: 'hipotion', price: 110, effect: { hp: 400 }, target: 'ally', desc: 'HP를 400 회복' },
  ether: { name: '에테르', icon: 'ether', price: 150, effect: { mp: 30 }, target: 'ally', desc: 'MP를 30 회복' },
  feather: { name: '생명의 깃털', icon: 'feather', price: 300, effect: { revive: 30 }, target: 'allyKO', desc: '쓰러진 아군을 HP 30%로 소생' },
  antidote: { name: '해독초', icon: 'herb', price: 20, effect: { cure: true }, target: 'ally', desc: '독을 치료' },
};

export const KEY_ITEMS = {
  moonHerb: { name: '달빛 약초', icon: 'herb', desc: '달빛을 받아 은은하게 빛나는 약초.' },
  crystalShard: { name: '수정 조각', icon: 'shard', desc: '동굴 깊은 곳의 맑은 수정 조각.' },
};

export const ARMOR_ICON = 'armor', ACC_ICON = 'ring';

export function itemInfo(id) {
  if (WEAPONS[id]) return { ...WEAPONS[id], id, cat: 'weapon' };
  if (ARMORS[id]) return { ...ARMORS[id], id, cat: 'armor', armorCat: ARMORS[id].cat };
  if (ACCESSORIES[id]) return { ...ACCESSORIES[id], id, cat: 'acc' };
  if (CONSUMABLES[id]) return { ...CONSUMABLES[id], id, cat: 'item' };
  if (KEY_ITEMS[id]) return { ...KEY_ITEMS[id], id, cat: 'key' };
  return null;
}
