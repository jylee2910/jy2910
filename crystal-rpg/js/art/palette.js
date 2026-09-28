// 게임 전체에서 공유하는 단일 팔레트.
// 모든 도트 데이터(캐릭터·몬스터·타일·아이콘)는 여기의 이름만 참조한다.
// 색을 바꾸고 싶으면 이 파일만 고치면 전체 톤이 함께 바뀐다.
export const PALETTE = {
  ink: '#1c1428', inkSoft: '#3a2c48',
  white: '#fff8ec', black: '#0c0a12',

  skin: '#f6cfa8', skinS: '#d9977a', skinD: '#b87460',
  eye: '#2a1c3a',

  hairBrown: '#8e4f2c', hairBrownS: '#5e301e', hairBrownL: '#c07a42',
  hairGold: '#f2c862', hairGoldS: '#c08a34', hairGoldL: '#fff0a8',
  hairNavy: '#3c4a86', hairNavyS: '#232a52', hairNavyL: '#6a80c4',
  hairRed: '#cc4a3e', hairRedS: '#8a2a30', hairRedL: '#f07a5a',
  hairSilver: '#dfe2ee', hairSilverS: '#9aa2bc', hairSilverL: '#ffffff',

  blue: '#3e70cc', blueS: '#284a90', blueL: '#78a4ee',
  red: '#cc4c40', redS: '#8c2e30', redL: '#f07a60',
  cream: '#f0e8d6', creamS: '#bdb09a', creamL: '#fffaf0',
  green: '#4ea05c', greenS: '#2e6a40', greenL: '#86cc74',
  purple: '#6c4ca0', purpleS: '#443072', purpleL: '#9a7cd0',
  teal: '#2e8c96', tealS: '#1c5c6a', tealL: '#5cc4c4',
  crimson: '#a02c48', crimsonS: '#661c34', crimsonL: '#d85a70',

  steel: '#aab6ca', steelS: '#6e7a92', steelL: '#eef4ff',
  gold: '#eab84c', goldS: '#a8762c', goldL: '#fff0a0',
  darkMetal: '#4c4c66', darkMetalS: '#2c2c42', darkMetalL: '#7c7ca0',
  leather: '#7c4e32', leatherS: '#523220',
  pants: '#4a4060', pantsS: '#302a44',
  wood: '#8c5a36', woodS: '#62402a', woodL: '#b07a4a',

  fire: '#ff7a3a', fireS: '#c83a2a', fireL: '#ffd070',
  ice: '#8ad8ff', iceS: '#4a90d0', iceL: '#e8fbff',
  bolt: '#ffe45a', boltS: '#d0a020', boltL: '#fffbd0',
  wind: '#8ae8a0', windS: '#3ea870', windL: '#e0ffe8',
  light: '#fff4c0', lightS: '#e8c870', lightL: '#ffffff',
  dark: '#7a4ab0', darkS: '#3c2468', darkL: '#b890e8',
  crystal: '#7ef0ff', crystalS: '#3aa0d8', crystalL: '#e8ffff',
  magenta: '#e45ac8', magentaS: '#9a2e8c', magentaL: '#ffa8ec',

  // 지형
  grass: '#6cae52', grassS: '#4e8a3c', grassL: '#94d06a', grassD: '#3a6a30',
  dirt: '#b48c5c', dirtS: '#8c6a44', dirtL: '#d4b07c',
  stone: '#9c9cae', stoneS: '#727286', stoneL: '#c4c4d4', stoneD: '#50506a',
  water: '#3a8cd4', waterS: '#2a64a8', waterL: '#8cd0ff',
  roofRed: '#b44c3c', roofRedS: '#843028', roofBlue: '#3c5c9c', roofBlueS: '#283e70',
  plaster: '#f0e4c8', plasterS: '#c8b894',
  moss: '#5a8a4a', mossS: '#3c6634',
  caveRock: '#5c5680', caveRockS: '#3c3860', caveRockL: '#8278aa',
  flowerPink: '#ff9ac0', flowerYellow: '#ffe070', flowerWhite: '#fffaf0', flowerBlue: '#8ab4ff',
  sand: '#e8d49a', sandS: '#c4ac72',

  // UI
  uiBlue: '#1a2c78', uiBlueL: '#3a5cc8', uiBlueD: '#0c1440',
};

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function color(name) {
  const c = PALETTE[name];
  if (!c) { console.warn('[palette] 없는 색:', name); return '#ff00ff'; }
  return c;
}
