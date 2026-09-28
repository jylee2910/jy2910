// 캐릭터 풀. weapons: 장착 가능한 무기 타입, armors: 장착 가능한 방어구 분류, innate: 고유 어빌리티
export const CHARACTERS = {
  leon: { name: '레온', job: '검사', design: 'leon', weapons: ['sword', 'greatsword'], armors: ['light', 'heavy'],
    base: { hp: 130, mp: 18, atk: 14, def: 10, mag: 5, mdf: 7, spd: 11, luk: 8 },
    growth: { hp: 15, mp: 2, atk: 2.3, def: 1.4, mag: 0.5, mdf: 0.9, spd: 0.45, luk: 0.4 },
    innate: ['dualStrike'], start: { weapon: 'bronzeSword', armor: 'leather' },
    bio: '엘름 마을의 젊은 검사. 수정이 흐려지는 이유를 찾아 길을 나선다.' },
  sera: { name: '세라', job: '힐러', design: 'sera', weapons: ['staff', 'rod'], armors: ['light', 'robe'],
    base: { hp: 95, mp: 36, atk: 7, def: 7, mag: 13, mdf: 12, spd: 10, luk: 9 },
    growth: { hp: 10, mp: 4, atk: 0.8, def: 0.9, mag: 2.0, mdf: 1.6, spd: 0.4, luk: 0.5 },
    innate: ['prayer'], start: { weapon: 'oakStaff', armor: 'mageRobe' },
    bio: '수정 신전의 견습 사제. 상냥하지만 고집이 세다.' },
  bran: { name: '브란', job: '수호기사', design: 'bran', weapons: ['sword', 'spear'], armors: ['heavy'],
    base: { hp: 160, mp: 14, atk: 12, def: 14, mag: 4, mdf: 8, spd: 8, luk: 5 },
    growth: { hp: 19, mp: 1.5, atk: 1.8, def: 2.0, mag: 0.4, mdf: 1.0, spd: 0.3, luk: 0.3 },
    innate: ['ironWall'], start: { weapon: 'knightSword', armor: 'chainMail' },
    bio: '마을 경비대장. 방패 하나로 모두를 지켜 왔다.' },
  kyle: { name: '카일', job: '마검사', design: 'kyle', weapons: ['sword', 'rod'], armors: ['light', 'robe'],
    base: { hp: 110, mp: 28, atk: 12, def: 8, mag: 11, mdf: 9, spd: 12, luk: 7 },
    growth: { hp: 12, mp: 3, atk: 1.8, def: 1.0, mag: 1.6, mdf: 1.1, spd: 0.5, luk: 0.4 },
    innate: ['enchant'], start: { weapon: 'apprenticeRod', armor: 'leather' },
    bio: '떠돌이 마검사. 검에 마법을 싣는 기묘한 기술을 쓴다.' },
  rhea: { name: '리아', job: '용기사', design: 'rhea', weapons: ['spear', 'greatsword'], armors: ['light', 'heavy'],
    base: { hp: 125, mp: 20, atk: 15, def: 11, mag: 5, mdf: 7, spd: 13, luk: 8 },
    growth: { hp: 14, mp: 2, atk: 2.4, def: 1.3, mag: 0.5, mdf: 0.8, spd: 0.55, luk: 0.4 },
    innate: ['jump'], start: { weapon: 'ironSpear', armor: 'scaleVest' },
    bio: '하늘을 나는 창술의 계승자. 숲의 주인을 쫓아 마을에 왔다.' },
};

export const PARTY_SIZE = 3;
export const MAX_LEVEL = 30;
export function expForLevel(lv) { return Math.floor(18 * Math.pow(lv - 1, 1.75)); } // lv 도달 누적 경험치
export function abilityCapacity(lv) { return 3 + Math.floor(lv / 2); }            // 어빌리티 코스트 한도
