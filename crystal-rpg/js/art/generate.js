// ─────────────────────────────────────────────────────────────
//  에셋 생성 코드. 데이터(*.data.js)를 해석해 캔버스를 만든다.
//  런타임에 호출되며, tools/export.html에서 같은 함수로 PNG를 뽑을 수 있다.
// ─────────────────────────────────────────────────────────────
import { PALETTE, hexToRgb } from './palette.js';
import {
  CHAR_FRAME, CHAR_ANIMS, HEADS, TORSOS, LEGS, LEG_SETS, ARMS, ARM_PIVOT, SHOULDER,
  WEAPON_SHAPES, WEAPON_COLORS, WEAPON_STYLE, SHIELD, POSES, CHAR_DESIGNS,
  MONSTER_SHAPES, MONSTER_DESIGNS, MONSTER_ANIMS,
} from './sprites.data.js';
import { ICONS } from './icons.data.js';
import { TILE_RECIPES, TILE_SIZE } from './tiles.data.js';

// ── 픽셀 버퍼 ──
export class PixBuf {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
  set(x, y, rgb, a = 255) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.d[i] = rgb[0]; this.d[i + 1] = rgb[1]; this.d[i + 2] = rgb[2]; this.d[i + 3] = a;
  }
  alpha(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.d[(y * this.w + x) * 4 + 3];
  }
  get(x, y) { const i = (y * this.w + x) * 4; return [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]]; }
  toCanvas(canvas) {
    const c = canvas || document.createElement('canvas');
    c.width = this.w; c.height = this.h;
    const ctx = c.getContext('2d');
    ctx.putImageData(new ImageData(this.d, this.w, this.h), 0, 0);
    return c;
  }
  blitBuf(src, ox, oy) {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const p = src.get(x, y);
      if (p[3]) this.set(ox + x, oy + y, p, p[3]);
    }
  }
}

const rgbCache = {};
function rgbOf(name) {
  if (!rgbCache[name]) {
    const hex = PALETTE[name];
    if (!hex) console.warn('[gen] 팔레트에 없는 색:', name);
    rgbCache[name] = hexToRgb(hex || '#ff00ff');
  }
  return rgbCache[name];
}

// 문자열 그리드 정규화: 폭 맞추기 + mirror 처리
const normCache = new WeakMap();
export function normalizeGrid(grid, mirror = false) {
  const key = grid;
  const cached = normCache.get(key);
  if (cached && cached.mirror === mirror) return cached.rows;
  const w = Math.max(...grid.map(r => r.length));
  let rows = grid.map(r => r.padEnd(w, '.'));
  if (mirror) rows = rows.map(r => r + r.split('').reverse().join(''));
  normCache.set(key, { mirror, rows });
  return rows;
}

function cellColor(ch, colors) {
  if (ch === '.' || ch === ' ') return null;
  const name = colors[ch] || (ch === 'O' ? 'ink' : null);
  if (!name) return null;
  return rgbOf(name);
}

// 그리드를 (ox,oy)에 그대로 찍기
export function drawGrid(buf, grid, colors, ox, oy, flipX = false) {
  const rows = normalizeGrid(grid);
  const w = rows[0].length;
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < w; x++) {
    const c = cellColor(rows[y][flipX ? w - 1 - x : x], colors);
    if (c) buf.set(ox + x, oy + y, c);
  }
}

// 회전 블릿: 소스의 pivot을 dest(dx,dy)에 맞추고 θ(도)만큼 회전 (픽셀 그리드 유지)
export function drawGridRot(buf, grid, colors, pivot, dx, dy, deg) {
  const rows = normalizeGrid(grid);
  const gw = rows[0].length, gh = rows.length;
  const t = deg * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
  const r = Math.hypot(gw, gh) + 2;
  for (let Y = Math.floor(dy - r); Y <= dy + r; Y++) for (let X = Math.floor(dx - r); X <= dx + r; X++) {
    const px = X + 0.5 - dx, py = Y + 0.5 - dy;
    // R(-θ)
    const sx = px * c + py * s + pivot.x, sy = -px * s + py * c + pivot.y;
    const ix = Math.floor(sx), iy = Math.floor(sy);
    if (ix < 0 || iy < 0 || ix >= gw || iy >= gh) continue;
    const col = cellColor(rows[iy][ix], colors);
    if (col) buf.set(X, Y, col);
  }
}

// 실루엣 주위에 한 칸 발광 테두리
export function addGlow(buf, rgb, alpha = 200) {
  const add = [];
  for (let y = 0; y < buf.h; y++) for (let x = 0; x < buf.w; x++) {
    if (buf.alpha(x, y)) continue;
    if (buf.alpha(x - 1, y) > 128 || buf.alpha(x + 1, y) > 128 || buf.alpha(x, y - 1) > 128 || buf.alpha(x, y + 1) > 128) add.push([x, y]);
  }
  for (const [x, y] of add) buf.set(x, y, rgb, alpha);
}

// 아핀 리샘플 (하단 중앙 기준). 몬스터 프레임 변형용
function resample(src, dst, { sx = 1, sy = 1, kx = 0, dx = 0, dy = 0 }, ax, ay) {
  for (let Y = 0; Y < dst.h; Y++) for (let X = 0; X < dst.w; X++) {
    const ly = (Y + 0.5 - ay - dy) / sy;
    const lx = (X + 0.5 - ax - dx - kx * ly * -1) / sx;
    const ix = Math.floor(lx + ax), iy = Math.floor(ly + ay);
    if (ix < 0 || iy < 0 || ix >= src.w || iy >= src.h) continue;
    const p = src.get(ix, iy);
    if (p[3]) dst.set(X, Y, p, p[3]);
  }
}

// ─────────────────────────────────────────────────────────────
//  캐릭터
// ─────────────────────────────────────────────────────────────
function armHand(sh, deg) {
  const t = deg * Math.PI / 180;
  return { x: sh.x - Math.sin(t) * 4, y: sh.y + Math.cos(t) * 4 };
}

export function composeCharFrame(design, pose, weapon) {
  const W = CHAR_FRAME.w, H = CHAR_FRAME.h;
  const buf = new PixBuf(W, H);
  const col = design.colors;
  const [bx, by] = pose.b || [0, 0];
  const [hx, hy] = pose.h || [0, 0];
  const legSet = LEG_SETS[design.legs] || LEG_SETS.normal;
  const legs = LEGS[legSet[pose.legs || 'stand']];
  const torso = TORSOS[design.torso];
  const arm = ARMS[design.arm];

  // 뒷팔
  const bs = { x: SHOULDER.back.x + bx, y: SHOULDER.back.y + by };
  drawGridRot(buf, arm, { ...col, C: col.c || col.C, S: col.s || col.S }, ARM_PIVOT, bs.x, bs.y, pose.ba ?? 0);
  // 다리, 몸통, 머리
  drawGrid(buf, legs, col, 11, 25);
  drawGrid(buf, torso.grid, col, torso.x + bx, torso.y + by);
  drawGrid(buf, HEADS[design.head], col, 10 + bx + hx, 6 + by + hy);
  if (design.shield) drawGrid(buf, SHIELD.grid, col, SHIELD.x + bx, SHIELD.y + by);
  // 무기 → 앞팔 (손이 손잡이를 덮도록)
  const fs = { x: SHOULDER.front.x + bx, y: SHOULDER.front.y + by };
  if (weapon) {
    const hand = armHand(fs, pose.fa ?? 0);
    const shape = WEAPON_SHAPES[weapon.type];
    const wc = { ...WEAPON_COLORS[weapon.type], ...(weapon.tint || {}) };
    drawGridRot(buf, shape.grid, wc, shape.grip, hand.x, hand.y, (pose.w ?? 180) - 180);
  }
  drawGridRot(buf, arm, col, ARM_PIVOT, fs.x, fs.y, pose.fa ?? 0);

  if (pose.glow) addGlow(buf, rgbOf('crystalL'), 230);
  if (pose.ko) return rotateKO(buf);
  return buf;
}

function rotateKO(buf) {
  // 뒤로 쓰러짐: 시계방향 90도 회전 후 바닥 중앙에 붙임
  const out = new PixBuf(buf.w, buf.h);
  const tmp = new PixBuf(buf.w, buf.h);
  for (let y = 0; y < buf.h; y++) for (let x = 0; x < buf.w; x++) {
    const p = buf.get(x, y); if (p[3]) tmp.set(buf.h - 1 - y, x, p, p[3]);
  }
  let minX = buf.w, maxX = 0, maxY = 0;
  for (let y = 0; y < tmp.h; y++) for (let x = 0; x < tmp.w; x++) if (tmp.alpha(x, y)) { maxY = Math.max(maxY, y); minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
  const shiftY = buf.h - 1 - maxY, shiftX = Math.round((buf.w - (maxX - minX + 1)) / 2) - minX;
  for (let y = 0; y < tmp.h; y++) for (let x = 0; x < tmp.w; x++) {
    const p = tmp.get(x, y); if (p[3]) out.set(x + shiftX, y + shiftY, p, p[3]);
  }
  return out;
}

// 캐릭터 스프라이트 시트 생성: 행=애니메이션, 열=프레임
export function makeCharSheet(designId, weapon /* {type, tint} | null */) {
  const design = CHAR_DESIGNS[designId];
  if (!design) throw new Error('디자인 없음: ' + designId);
  const style = weapon ? WEAPON_STYLE[weapon.type] : 'slash';
  const rows = CHAR_ANIMS.map(a => {
    const key = a.name === 'attack' ? 'attack_' + style : a.name;
    return { ...a, poses: POSES[key] };
  });
  const cols = Math.max(...rows.map(r => r.poses.length));
  const { w, h } = CHAR_FRAME;
  const sheet = new PixBuf(cols * w, rows.length * h);
  const anims = {};
  rows.forEach((r, ri) => {
    r.poses.forEach((p, fi) => sheet.blitBuf(composeCharFrame(design, p, weapon), fi * w, ri * h));
    anims[r.name] = { row: ri, frames: r.poses.length, fps: r.fps, loop: r.loop, hit: r.hit };
  });
  return { buf: sheet, meta: { frameW: w, frameH: h, cols, rows: rows.length, anims } };
}

// ─────────────────────────────────────────────────────────────
//  몬스터
// ─────────────────────────────────────────────────────────────
const MON_FX = {
  idle: [{}, { sx: 1.04, sy: 0.95 }, {}, { sx: 0.97, sy: 1.03 }],
  attack: [{ dx: -3, sx: 1.05, sy: 0.93 }, { dx: 1, kx: 0.12 }, { dx: 6, kx: 0.2, sx: 1.06 }, { dx: 3, kx: 0.08 }],
  cast: [{ sy: 1.03 }, { dy: -2, sy: 1.06, glow: true }, { dy: -2, sy: 1.06, glow: true }],
  hurt: [{ dx: -4, kx: -0.15, flash: true }, { dx: -2, kx: -0.06 }],
};

// EPX(Scale2x): 도트 그리드를 2배로 키우며 계단 모서리를 매끄럽게
export function epx(rows) {
  const H = rows.length, W = rows[0].length, out = [];
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? '.' : rows[y][x];
  for (let y = 0; y < H; y++) {
    let r1 = '', r2 = '';
    for (let x = 0; x < W; x++) {
      const P = at(x, y), A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
      let p1 = P, p2 = P, p3 = P, p4 = P;
      if (C === A && C !== D && A !== B) p1 = A;
      if (A === B && A !== C && B !== D) p2 = B;
      if (D === C && D !== B && C !== A) p3 = C;
      if (B === D && B !== A && D !== C) p4 = D;
      r1 += p1 + p2; r2 += p3 + p4;
    }
    out.push(r1, r2);
  }
  return out;
}

export function makeMonsterSheet(designId) {
  const design = MONSTER_DESIGNS[designId];
  const shape = MONSTER_SHAPES[design.shape];
  const HD = shape.hd !== false;
  const NATIVE = !!shape.native;
  let rows = normalizeGrid(shape.grid, !!shape.mirror);
  if (HD) rows = epx(rows);
  const gw = rows[0].length, gh = rows.length;
  const base = new PixBuf(gw, gh);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const c = cellColor(rows[y][x], design.colors); if (c) base.set(x, y, c);
  }
  const pad = HD || NATIVE ? 14 : 8;
  const fw = gw + pad * 2, fh = gh + pad;
  if (HD || NATIVE) selOut(base);
  const cols = 4;
  const sheet = new PixBuf(fw * cols, fh * MONSTER_ANIMS.length);
  const anims = {};
  const glowRGB = rgbOf(design.glow || 'crystalL');
  MONSTER_ANIMS.forEach((a, ri) => {
    const fx = (shape.fx && shape.fx[a.name]) || MON_FX[a.name];
    fx.forEach((t, fi) => {
      const src = new PixBuf(fw, fh);
      src.blitBuf(base, pad, pad);
      const out = new PixBuf(fw, fh);
      resample(src, out, HD ? { ...t, dx: (t.dx || 0) * 2, dy: (t.dy || 0) * 2 } : t, fw / 2, fh);
      if (t.glow) addGlow(out, glowRGB, 230);
      sheet.blitBuf(out, fi * fw, ri * fh);
    });
    anims[a.name] = { row: ri, frames: fx.length, fps: a.fps, loop: a.loop, hit: a.hit };
  });
  return { buf: sheet, meta: { frameW: fw, frameH: fh, cols, rows: MONSTER_ANIMS.length, anims, bodyW: gw, bodyH: gh, ppu: HD || NATIVE ? 1 / 27 : undefined } };
}

// ─────────────────────────────────────────────────────────────
//  아이콘
// ─────────────────────────────────────────────────────────────
export function makeIcon(name) {
  const def = ICONS[name];
  if (!def) return makeIcon('unknown');
  const grid = def.grid || ICONS[def.base].grid;
  const rows = normalizeGrid(grid);
  const buf = new PixBuf(rows[0].length, rows.length);
  drawGrid(buf, grid, def.colors, 0, 0);
  return buf;
}

// 무기 아이콘: 무기 도트를 45도로 눕혀 16x16에 담는다
export function makeWeaponIcon(type, tint) {
  const shape = WEAPON_SHAPES[type];
  const wc = { ...WEAPON_COLORS[type], ...(tint || {}) };
  const rows = normalizeGrid(shape.grid);
  const len = rows.length;
  const size = 16;
  const scale = Math.min(1.5, 19 / len);
  const buf = new PixBuf(size, size);
  const src = new PixBuf(rows[0].length, len);
  drawGrid(src, shape.grid, wc, 0, 0);
  // 45도 회전 + 축소 (샘플링)
  const t = -Math.PI / 4, c = Math.cos(t), s = Math.sin(t);
  const cx = rows[0].length / 2, cy = len / 2;
  for (let Y = 0; Y < size; Y++) for (let X = 0; X < size; X++) {
    const px = (X + 0.5 - size / 2) / scale, py = (Y + 0.5 - size / 2) / scale;
    const sx = px * c + py * s + cx, sy = -px * s + py * c + cy;
    const ix = Math.floor(sx), iy = Math.floor(sy);
    if (ix < 0 || iy < 0 || ix >= src.w || iy >= src.h) continue;
    const p = src.get(ix, iy); if (p[3]) buf.set(X, Y, p);
  }
  return buf;
}

// 캐릭터 얼굴 아이콘 (시트의 idle 첫 프레임에서 머리 부분 잘라내기)
export function makeFaceIcon(designId) {
  const design = CHAR_DESIGNS[designId];
  const f = composeCharFrame(design, POSES.idle[0], null);
  const out = new PixBuf(14, 14);
  for (let y = 0; y < 14; y++) for (let x = 0; x < 14; x++) {
    const p = f.get(9 + x, 5 + y); if (p[3]) out.set(x, y, p);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
//  타일 텍스처
// ─────────────────────────────────────────────────────────────
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}

function resolveRecipe(name) {
  const r = TILE_RECIPES[name];
  if (!r) throw new Error('타일 레시피 없음: ' + name);
  if (!r.base) return r;
  const b = resolveRecipe(r.base);
  return { ...b, ...r, noise: [...(b.noise || []), ...(r.noise || [])], sprinkle: r.sprinkle || b.sprinkle };
}

// 이음매 없는(타일링) 값 노이즈 0..1
function valueNoise(size, cell, rand) {
  const g = Math.max(1, Math.round(size / cell));
  const v = []; for (let i = 0; i < g * g; i++) v.push(rand());
  const at = (i, j) => v[((j % g + g) % g) * g + ((i % g + g) % g)];
  const sm = t => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = x / cell, fy = y / cell, i = Math.floor(fx), j = Math.floor(fy);
    const u = sm(fx - i), w = sm(fy - j);
    const a = at(i, j) + (at(i + 1, j) - at(i, j)) * u, b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * u;
    return a + (b - a) * w;
  };
}

export function makeTexture(name, variant = 0, size = TILE_SIZE) {
  const r = resolveRecipe(name);
  size = r.size || size;
  const rand = rng(1234 + variant * 7919 + name.length * 131 + name.charCodeAt(0) * 17);
  const buf = new PixBuf(size, size);
  if (r.fill !== 'none') {
    const fill = rgbOf(r.fill);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) buf.set(x, y, fill);
  }
  const shadeIdx = (arr, i) => rgbOf(arr[Math.abs(i) % arr.length]);

  switch (r.pattern) {
    case 'bricks': {
      for (let y = 0; y < size; y++) {
        const row = Math.floor(y / r.bh), off = (row % 2) * (r.bw / 2);
        for (let x = 0; x < size; x++) {
          const bxI = Math.floor((x + off) / r.bw);
          const edge = y % r.bh === r.bh - 1 || (x + off) % r.bw === r.bw - 1;
          buf.set(x, y, edge ? rgbOf(r.mortar) : shadeIdx(r.shades, bxI * 3 + row + variant));
          if (!edge && y % r.bh === 0) buf.set(x, y, rgbOf(r.shades[1]));
        }
      }
      break;
    }
    case 'tiles': {
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const cx = Math.floor(x / r.cell), cy = Math.floor(y / r.cell);
        const edge = x % r.cell === r.cell - 1 || y % r.cell === r.cell - 1;
        const hi = x % r.cell === 0 || y % r.cell === 0;
        buf.set(x, y, edge ? rgbOf(r.mortar) : hi ? rgbOf(r.shades[1]) : shadeIdx(r.shades, cx + cy * 2 + variant));
      }
      break;
    }
    case 'planks': {
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const row = Math.floor(y / r.ph);
        const seam = (x + row * 5 + variant * 3) % 16 === 0;
        buf.set(x, y, y % r.ph === r.ph - 1 || seam ? rgbOf(r.line) : shadeIdx(r.shades, row));
      }
      break;
    }
    case 'shingles': {
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const row = Math.floor(y / 4), off = (row % 2) * 2;
        const ly = y % 4;
        if (ly === 3 || (x + off) % 4 === 0 && ly > 0) buf.set(x, y, rgbOf(r.line));
        else if (ly === 0) buf.set(x, y, rgbOf(r.hi));
      }
      break;
    }
    case 'timber': {
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        if (y === 0 || y === size - 1 || x === 0 || (variant % 2 === 0 && x === y) || (variant % 2 === 1 && x === size - 1 - y)) buf.set(x, y, rgbOf(r.beam));
      }
      break;
    }
    case 'vstripes': {
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if ((x + (y >> 3) + variant) % 4 === 0) buf.set(x, y, rgbOf(r.line));
      break;
    }
    case 'waves': {
      for (let i = 0; i < 4; i++) {
        const y = Math.floor(rand() * size), x0 = Math.floor(rand() * size);
        for (let k = 0; k < 4; k++) buf.set((x0 + k) % size, y, rgbOf(r.hi));
      }
      break;
    }
    case 'blobs': {
      for (let i = 0; i < 5; i++) {
        const x0 = Math.floor(rand() * size), y0 = Math.floor(rand() * size);
        buf.set(x0, y0, rgbOf(r.hi)); buf.set(x0 + 1, y0, rgbOf(r.hi)); buf.set(x0, y0 + 1, rgbOf(r.hi));
      }
      break;
    }
    case 'rocks': {
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const n = Math.sin(x * 1.3 + variant) + Math.sin(y * 1.7 + x * 0.6);
        if (Math.abs(n) < 0.18) buf.set(x, y, rgbOf(r.line));
        else if (n > 1.4) buf.set(x, y, rgbOf(r.hi));
      }
      break;
    }
    case 'facets': {
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        if ((x + y) % 8 === 0 || (x - y + 16) % 11 === 0) buf.set(x, y, rgbOf(r.line));
        else if ((x * 3 + y) % 13 === 1) buf.set(x, y, rgbOf(r.hi));
      }
      break;
    }
    case 'patches': {
      // 두 단계 노이즈로 얼룩 + 미세 질감
      const n1 = valueNoise(size, r.cell || 8, rand), n2 = valueNoise(size, (r.cell || 8) / 2, rand);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const n = n1(x, y) * 0.7 + n2(x, y) * 0.3;
        if (n < (r.t1 ?? 0.38)) buf.set(x, y, rgbOf(r.dark));
        else if (r.darker && n < (r.t0 ?? 0.28)) buf.set(x, y, rgbOf(r.darker));
        else if (n > (r.t2 ?? 0.64)) buf.set(x, y, rgbOf(r.light));
        if (r.darker && n < (r.t0 ?? 0.28)) buf.set(x, y, rgbOf(r.darker));
      }
      break;
    }
    case 'cobble': {
      // 보로노이 셀로 둥근 돌바닥 (타일링)
      const N = r.stones || 14, pts = [];
      for (let i = 0; i < N; i++) pts.push([rand() * size, rand() * size, Math.floor(rand() * r.shades.length)]);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        let d1 = 1e9, d2 = 1e9, best = null, bx = 0, by = 0;
        for (const p of pts) for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
          const dx = x + 0.5 - (p[0] + ox), dy = y + 0.5 - (p[1] + oy), d = dx * dx + dy * dy;
          if (d < d1) { d2 = d1; d1 = d; best = p; bx = dx; by = dy; } else if (d < d2) d2 = d;
        }
        const edge = Math.sqrt(d2) - Math.sqrt(d1);
        if (edge < 1.1) buf.set(x, y, rgbOf(r.mortar));
        else {
          let c = r.shades[best[2]];
          if (edge < 2.1 && (bx + by) > 0) c = r.shade;            // 아래/오른쪽 가장자리 그림자
          else if (edge < 2.1 && (bx + by) < -1) c = r.hi;         // 위/왼쪽 하이라이트
          buf.set(x, y, rgbOf(c));
        }
      }
      break;
    }
    case 'strata': {
      // 절벽: 지층 줄무늬 + 박힌 돌 + 위쪽 풀 가장자리
      const wob = valueNoise(size, 8, rand);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const band = Math.floor((y + wob(x, y) * 6) / (r.bandH || 6));
        buf.set(x, y, rgbOf(r.bands[band % r.bands.length]));
      }
      for (let i = 0; i < (r.stones || 5); i++) {
        const cx = Math.floor(rand() * size), cy = (r.lip || 0) + 3 + Math.floor(rand() * (size - (r.lip || 0) - 4));
        const rw = 2 + Math.floor(rand() * 3), rh = 1 + Math.floor(rand() * 2);
        for (let y = -rh - 1; y <= rh + 1; y++) for (let x = -rw - 1; x <= rw + 1; x++) {
          const d = (x * x) / (rw * rw) + (y * y) / (rh * rh);
          const px = (cx + x + size) % size, py = cy + y;
          if (py < 0 || py >= size) continue;
          if (d <= 1) buf.set(px, py, rgbOf(y < 0 ? r.stoneL : r.stone));
          else if (d <= 1.9 && y >= 0) buf.set(px, py, rgbOf(r.stoneS));
        }
      }
      if (r.lip) for (let x = 0; x < size; x++) {
        const d = r.lip - 1 + Math.floor(wob(x, 0) * 3 + rand() * 1.5);
        for (let y = 0; y <= d; y++) buf.set(x, y, rgbOf(y === d ? r.lipColors[2] : y === d - 1 ? r.lipColors[1] : r.lipColors[0]));
      }
      break;
    }
    case 'tuft': {
      // 투명 배경 풀 포기 (빌보드용)
      for (let i = 0; i < (r.blades || 9); i++) {
        let x = 2 + rand() * (size - 4);
        const h = size * (0.45 + rand() * 0.5), lean = (rand() - 0.5) * 0.5 + (x - size / 2) / size * 0.6;
        for (let k = 0; k < h; k++) {
          const y = size - 1 - k, t = k / h;
          const c = t < 0.3 ? r.colors[0] : t < 0.75 ? r.colors[1] : r.colors[2];
          buf.set(Math.round(x), y, rgbOf(c));
          if (t < 0.4) buf.set(Math.round(x) + 1, y, rgbOf(r.colors[0]));
          x += lean;
        }
      }
      for (let i = 0; i < (r.flowers || 0); i++) {
        const fx = 3 + Math.floor(rand() * (size - 6)), fy = 2 + Math.floor(rand() * (size * 0.4));
        const fc = rgbOf(r.flowerColors[i % r.flowerColors.length]);
        for (let k = fy + 1; k < size; k++) if (rand() < 0.8) buf.set(fx, k, rgbOf(r.colors[1]));
        buf.set(fx, fy - 1, fc); buf.set(fx - 1, fy, fc); buf.set(fx + 1, fy, fc); buf.set(fx, fy + 1, fc); buf.set(fx, fy, rgbOf('flowerYellow'));
      }
      break;
    }
    case 'grassEdge': {
      for (let x = 0; x < size; x++) {
        const d = 3 + Math.floor(rand() * 3);
        for (let y = 0; y < d; y++) buf.set(x, y, rgbOf(y === d - 1 ? r.edge[1] : r.edge[0]));
      }
      break;
    }
  }
  for (const [cname, p] of r.noise || []) {
    const c = rgbOf(cname);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (rand() < p) buf.set(x, y, c);
  }
  for (const sp of r.sprinkle || []) {
    for (let i = 0; i < sp.count; i++) {
      const x = 1 + Math.floor(rand() * (size - 3)), y = 1 + Math.floor(rand() * (size - 3));
      const c = rgbOf(sp.color);
      if (sp.shape === 'blade') { buf.set(x, y, c); buf.set(x, y + 1, c); buf.set(x + 1, y + 1, rgbOf(sp.shade)); }
      else if (sp.shape === 'flower') { buf.set(x, y - 1, c); buf.set(x - 1, y, c); buf.set(x + 1, y, c); buf.set(x, y + 1, c); buf.set(x, y, rgbOf('flowerYellow')); }
      else if (sp.shape === 'pebble') { buf.set(x, y, c); buf.set(x + 1, y, c); buf.set(x, y + 1, rgbOf(sp.shade)); buf.set(x + 1, y + 1, rgbOf(sp.shade)); }
      else if (sp.shape === 'speck') { buf.set(x, y, c); }
      else if (sp.shape === 'rune') {
        for (let k = 3; k < 13; k++) { buf.set(k, 3, c); buf.set(k, 12, c); buf.set(3, k, c); buf.set(12, k, c); }
        buf.set(8, 6, c); buf.set(7, 8, c); buf.set(8, 8, c); buf.set(9, 8, c); buf.set(8, 10, c);
      }
    }
  }
  return buf;
}

// ─────────────────────────────────────────────────────────────
//  캐릭터 v2 (48px): 파츠 합성 + 흔들림 파츠 + 셀아웃 외곽선
// ─────────────────────────────────────────────────────────────
import { FRAME2, ANIMS2, ANCHORS2, ARM2, HEADS2, TORSOS2, LEGS2, LEGSETS2, ARMS2, SWAY2, SHIELD2, WEAPONS2, POSES2, DESIGNS2 } from './chars2.data.js';

function darkColors(colors) {
  const out = {};
  for (const [k, v] of Object.entries(colors)) out[k] = (k !== 'O' && PALETTE[v + 'S']) ? v + 'S' : v;
  return out;
}

// 내부 외곽선을 주변 색의 어두운 톤으로 바꿔 부드럽고 고급스럽게 (셀아웃)
export function selOut(buf, inkName = 'ink') {
  const ink = rgbOf(inkName);
  const W = buf.w, H = buf.h, src = buf.d.slice();
  const isInk = i => src[i + 3] > 0 && src[i] === ink[0] && src[i + 1] === ink[1] && src[i + 2] === ink[2];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (!isInk(i)) continue;
    let outer = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || src[(ny * W + nx) * 4 + 3] === 0) { outer = true; break; }
    }
    if (outer) continue;
    let r = 0, g = 0, b = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = (ny * W + nx) * 4;
      if (src[j + 3] && !isInk(j)) { r += src[j]; g += src[j + 1]; b += src[j + 2]; n++; }
    }
    if (!n) continue;
    const k = 0.5;
    buf.d[i] = (r / n) * k + ink[0] * (1 - k) * 0.6;
    buf.d[i + 1] = (g / n) * k + ink[1] * (1 - k) * 0.6;
    buf.d[i + 2] = (b / n) * k + ink[2] * (1 - k) * 0.6;
  }
}

function hand2(sh, deg) { const t = deg * Math.PI / 180; return { x: sh.x - Math.sin(t) * ARM2.hand, y: sh.y + Math.cos(t) * ARM2.hand }; }

export function composeChar2(designId, pose, weapon) {
  const d = DESIGNS2[designId];
  const { w: FW, h: FH } = FRAME2;
  const buf = new PixBuf(FW, FH);
  const col = d.colors, dcol = darkColors(col);
  const [bx, by] = pose.b || [0, 0];
  const [hx, hy] = pose.h || [0, 0];
  const A = ANCHORS2;
  const sw = pose.sw || 0;
  const torso = TORSOS2[d.torso];
  const legs = LEGS2[(LEGSETS2[d.legs] || LEGSETS2.boots)[pose.legs || 'stand']];
  const arm = ARMS2[d.arm];
  const headX = A.head[0] + bx + hx, headY = A.head[1] + by + hy;
  // 1) 망토/코트자락 (몸 뒤)
  if (d.cape) { const [cx, cy] = d.capeAt || A.cape; const fr = SWAY2[d.cape][sw % SWAY2[d.cape].length]; drawGrid(buf, fr, col, cx + bx, cy + by); }
  // 2) 뒷머리/리본 (머리 뒤)
  if (d.tail && !d.tailFront) { const fr = SWAY2[d.tail][sw % SWAY2[d.tail].length]; drawGrid(buf, fr, col, headX + d.tailAt[0], headY + d.tailAt[1]); }
  // 3) 뒷팔
  const bs = { x: A.shoulderB[0] + bx, y: A.shoulderB[1] + by };
  drawGridRot(buf, arm, dcol, ARM2.pivot, bs.x, bs.y, pose.ba ?? 0);
  // 4) 다리 → 몸통 → 머리
  drawGrid(buf, legs, col, A.legs[0], A.legs[1]);
  drawGrid(buf, torso.grid, col, A.torso[0] + (torso.dx || 0) + bx, A.torso[1] + by);
  drawGrid(buf, HEADS2[d.head], col, headX, headY);
  if (d.tail && d.tailFront) { const fr = SWAY2[d.tail][sw % SWAY2[d.tail].length]; drawGrid(buf, fr, col, headX + d.tailAt[0], headY + d.tailAt[1]); }
  // 5) 방패
  if (d.shield) drawGrid(buf, SHIELD2.grid, col, SHIELD2.x + bx, SHIELD2.y + by);
  // 6) 무기 → 앞팔
  const fs = { x: A.shoulderF[0] + bx, y: A.shoulderF[1] + by };
  if (weapon) {
    const hp = hand2(fs, pose.fa ?? 0);
    const shape = WEAPONS2[weapon.type];
    const wc = { O: 'ink', l: 'leatherS', ...WEAPON_COLORS[weapon.type], ...(weapon.tint || {}) };
    drawGridRot(buf, shape.grid, wc, shape.grip, hp.x, hp.y, (pose.w ?? 180) - 180);
  }
  drawGridRot(buf, arm, col, ARM2.pivot, fs.x, fs.y, pose.fa ?? 0);
  selOut(buf);
  if (pose.glow) addGlow(buf, rgbOf('crystalL'), 230);
  if (pose.ko) return rotateKO(buf);
  return buf;
}

export function makeCharSheet2(designId, weapon) {
  const style = weapon ? WEAPON_STYLE[weapon.type] : 'slash';
  const rows = ANIMS2.map(a => ({ ...a, poses: POSES2[a.name === 'attack' ? 'attack_' + style : a.name] }));
  const cols = Math.max(...rows.map(r => r.poses.length));
  const { w, h } = FRAME2;
  const sheet = new PixBuf(cols * w, rows.length * h);
  const anims = {};
  rows.forEach((r, ri) => {
    r.poses.forEach((p, fi) => sheet.blitBuf(composeChar2(designId, p, weapon), fi * w, ri * h));
    anims[r.name] = { row: ri, frames: r.poses.length, fps: r.fps, loop: r.loop, hit: r.hit };
  });
  return { buf: sheet, meta: { frameW: w, frameH: h, cols, rows: rows.length, anims, ppu: 1 / 27 } };
}

export function makeFaceIcon2(designId) {
  const f = composeChar2(designId, POSES2.idle[0], null);
  const out = new PixBuf(18, 18);
  const [ax, ay] = ANCHORS2.head;
  for (let y = 0; y < 18; y++) for (let x = 0; x < 18; x++) { const p = f.get(ax - 1 + x, ay - 1 + y); if (p[3]) out.set(x, y, p, p[3]); }
  return out;
}
export const HAS_DESIGN2 = id => !!DESIGNS2[id];
