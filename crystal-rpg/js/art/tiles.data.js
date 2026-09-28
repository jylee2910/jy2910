// 지형/오브젝트 텍스처 레시피 (데이터). generate.js의 makeTexture가 해석한다.
// fill: 바탕색, noise: [[색, 확률]...], pattern: 무늬 종류, sprinkle: 작은 장식
export const TILE_SIZE = 16;
export const TILE_RECIPES = {
  grass: { fill: 'grass', noise: [['grassS', 0.16], ['grassL', 0.1]], sprinkle: [{ shape: 'blade', color: 'grassL', shade: 'grassS', count: 5 }] },
  grassFlower: { base: 'grass', sprinkle: [
    { shape: 'blade', color: 'grassL', shade: 'grassS', count: 3 },
    { shape: 'flower', color: 'flowerPink', count: 2 },
    { shape: 'flower', color: 'flowerYellow', count: 1 },
    { shape: 'flower', color: 'flowerWhite', count: 1 }] },
  grassSide: { fill: 'dirtS', noise: [['dirt', 0.2], ['leatherS', 0.1]], pattern: 'grassEdge', edge: ['grass', 'grassS'] },
  dirt: { fill: 'dirt', noise: [['dirtS', 0.18], ['dirtL', 0.12]], sprinkle: [{ shape: 'pebble', color: 'stoneL', shade: 'stoneS', count: 2 }] },
  sand: { fill: 'sand', noise: [['sandS', 0.15], ['white', 0.04]] },
  stoneFloor: { fill: 'stone', pattern: 'tiles', cell: 8, mortar: 'stoneS', shades: ['stone', 'stoneL', 'stone'], noise: [['stoneS', 0.06]] },
  stoneWall: { fill: 'stone', pattern: 'bricks', bw: 8, bh: 4, mortar: 'stoneD', shades: ['stone', 'stoneL', 'stoneS'], noise: [['stoneS', 0.05]] },
  mossWall: { base: 'stoneWall', noise: [['moss', 0.12], ['mossS', 0.06]] },
  plaster: { fill: 'plaster', noise: [['plasterS', 0.08]], pattern: 'timber', beam: 'woodS' },
  planks: { fill: 'wood', pattern: 'planks', ph: 4, line: 'woodS', shades: ['wood', 'woodL', 'wood'] },
  roofRed: { fill: 'roofRed', pattern: 'shingles', line: 'roofRedS', hi: 'redL' },
  roofBlue: { fill: 'roofBlue', pattern: 'shingles', line: 'roofBlueS', hi: 'blueL' },
  leaves: { fill: 'green', noise: [['greenS', 0.3], ['greenL', 0.14], ['grassD', 0.08]], pattern: 'blobs', hi: 'greenL' },
  leavesDark: { fill: 'moss', noise: [['mossS', 0.3], ['green', 0.12], ['grassD', 0.12]], pattern: 'blobs', hi: 'green' },
  bark: { fill: 'wood', pattern: 'vstripes', line: 'woodS', noise: [['woodL', 0.08]] },
  water: { fill: 'water', noise: [['waterS', 0.15]], pattern: 'waves', hi: 'waterL' },
  caveFloor: { fill: 'caveRock', noise: [['caveRockS', 0.2], ['caveRockL', 0.1]], sprinkle: [{ shape: 'pebble', color: 'caveRockL', shade: 'caveRockS', count: 3 }] },
  caveWall: { fill: 'caveRock', pattern: 'rocks', line: 'caveRockS', hi: 'caveRockL', noise: [['caveRockS', 0.1]], sprinkle: [{ shape: 'speck', color: 'crystal', count: 2 }] },
  crystal: { fill: 'crystal', pattern: 'facets', line: 'crystalS', hi: 'crystalL' },
  darkCrystal: { fill: 'dark', pattern: 'facets', line: 'darkS', hi: 'magentaL' },
  altar: { fill: 'stoneL', pattern: 'tiles', cell: 16, mortar: 'stoneS', shades: ['stoneL', 'stone'], sprinkle: [{ shape: 'rune', color: 'crystal', count: 1 }] },
};
