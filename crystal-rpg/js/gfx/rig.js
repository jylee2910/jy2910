// ─────────────────────────────────────────────────────────────
//  3D 리그 → 도트 스프라이트 파이프라인
//   - 절차적 툰 셰이딩 3D 캐릭터(성인 비율)를 작은 렌더 타깃에 실시간 렌더
//   - 외곽선/내부선 패스로 도트 그림처럼 만든 뒤 빌보드에 표시
//   - 키프레임 관절 애니메이션 + 스프링 보조 동작(망토·머리카락)
//   - 얼굴은 도트 데칼(눈썹·눈·입)을 붙여 작은 크기에서도 또렷하게
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { PALETTE } from '../art/palette.js';

let RENDERER = null;
export function setRigRenderer(r) { RENDERER = r; }

const D2R = Math.PI / 180;
const col = c => (typeof c === 'number' ? c : new THREE.Color(PALETTE[c] || c).getHex());

// ── 툰 재질 (3단계 계조) ──
let gradTex = null;
function gradient() {
  if (gradTex) return gradTex;
  const d = new Uint8Array([70, 70, 70, 255, 160, 160, 160, 255, 255, 255, 255, 255]);
  gradTex = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat);
  gradTex.magFilter = gradTex.minFilter = THREE.NearestFilter; gradTex.needsUpdate = true;
  return gradTex;
}
const matCache = new Map();
export function toon(c, { emissive = 0, side = THREE.FrontSide, metal = false } = {}) {
  const hex = col(c);
  const key = hex + ':' + emissive + ':' + side + metal;
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshToonMaterial({ color: hex, gradientMap: gradient(), side });
  if (emissive) { m.emissive = new THREE.Color(hex); m.emissiveIntensity = emissive; }
  matCache.set(key, m);
  return m;
}

// ── 기본 도형 (원점에서 -y로 뻗는 형태 위주) ──
function mesh(geo, mat) { const m = new THREE.Mesh(geo, mat); return m; }
export function capsule(r, len, c, opt) { const g = new THREE.CapsuleGeometry(r, len, 3, 8); g.translate(0, -len / 2, 0); return mesh(g, toon(c, opt)); }
export function taper(rTop, rBot, h, c, { sides = 8, sz = 1, sx = 1, up = false, open = false, mat } = {}) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, sides, 1, open);
  g.translate(0, up ? h / 2 : -h / 2, 0); g.scale(sx, 1, sz);
  return mesh(g, mat || toon(c, open ? { side: THREE.DoubleSide } : {}));
}
export function box(w, h, d, c, opt) { return mesh(new THREE.BoxGeometry(w, h, d), toon(c, opt)); }
export function ball(r, c, sx = 1, sy = 1, sz = 1, opt) { const g = new THREE.SphereGeometry(r, 12, 9); g.scale(sx, sy, sz); return mesh(g, toon(c, opt)); }
export function cone(r, h, c, sides = 6, opt) { const g = new THREE.ConeGeometry(r, h, sides); g.translate(0, h / 2, 0); return mesh(g, toon(c, opt)); }
// 회전체 (치마/로브/코트자락): pts = [[r, y], ...] (y는 아래로 음수)
export function lathe(pts, c, { phiStart = 0, phiLength = Math.PI * 2, segs = 12 } = {}) {
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segs, phiStart, phiLength);
  return mesh(g, toon(c, { side: THREE.DoubleSide }));
}
export function at(obj, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { obj.position.set(x, y, z); obj.rotation.set(rx * D2R, ry * D2R, rz * D2R); return obj; }
function bone(name, parent, x = 0, y = 0, z = 0) { const b = new THREE.Object3D(); b.name = name; b.position.set(x, y, z); parent.add(b); return b; }

// ── 얼굴 데칼 (도트) ──
// 문자: B 눈썹 E 속눈썹/동공 I 홍채 W 하이라이트 M 입 K 홍조 L 흉터/선
const FACES = {
  hero: ['.BBB...BBB.', '..BB...BB..', '.EEE...EEE.', '.IWI...IWI.', '...........', '.....M.....'],
  heroine: ['..BB...BB..', '.EEEE.EEEE.', '.IIWI.IWII.', '.IIII.IIII.', '..K.....K..', '....MMM....'],
  stern: ['BBBB...BBBB', '.BB.....BB.', '.EEE...EEE.', '.IWI...IWI.', '...........', '...........'],
  cool: ['.BB...BBB..', '..BB..BB...', '.EEE..EEE..', '.WII..IWI..', '...........', '.....M.....'],
  fierce: ['BB.....BB..', '.BB...BB...', '.EEE..EEE..', '.IWI..IWI..', '...........', '....MM.....'],
  old: ['.LL....LL..', 'BBBB..BBBB.', '.EE....EE..', '...........', '...........', '...........'],
  kind: ['..BB...BB..', '.EEE...EEE.', '.IWI...IWI.', '..K.....K..', '...........', '....MMM....'],
};
const faceTexCache = new Map();
function faceTexture(kind, colors) {
  const key = kind + JSON.stringify(colors);
  if (faceTexCache.has(key)) return faceTexCache.get(key);
  const rows = FACES[kind];
  const W = rows[0].length, H = rows.length;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const map = { B: colors.brow || '#3a2418', E: '#1a1220', I: colors.iris || '#3a6ad0', W: '#ffffff', M: '#8a3a3a', K: '#e8908a', L: '#a07060' };
  rows.forEach((r, yy) => [...r].forEach((ch, xx) => { if (map[ch]) { x.fillStyle = map[ch]; x.fillRect(xx, yy, 1, 1); } }));
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  faceTexCache.set(key, { tex: t, W, H });
  return faceTexCache.get(key);
}

export const PX = 50; // 렌더 타깃 1px = 1/50 월드 단위

// ─────────────────────────────────────────────────────────────
//  휴머노이드 리그
// ─────────────────────────────────────────────────────────────
export class Rig {
  constructor() {
    this.root = new THREE.Group();
    this.root.rotation.order = 'YXZ';
    this.b = {};
    this.springs = [];   // {bone, axis, rest, k, damp, vel, val, gain}
    this.smear = null;
    this.extraUpdate = [];
  }
  addSpring(boneObj, opts = {}) { this.springs.push({ bone: boneObj, val: 0, vel: 0, rest: boneObj.rotation.x, k: 60, damp: 7, gain: 1, wind: 0.6, side: 0, ...opts }); }
}

// 몸통 비율 + 파츠 정의로 캐릭터 조립
export function buildHumanoid(def) {
  const rig = new Rig();
  const s = def.scale || 1, bulk = def.bulk || 1;
  const C = def.colors;
  const legH = 0.84 * s;
  const R = rig.root;
  const b = rig.b;
  b.hips = bone('hips', R, 0, legH, 0);
  b.spine = bone('spine', b.hips, 0, 0.12 * s, 0);
  b.chest = bone('chest', b.spine, 0, 0.1 * s, 0);
  b.neck = bone('neck', b.chest, 0, 0.3 * s, 0);
  b.head = bone('head', b.neck, 0, 0.07 * s, 0.01);
  b.head.scale.setScalar(def.headScale || 1.1);
  const sw = 0.19 * s * bulk;
  b.armL = bone('armL', b.chest, sw, 0.26 * s, 0);
  b.foreL = bone('foreL', b.armL, 0, -0.27 * s, 0);
  b.handL = bone('handL', b.foreL, 0, -0.25 * s, 0);
  b.armR = bone('armR', b.chest, -sw, 0.26 * s, 0);
  b.foreR = bone('foreR', b.armR, 0, -0.27 * s, 0);
  b.handR = bone('handR', b.foreR, 0, -0.25 * s, 0);
  const hw = 0.095 * s * bulk;
  b.thighL = bone('thighL', b.hips, hw, -0.02, 0);
  b.shinL = bone('shinL', b.thighL, 0, -0.41 * s, 0);
  b.footL = bone('footL', b.shinL, 0, -0.39 * s, 0);
  b.thighR = bone('thighR', b.hips, -hw, -0.02, 0);
  b.shinR = bone('shinR', b.thighR, 0, -0.41 * s, 0);
  b.footR = bone('footR', b.shinR, 0, -0.39 * s, 0);
  b.weapon = bone('weapon', b.handL, 0, -0.02, 0.0);

  const skin = C.skin || 'skin';
  // ── 머리 ──
  const hr = 0.142 * s;
  b.headMesh = ball(hr, skin, 0.95, 1.05, 1); at(b.headMesh, 0, hr * 0.95, 0); b.head.add(b.headMesh);
  const jaw = ball(hr * 0.72, skin, 0.9, 0.7, 0.95); at(jaw, 0, hr * 0.42, hr * 0.18); b.head.add(jaw);
  // 얼굴 데칼
  const ft = faceTexture(def.face || 'hero', { iris: PALETTE[C.eye] || C.eye || '#3a6ad0', brow: PALETTE[C.hairS || C.hair] || '#3a2418' });
  const fw = ft.W / PX, fh = ft.H / PX;
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), new THREE.MeshBasicMaterial({ map: ft.tex, transparent: false, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -4 }));
  at(decal, 0, hr * 0.92, hr * 0.97);
  b.head.add(decal);
  b.face = decal;
  // 목
  b.neck.add(at(taper(0.045 * s, 0.05 * s, 0.09 * s, skin, { up: true }), 0, -0.02, 0));

  // ── 몸통 ──
  const chestCol = C.chest || C.cloth;
  const chest = taper(0.165 * s * bulk, 0.125 * s * bulk, 0.32 * s, chestCol, { sz: 0.68, up: true, sides: 10 });
  b.chest.add(chest);
  const abd = taper(0.125 * s * bulk, 0.12 * s * bulk, 0.13 * s, C.waist || chestCol, { sz: 0.7, up: true, sides: 10 }); at(abd, 0, -0.12 * s, 0); b.chest.add(abd);
  const pelvis = taper(0.125 * s * bulk, 0.135 * s * bulk, 0.14 * s, C.pants || 'pants', { sz: 0.72, sides: 10 }); at(pelvis, 0, 0.12 * s, 0); b.hips.add(pelvis);
  if (C.belt) { const belt = taper(0.132 * s * bulk, 0.132 * s * bulk, 0.035 * s, C.belt, { sz: 0.74, sides: 10 }); at(belt, 0, 0.02 * s, 0); b.spine.add(belt); }
  // 어깨
  for (const side of ['L', 'R']) {
    const sh = ball(0.06 * s * bulk, C.sleeve || chestCol); b['arm' + side].add(sh);
    b['arm' + side].add(capsule(0.045 * s * bulk, 0.2 * s, C.sleeve || chestCol));
    b['fore' + side].add(capsule(0.04 * s * bulk, 0.19 * s, C.forearm || C.sleeve || chestCol));
    const hand = ball(0.044 * s, C.glove || skin, 1, 1.15, 1); at(hand, 0, -0.03, 0); b['hand' + side].add(hand);
    // 다리
    b['thigh' + side].add(capsule(0.066 * s * bulk, 0.33 * s, C.pants || 'pants'));
    b['shin' + side].add(capsule(0.052 * s * bulk, 0.3 * s, C.boots || C.pants || 'pants'));
    const foot = box(0.1 * s * bulk, 0.08 * s, 0.2 * s, C.boots || 'leather'); at(foot, 0, -0.01, 0.05 * s); b['foot' + side].add(foot);
    if (C.bootTop) { const cuff = taper(0.065 * s * bulk, 0.06 * s * bulk, 0.06 * s, C.bootTop, { sides: 8 }); at(cuff, 0, -0.06 * s, 0); b['shin' + side].add(cuff); }
  }
  for (const fn of def.parts || []) fn(rig, def, s);
  return rig;
}

// ─────────────────────────────────────────────────────────────
//  애니메이션: keys = [{t, p:{bone:[rx,ry,rz]}, r:[x,y,z], e:'out'}]
// ─────────────────────────────────────────────────────────────
const EASE = {
  linear: k => k, out: k => 1 - (1 - k) ** 3, in: k => k ** 3, inOut: k => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2),
  back: k => { const c = 2.2; return 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2; }, snap: k => 1 - (1 - k) ** 6,
};
function lerp(a, b, k) { return a + (b - a) * k; }

export function samplePose(anim, t) {
  const keys = anim.keys;
  if (anim.loop) t = t % anim.dur;
  else t = Math.min(t, anim.dur);
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1].t <= t) i++;
  const A = keys[i], B = keys[Math.min(i + 1, keys.length - 1)];
  let k = B.t > A.t ? (t - A.t) / (B.t - A.t) : 1;
  if (A === B) k = 0;
  k = (EASE[B.e || 'inOut'] || EASE.inOut)(Math.max(0, Math.min(1, k)));
  const pose = {}, names = new Set([...Object.keys(A.p || {}), ...Object.keys(B.p || {})]);
  for (const n of names) {
    const a = A.p?.[n] || [0, 0, 0], bb = B.p?.[n] || [0, 0, 0];
    pose[n] = [lerp(a[0], bb[0], k), lerp(a[1], bb[1], k), lerp(a[2], bb[2], k)];
  }
  const ra = A.r || [0, 0, 0], rb = B.r || [0, 0, 0];
  const root = [lerp(ra[0], rb[0], k), lerp(ra[1], rb[1], k), lerp(ra[2], rb[2], k)];
  const ta = A.tilt || 0, tb = B.tilt || 0;
  const sa = A.smear ?? 0, sb = B.smear ?? 0;
  return { pose, root, tilt: lerp(ta, tb, k), smear: lerp(sa, sb, k), spin: lerp(A.spin || 0, B.spin || 0, k) };
}

// 공용 휴머노이드 애니메이션 (무기는 왼손=+x쪽, 캐릭터 정면 +z)
const W_READY = { armL: [-28, 0, 12], foreL: [-55, 0, 0], weapon: [-60, 0, 0], armR: [-8, 0, -14], foreR: [-25, 0, 0] };
export const HUMAN_ANIMS = {
  idle: { dur: 1.8, loop: true, keys: [
    { t: 0, p: { ...W_READY, chest: [2, -8, 0], head: [0, 6, 0], thighL: [-10, 0, 6], thighR: [8, 0, -6], shinL: [12, 0, 0], shinR: [8, 0, 0], footL: [-2, 0, 0] }, r: [0, -0.01, 0] },
    { t: 0.9, p: { ...W_READY, armL: [-30, 0, 14], chest: [5, -8, 0], head: [-2, 6, 0], thighL: [-12, 0, 6], thighR: [8, 0, -6], shinL: [16, 0, 0], shinR: [12, 0, 0] }, r: [0, -0.025, 0] },
    { t: 1.8, p: { ...W_READY, chest: [2, -8, 0], head: [0, 6, 0], thighL: [-10, 0, 6], thighR: [8, 0, -6], shinL: [12, 0, 0], shinR: [8, 0, 0], footL: [-2, 0, 0] }, r: [0, -0.01, 0] },
  ] },
  walk: { dur: 0.72, loop: true, keys: [
    { t: 0, p: { thighL: [-32, 0, 0], shinL: [8, 0, 0], thighR: [26, 0, 0], shinR: [30, 0, 0], armL: [20, 0, 8], foreL: [-30, 0, 0], armR: [-25, 0, -8], foreR: [-20, 0, 0], weapon: [-70, 0, 0], chest: [6, 6, 0] }, r: [0, 0, 0], e: 'linear' },
    { t: 0.18, p: { thighL: [-10, 0, 0], shinL: [5, 0, 0], thighR: [5, 0, 0], shinR: [55, 0, 0], armL: [5, 0, 8], foreL: [-30, 0, 0], armR: [-8, 0, -8], foreR: [-20, 0, 0], weapon: [-70, 0, 0], chest: [6, 0, 0] }, r: [0, 0.04, 0], e: 'linear' },
    { t: 0.36, p: { thighL: [26, 0, 0], shinL: [30, 0, 0], thighR: [-32, 0, 0], shinR: [8, 0, 0], armL: [-25, 0, 8], foreL: [-30, 0, 0], armR: [20, 0, -8], foreR: [-20, 0, 0], weapon: [-70, 0, 0], chest: [6, -6, 0] }, r: [0, 0, 0], e: 'linear' },
    { t: 0.54, p: { thighL: [5, 0, 0], shinL: [55, 0, 0], thighR: [-10, 0, 0], shinR: [5, 0, 0], armL: [-8, 0, 8], foreL: [-30, 0, 0], armR: [5, 0, -8], foreR: [-20, 0, 0], weapon: [-70, 0, 0], chest: [6, 0, 0] }, r: [0, 0.04, 0], e: 'linear' },
    { t: 0.72, p: { thighL: [-32, 0, 0], shinL: [8, 0, 0], thighR: [26, 0, 0], shinR: [30, 0, 0], armL: [20, 0, 8], foreL: [-30, 0, 0], armR: [-25, 0, -8], foreR: [-20, 0, 0], weapon: [-70, 0, 0], chest: [6, 6, 0] }, r: [0, 0, 0], e: 'linear' },
  ] },
  attack_slash: { dur: 0.95, hit: 0.4, keys: [
    { t: 0, p: { ...W_READY, chest: [2, -8, 0], thighL: [-10, 0, 6], thighR: [8, 0, -6], shinL: [12, 0, 0], shinR: [8, 0, 0] } },
    { t: 0.2, e: 'out', p: { armL: [-205, 0, 18], foreL: [-40, 0, 0], weapon: [-20, 0, 0], armR: [-40, 0, -30], foreR: [-50, 0, 0], chest: [-10, 38, 0], spine: [0, 10, 0], head: [5, -25, 0], thighL: [-30, 0, 8], shinL: [40, 0, 0], thighR: [25, 0, -8], shinR: [20, 0, 0] }, r: [0, -0.06, -0.08] },
    { t: 0.3, e: 'in', p: { armL: [-140, 0, 10], foreL: [-15, 0, 0], weapon: [-10, 0, 0], armR: [10, 0, -30], foreR: [-40, 0, 0], chest: [8, 0, 0], spine: [0, 0, 0], head: [0, 0, 0], thighL: [-45, 0, 6], shinL: [30, 0, 0], thighR: [30, 0, -6], shinR: [10, 0, 0] }, r: [0, -0.05, 0.15], smear: 1 },
    { t: 0.4, e: 'snap', p: { armL: [-25, 0, -10], foreL: [-5, 0, 0], weapon: [-5, 0, 0], armR: [30, 0, -35], foreR: [-30, 0, 0], chest: [22, -42, 0], spine: [5, -15, 0], head: [-10, 30, 0], thighL: [-60, 0, 6], shinL: [40, 0, 0], thighR: [35, 0, -6], shinR: [5, 0, 0] }, r: [0, -0.14, 0.32], smear: 1 },
    { t: 0.58, e: 'out', p: { armL: [-15, 0, -14], foreL: [-5, 0, 0], weapon: [0, 0, 0], armR: [30, 0, -35], foreR: [-30, 0, 0], chest: [25, -48, 0], spine: [6, -15, 0], head: [-10, 32, 0], thighL: [-62, 0, 6], shinL: [42, 0, 0], thighR: [36, 0, -6], shinR: [5, 0, 0] }, r: [0, -0.15, 0.33], smear: 0 },
    { t: 0.95, e: 'inOut', p: { ...W_READY, chest: [2, -8, 0], thighL: [-10, 0, 6], thighR: [8, 0, -6], shinL: [12, 0, 0], shinR: [8, 0, 0] }, r: [0, -0.01, 0] },
  ] },
  attack_thrust: { dur: 0.9, hit: 0.38, keys: [
    { t: 0, p: { ...W_READY, chest: [2, -8, 0], thighL: [-10, 0, 6], thighR: [8, 0, -6], shinL: [12, 0, 0], shinR: [8, 0, 0] } },
    { t: 0.22, e: 'out', p: { armL: [-60, 0, 25], foreL: [-80, 0, 0], weapon: [-30, 0, 0], armR: [-70, 0, -10], foreR: [-40, 0, 0], chest: [-4, 40, 0], head: [0, -30, 0], thighL: [-20, 0, 8], shinL: [45, 0, 0], thighR: [30, 0, -8], shinR: [40, 0, 0] }, r: [0, -0.1, -0.15] },
    { t: 0.38, e: 'snap', p: { armL: [-88, 0, 5], foreL: [-4, 0, 0], weapon: [-90, 0, 0], armR: [-30, 0, -30], foreR: [-20, 0, 0], chest: [15, -30, 0], head: [-8, 20, 0], thighL: [-70, 0, 6], shinL: [30, 0, 0], thighR: [40, 0, -6], shinR: [5, 0, 0] }, r: [0, -0.12, 0.45], smear: 1 },
    { t: 0.6, e: 'out', p: { armL: [-88, 0, 5], foreL: [-4, 0, 0], weapon: [-90, 0, 0], armR: [-30, 0, -30], foreR: [-20, 0, 0], chest: [15, -30, 0], head: [-8, 20, 0], thighL: [-70, 0, 6], shinL: [30, 0, 0], thighR: [40, 0, -6], shinR: [5, 0, 0] }, r: [0, -0.12, 0.45] },
    { t: 0.9, p: { ...W_READY, chest: [2, -8, 0], thighL: [-10, 0, 6], thighR: [8, 0, -6], shinL: [12, 0, 0], shinR: [8, 0, 0] } },
  ] },
  cast: { dur: 1.0, hit: 0.55, keys: [
    { t: 0, p: { ...W_READY, chest: [2, -8, 0] } },
    { t: 0.25, e: 'out', p: { armL: [-60, 0, 30], foreL: [-60, 0, 0], weapon: [-90, 0, 0], armR: [-60, 0, -30], foreR: [-60, 0, 0], chest: [10, 0, 0], head: [10, 0, 0], thighL: [-8, 0, 8], thighR: [8, 0, -8], shinL: [15, 0, 0], shinR: [15, 0, 0] }, r: [0, -0.05, 0] },
    { t: 0.55, e: 'back', p: { armL: [-165, 0, 20], foreL: [-10, 0, 0], weapon: [0, 0, 0], armR: [-150, 0, -35], foreR: [-15, 0, 0], chest: [-12, 0, 0], head: [-18, 0, 0], thighL: [-5, 0, 10], thighR: [5, 0, -10], shinL: [5, 0, 0], shinR: [5, 0, 0] }, r: [0, 0.04, 0], glow: 1 },
    { t: 0.8, p: { armL: [-160, 0, 20], foreL: [-10, 0, 0], weapon: [0, 0, 0], armR: [-145, 0, -35], foreR: [-15, 0, 0], chest: [-10, 0, 0], head: [-15, 0, 0] }, r: [0, 0.03, 0] },
    { t: 1.0, p: { ...W_READY, chest: [2, -8, 0] } },
  ] },
  hurt: { dur: 0.5, keys: [
    { t: 0, p: { ...W_READY } },
    { t: 0.08, e: 'snap', p: { armL: [20, 0, 40], foreL: [-30, 0, 0], weapon: [-90, 0, 0], armR: [20, 0, -45], foreR: [-30, 0, 0], chest: [-25, 15, 0], head: [-25, 10, 0], thighL: [15, 0, 6], thighR: [-15, 0, -6], shinL: [20, 0, 0], shinR: [25, 0, 0] }, r: [0, -0.05, -0.25] },
    { t: 0.5, e: 'inOut', p: { ...W_READY, chest: [2, -8, 0] }, r: [0, 0, -0.05] },
  ] },
  guard: { dur: 0.3, loop: true, keys: [
    { t: 0, p: { armL: [-70, 0, -20], foreL: [-80, 0, 0], weapon: [-90, 0, 0], armR: [-60, 0, -10], foreR: [-70, 0, 0], chest: [12, -20, 0], head: [8, 15, 0], thighL: [-40, 0, 12], shinL: [50, 0, 0], thighR: [25, 0, -12], shinR: [35, 0, 0] }, r: [0, -0.1, 0] },
    { t: 0.3, p: { armL: [-70, 0, -20], foreL: [-80, 0, 0], weapon: [-90, 0, 0], armR: [-60, 0, -10], foreR: [-70, 0, 0], chest: [12, -20, 0], head: [8, 15, 0], thighL: [-40, 0, 12], shinL: [50, 0, 0], thighR: [25, 0, -12], shinR: [35, 0, 0] }, r: [0, -0.1, 0] },
  ] },
  victory: { dur: 1.6, loop: false, keys: [
    { t: 0, p: { ...W_READY } },
    { t: 0.35, e: 'out', p: { armL: [-30, 0, 30], foreL: [-60, 0, 0], weapon: [-60, 0, 0], chest: [10, 0, 0], thighL: [-20, 0, 8], shinL: [40, 0, 0], thighR: [-20, 0, -8], shinR: [40, 0, 0] }, r: [0, -0.1, 0], spin: 0 },
    { t: 0.75, e: 'out', p: { armL: [-175, 0, 10], foreL: [-5, 0, 0], weapon: [-5, 0, 0], armR: [-10, 0, -50], foreR: [-100, 0, 0], chest: [-8, 15, 0], head: [-10, -10, 0], thighL: [-15, 0, 8], thighR: [10, 0, -8], shinL: [5, 0, 0], shinR: [5, 0, 0] }, r: [0, 0.05, 0], spin: 360 },
    { t: 1.6, p: { armL: [-172, 0, 10], foreL: [-5, 0, 0], weapon: [-5, 0, 0], armR: [-10, 0, -50], foreR: [-100, 0, 0], chest: [-6, 15, 0], head: [-8, -10, 0], thighL: [-15, 0, 8], thighR: [10, 0, -8], shinL: [5, 0, 0], shinR: [5, 0, 0] }, r: [0, 0.04, 0], spin: 360 },
  ] },
  ko: { dur: 0.6, keys: [
    { t: 0, p: { ...W_READY } },
    { t: 0.25, e: 'in', p: { chest: [-20, 0, 0], head: [-20, 0, 0], thighL: [-40, 0, 0], shinL: [80, 0, 0], thighR: [-40, 0, 0], shinR: [80, 0, 0], armL: [30, 0, 30], armR: [30, 0, -30] }, r: [0, -0.35, -0.1], tilt: -20 },
    { t: 0.6, e: 'out', p: { chest: [-5, 0, 0], head: [-10, 30, 0], thighL: [-10, 0, 10], shinL: [20, 0, 0], thighR: [-5, 0, -10], shinR: [10, 0, 0], armL: [-10, 0, 70], armR: [-10, 0, -70], weapon: [-90, 0, 0] }, r: [0, 0.12, -0.5], tilt: -90 },
  ] },
  jump: { dur: 0.5, hit: 0.3, keys: [
    { t: 0, p: { ...W_READY } },
    { t: 0.2, e: 'out', p: { armL: [-40, 0, 20], foreL: [-60, 0, 0], weapon: [-60, 0, 0], chest: [25, 0, 0], thighL: [-70, 0, 8], shinL: [110, 0, 0], thighR: [-60, 0, -8], shinR: [110, 0, 0] }, r: [0, -0.35, 0] },
    { t: 0.5, e: 'out', p: { armL: [-170, 0, 10], foreL: [0, 0, 0], weapon: [0, 0, 0], armR: [-160, 0, -10], chest: [-10, 0, 0], thighL: [10, 0, 5], shinL: [20, 0, 0], thighR: [20, 0, -5], shinR: [30, 0, 0] }, r: [0, 0.2, 0] },
  ] },
  dive: { dur: 0.4, hit: 0.15, keys: [
    { t: 0, p: { armL: [-200, 0, 0], foreL: [0, 0, 0], weapon: [0, 0, 0], chest: [30, 0, 0], thighL: [-90, 0, 5], shinL: [120, 0, 0], thighR: [-80, 0, -5], shinR: [120, 0, 0] }, tilt: 0 },
    { t: 0.15, e: 'snap', p: { armL: [-30, 0, 0], foreL: [0, 0, 0], weapon: [-10, 0, 0], chest: [40, 0, 0], thighL: [-80, 0, 5], shinL: [100, 0, 0], thighR: [-30, 0, -5], shinR: [60, 0, 0] }, r: [0, -0.2, 0.1], smear: 1 },
    { t: 0.4, p: { ...W_READY, chest: [10, 0, 0], thighL: [-40, 0, 6], shinL: [60, 0, 0], thighR: [20, 0, -6], shinR: [40, 0, 0] }, r: [0, -0.15, 0] },
  ] },
};
HUMAN_ANIMS.attack = HUMAN_ANIMS.attack_slash;

// ─────────────────────────────────────────────────────────────
//  RigSprite: 리그를 작은 렌더 타깃에 그리고 외곽선 처리
// ─────────────────────────────────────────────────────────────
const OUTLINE_FRAG = `
  uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 texel; uniform vec3 ink; uniform float flash; uniform vec3 flashCol; uniform float glow; uniform vec3 glowCol; uniform float alphaMul;
  varying vec2 vUv;
  void main(){
    vec4 c = texture2D(tColor, vUv);
    float d = texture2D(tDepth, vUv).r;
    vec2 o[4]; o[0] = vec2(texel.x, 0.0); o[1] = vec2(-texel.x, 0.0); o[2] = vec2(0.0, texel.y); o[3] = vec2(0.0, -texel.y);
    if (c.a < 0.5) {
      float n = 0.0; float g2 = 0.0;
      for (int i = 0; i < 4; i++) { n = max(n, texture2D(tColor, vUv + o[i]).a); }
      if (n > 0.5) { gl_FragColor = vec4(mix(ink, glowCol, glow), 1.0); return; }
      if (glow > 0.01) { for (int i = 0; i < 4; i++) g2 = max(g2, texture2D(tColor, vUv + o[i] * 2.0).a); if (g2 > 0.5) { gl_FragColor = vec4(glowCol, glow); return; } }
      gl_FragColor = vec4(0.0); return;
    }
    // 깊이 불연속 = 내부 윤곽선
    float edge = 0.0;
    for (int i = 0; i < 2; i++) { float dn = texture2D(tDepth, vUv + o[i * 2]).r; if (dn - d > 0.012) edge = 1.0; }
    vec3 rgb = c.rgb;
    if (edge > 0.5) rgb = mix(rgb, ink, 0.55);
    rgb = mix(rgb, flashCol, flash);
    gl_FragColor = vec4(rgb, alphaMul);
  }`;

export class RigSprite {
  constructor(rig, { w = 128, h = 128, viewW = 128 / PX, tilt = 16, centerY = null } = {}) {
    this.rig = rig;
    this.scene = new THREE.Scene();
    this.scene.add(rig.root);
    const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(-2, 3, 3); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xb8d0ff, 1.1); rim.position.set(2.5, 1.5, -2); this.scene.add(rim);
    this.ambient = new THREE.AmbientLight(0xffffff, 1.05); this.scene.add(this.ambient);
    this.glowLight = new THREE.PointLight(0xffffff, 0, 3); this.glowLight.position.set(0, 1.2, 0.8); this.scene.add(this.glowLight);
    this.w = w; this.h = h;
    const viewH = viewW * h / w;
    this.viewW = viewW; this.viewH = viewH;
    const cy = centerY ?? viewH * 0.42;
    this.cam = new THREE.OrthographicCamera(-viewW / 2, viewW / 2, viewH / 2, -viewH / 2, 0.1, 30);
    const tr = tilt * D2R;
    this.cam.position.set(0, cy + Math.sin(tr) * 10, Math.cos(tr) * 10);
    this.cam.lookAt(0, cy, 0);
    this.anchorY = cy * Math.cos(tr); // 평면 중심 높이 (발이 그룹 원점에 오도록)
    this.rtA = new THREE.WebGLRenderTarget(w, h, { magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter, depthBuffer: true });
    this.rtA.depthTexture = new THREE.DepthTexture(w, h);
    this.rtB = new THREE.WebGLRenderTarget(w, h, { magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter, depthBuffer: false });
    this.rtB.texture.generateMipmaps = false;
    this.uniforms = {
      tColor: { value: this.rtA.texture }, tDepth: { value: this.rtA.depthTexture }, texel: { value: new THREE.Vector2(1 / w, 1 / h) },
      ink: { value: new THREE.Color(0.07, 0.05, 0.1) }, flash: { value: 0 }, flashCol: { value: new THREE.Color(1, 1, 1) },
      glow: { value: 0 }, glowCol: { value: new THREE.Color(0.6, 0.95, 1) }, alphaMul: { value: 1 },
    };
    this.quad = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: OUTLINE_FRAG, transparent: true,
    }));
    this.texture = this.rtB.texture;
  }
  render() {
    const r = RENDERER; if (!r) return;
    const prevT = r.getRenderTarget(), prevTM = r.toneMapping, prevClear = r.getClearAlpha();
    const prevCol = r.getClearColor(new THREE.Color());
    r.toneMapping = THREE.NoToneMapping;
    r.setClearColor(0x000000, 0);
    r.setRenderTarget(this.rtA); r.clear(); r.render(this.scene, this.cam);
    r.setRenderTarget(this.rtB); r.clear(); this.quad.render(r);
    r.setRenderTarget(prevT); r.toneMapping = prevTM; r.setClearColor(prevCol, prevClear);
  }
  dispose() { this.rtA.dispose(); this.rtB.dispose(); }
}

// ─────────────────────────────────────────────────────────────
//  RigBillboard: Billboard와 같은 API (play/update/flash/offset/flipped/setAlpha)
// ─────────────────────────────────────────────────────────────
export class RigBillboard {
  constructor(rig, { size = 128, viewW, scale = 1, anims = HUMAN_ANIMS, baseYaw = -62, shadow = true, centerY } = {}) {
    this.rig = rig;
    this.anims = anims;
    this.scale = scale;
    this.sprite = new RigSprite(rig, { w: size, h: size, viewW: viewW || size / PX, centerY });
    this.group = new THREE.Group();
    const W = this.sprite.viewW * scale, H = this.sprite.viewH * scale;
    this.width = W * 0.5; this.height = H * 0.78;
    const geo = new THREE.PlaneGeometry(W, H);
    geo.translate(0, H / 2 - (this.sprite.viewH / 2 - this.sprite.anchorY) * scale, 0);
    this.mat = new THREE.MeshLambertMaterial({ map: this.sprite.texture, alphaTest: 0.5, transparent: false, side: THREE.DoubleSide });
    this.mat.emissive = new THREE.Color(0, 0, 0); this.mat.emissiveMap = this.sprite.texture;
    this.glow = 0.12;
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.group.add(this.mesh);
    // 그림자 전용 세로 평면
    this.shadowMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    this.shadowMesh.castShadow = shadow;
    this.shadowMesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.sprite.texture, alphaTest: 0.5 });
    this.group.add(this.shadowMesh);
    this.offset = new THREE.Vector3();
    this.anim = 'idle'; this.time = 0; this.speed = 1;
    this.onEnd = null; this.onHit = null; this.hitFired = false;
    this.flashT = 0; this.flashColor = new THREE.Color(1, 1, 1);
    this.flipped = false;
    this.baseYaw = baseYaw;   // 기본: 왼쪽(적 방향)을 3/4로 바라봄
    this.yaw = null;          // 필드에서 이동 방향으로 직접 지정
    this.curYaw = baseYaw;
    this.alpha = 1;
    this.prevRoot = new THREE.Vector3();
    this.play('idle');
  }
  get sheet() { return { meta: { anims: this.anims } }; }
  setSheet() {}
  play(name, { onEnd = null, onHit = null, speed = 1, restart = true } = {}) {
    if (name === 'attack' && this.rig.attackAnim) name = this.rig.attackAnim;
    if (!this.anims[name]) name = 'idle';
    if (!restart && this.anim === name) return;
    const pendHit = this.onHit, pendEnd = this.onEnd;
    this.onHit = null; this.onEnd = null;
    pendHit?.(); pendEnd?.();
    this.anim = name; this.time = 0; this.speed = speed;
    this.onEnd = onEnd; this.onHit = onHit; this.hitFired = false;
    const a = this.anims[name];
    if (onHit && a.hit === undefined && a.loop) { this.onHit = null; this.hitFired = true; onHit(); }
    if (onEnd && a.loop) { this.onEnd = null; onEnd(); }
  }
  flash(dur = 0.12, color = 0xffffff) { this.flashT = dur; this.flashColor.set(color); }
  setAlpha(a) {
    this.alpha = a;
    this.mat.transparent = a < 1; this.mat.opacity = a; this.mat.alphaTest = a < 1 ? 0.01 : 0.5; this.mat.depthWrite = a >= 1; this.mat.needsUpdate = true;
  }
  update(dt, camera) {
    const a = this.anims[this.anim];
    this.time += dt * this.speed;
    if (a.hit !== undefined && !this.hitFired && this.time >= a.hit) { this.hitFired = true; const h = this.onHit; this.onHit = null; h?.(); }
    if (!a.loop && this.time >= a.dur) {
      const h = this.onHit; this.onHit = null; h?.();
      const cb = this.onEnd; this.onEnd = null; cb?.();
    }
    const s = samplePose(this.anims[this.anim], this.time);
    const rig = this.rig, B = rig.b;
    for (const n in B) { const o = B[n]; if (o.isObject3D && o.userData.rest === undefined) o.userData.rest = o.rotation.clone(); }
    for (const n in B) { const o = B[n]; if (o.userData.rest && !o.userData.spring) o.rotation.copy(o.userData.rest); }
    for (const [n, r] of Object.entries(s.pose)) { const o = B[n]; if (o) o.rotation.set(o.userData.rest.x + r[0] * D2R, o.userData.rest.y + r[1] * D2R, o.userData.rest.z + r[2] * D2R); }
    // 방향 (필드: 이동 방향 / 전투: 3/4 왼쪽 또는 오른쪽)
    const targetYaw = this.yaw != null ? this.yaw : (this.flipped ? -this.baseYaw : this.baseYaw);
    let dy = ((targetYaw - this.curYaw + 540) % 360) - 180;
    this.curYaw += dy * Math.min(1, dt * 14);
    const yaw = (this.curYaw + (s.spin || 0)) * D2R;
    rig.root.rotation.set((s.tilt || 0) * D2R, yaw, 0);
    // 루트 이동은 캐릭터 정면 기준
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    rig.root.position.set(s.root[0] * Math.cos(yaw) + s.root[2] * fx, s.root[1], -s.root[0] * Math.sin(yaw) + s.root[2] * fz);
    // 스프링 (망토/머리/리본)
    const rootVel = rig.root.position.clone().sub(this.prevRoot).divideScalar(Math.max(dt, 1e-3));
    this.prevRoot.copy(rig.root.position);
    const t = performance.now() / 1000;
    for (const sp of rig.springs) {
      const target = sp.rest + (Math.sin(t * 2.3 + sp.side) * 0.08 * sp.wind) + Math.min(0.9, (rootVel.length() + (this.moving || 0)) * 0.25) * sp.gain;
      const f = (target - sp.val) * sp.k - sp.vel * sp.damp;
      sp.vel += f * Math.min(dt, 0.05); sp.val += sp.vel * Math.min(dt, 0.05);
      sp.bone.userData.spring = true;
      sp.bone.rotation.x = sp.val;
    }
    for (const fn of rig.extraUpdate) fn(dt, t, s);
    // 휘두르기 잔상
    if (rig.smear) { rig.smear.visible = s.smear > 0.05; rig.smear.material.opacity = s.smear * 0.85; }
    // 플래시/발광
    const U = this.sprite.uniforms;
    if (this.flashT > 0) { this.flashT -= dt; U.flash.value = 0.85; U.flashCol.value.copy(this.flashColor); } else U.flash.value = 0;
    const kf = this.anims[this.anim].keys;
    const glowing = this.anim === 'cast' && this.time > 0.3 && this.time < 0.9;
    if (glowing) { U.glow.value = 0.9; U.glowCol.value.setRGB(0.6, 0.95, 1); }
    else if (this.selGlow) { U.glow.value = this.selGlow * (0.7 + Math.sin(performance.now() * 0.009) * 0.3); U.glowCol.value.setRGB(1, 0.82, 0.35); }
    else U.glow.value = 0;
    this.sprite.glowLight.intensity = glowing ? 6 : 0;
    this.sprite.render();
    // 카메라를 향하는 빌보드 (그림자는 세로 평면)
    if (camera) {
      const wp = this.group.getWorldPosition(_v);
      this.mesh.lookAt(_v2.copy(camera.position).setY(wp.y + (camera.position.y - wp.y) * 0.55));
      this.shadowMesh.rotation.set(0, Math.atan2(camera.position.x - wp.x, camera.position.z - wp.z), 0);
    }
    this.mesh.position.copy(this.offset);
    this.shadowMesh.position.copy(this.offset);
    this.mat.emissive.setScalar(this.glow);
  }
  dispose() { this.sprite.dispose(); this.mesh.geometry.dispose(); this.mat.dispose(); }
}
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();

// 렌더 타깃 내용을 sRGB dataURL로 (초상화/미리보기용)
export function readSpriteURL(sp) {
  const r = RENDERER, w = sp.w, h = sp.h, buf = new Uint8Array(w * h * 4);
  r.readRenderTargetPixels(sp.rtB, 0, 0, w, h, buf);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const img = c.getContext('2d').createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const si = ((h - 1 - y) * w + x) * 4, di = (y * w + x) * 4;
    for (let k = 0; k < 3; k++) img.data[di + k] = Math.pow(buf[si + k] / 255, 1 / 2.2) * 255;
    img.data[di + 3] = buf[si + 3] > 127 ? 255 : 0;
  }
  c.getContext('2d').putImageData(img, 0, 0);
  return c.toDataURL();
}
