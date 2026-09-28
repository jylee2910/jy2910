// 공격 속성: 물리 3종(무기 타입) + 원소 6종
export const ELEMENTS = {
  slash: { name: '베기', icon: 'slash', color: '#e8f0ff', phys: true },
  pierce: { name: '찌르기', icon: 'pierce', color: '#d0e0ff', phys: true },
  strike: { name: '타격', icon: 'strike', color: '#c8c8e0', phys: true },
  fire: { name: '불', icon: 'fire', color: '#ff7a3a' },
  ice: { name: '얼음', icon: 'ice', color: '#8ad8ff' },
  bolt: { name: '번개', icon: 'bolt', color: '#ffe45a' },
  wind: { name: '바람', icon: 'wind', color: '#8ae8a0' },
  light: { name: '빛', icon: 'light', color: '#fff4c0' },
  dark: { name: '어둠', icon: 'dark', color: '#b890e8' },
};
export const ELEMENT_ORDER = ['slash', 'pierce', 'strike', 'fire', 'ice', 'bolt', 'wind', 'light', 'dark'];

export const STAT_NAMES = { hp: '최대 HP', mp: '최대 MP', atk: '공격력', def: '방어력', mag: '마력', mdf: '정신력', spd: '민첩', luk: '행운' };
export const STAT_SHORT = { hp: 'HP', mp: 'MP', atk: '공격', def: '방어', mag: '마력', mdf: '정신', spd: '민첩', luk: '행운' };

// 무기 타입 → 기본 공격 속성 / 표시명
export const WEAPON_TYPES = {
  sword: { name: '검', elem: 'slash' },
  greatsword: { name: '대검', elem: 'slash' },
  spear: { name: '창', elem: 'pierce' },
  staff: { name: '지팡이', elem: 'strike' },
  rod: { name: '로드', elem: 'strike' },
};
