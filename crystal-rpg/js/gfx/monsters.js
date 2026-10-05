// ─────────────────────────────────────────────────────────────
//  몬스터 3D 리그 (영웅과 같은 3D → 도트 파이프라인)
//   모델 정면 = +z, 발 = y 0. 뼈 회전 x+ = 앞으로 숙임, 꼬리 x+ = 위로
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { Rig, RigBillboard, toon, capsule, taper, box, ball, cone, at, bone, PX } from './rig.js';

const D2R = Math.PI / 180;
const glowMat = (c, k = 1.2) => toon(c, { emissive: k });

function eyes(parent, x, y, z, r, { color = 0x16101e, glow = 0, white = true, sx = 1, sy = 1.25 } = {}) {
  for (const s of [-1, 1]) {
    const e = ball(r, color, sx, sy, 0.6, glow ? { emissive: glow } : undefined); at(e, s * x, y, z); parent.add(e);
    if (white) { const w = ball(r * 0.36, 0xffffff, 1, 1, 1, { emissive: 1 }); at(w, s * x - r * 0.3 * s, y + r * 0.4, z + r * 0.45); parent.add(w); }
  }
}
// 날개 막: 점 목록(x,y)으로 평면 도형
function membrane(pts, c, opt) {
  const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) sh.lineTo(p[0], p[1]);
  const g = new THREE.ShapeGeometry(sh);
  return new THREE.Mesh(g, toon(c, { side: THREE.DoubleSide, ...(opt || {}) }));
}
function crystal(parent, x, y, z, h, r, c, rx = 0, rz = 0, glow = 0.9) {
  const m = cone(r, h, c, 5, { emissive: glow }); at(m, x, y, z, rx, 0, rz); parent.add(m); return m;
}
function tailChain(rig, parent, n, segLen, r0, r1, c, opts = {}) {
  let p = parent; const bones = [];
  for (let i = 0; i < n; i++) {
    const b = bone('tail' + i, p, 0, 0, i === 0 ? 0 : -segLen);
    const k = i / Math.max(1, n - 1);
    const seg = capsule(r0 + (r1 - r0) * k, segLen * 0.9, c); seg.rotation.x = Math.PI / 2; b.add(seg);
    rig.b['tail' + i] = b; bones.push(b);
    if (opts.spring !== false) rig.addSpring(b, { rest: (opts.lift || 0) * D2R, k: 40, damp: 6, gain: 0.15, wind: 0.4, side: i });
    p = b;
  }
  return bones;
}
const K = (t, p, extra = {}) => ({ t, p, ...extra });

// ── 슬라임 ──
function slime(variant) {
  const ice = variant === 'slimeIce';
  const rig = new Rig(); const R = rig.root, b = rig.b;
  const body = b.body = bone('body', R); rig.squashBone = body;
  const c = ice ? 0x8fd8f0 : 0x6cc850, cs = ice ? 0x4f9cc8 : 0x3f8f3a;
  const blob = ball(0.34, c, 1.05, 0.82, 1); at(blob, 0, 0.27, 0); body.add(blob);
  const base = ball(0.36, cs, 1.08, 0.3, 1.04); at(base, 0, 0.07, 0); body.add(base);
  const hl = ball(0.07, 0xffffff, 1.4, 0.8, 0.6, { emissive: 0.8 }); at(hl, -0.13, 0.42, 0.2); body.add(hl);
  b.face = bone('face', body, 0, 0.27, 0.27);
  eyes(b.face, 0.1, 0.03, 0.02, 0.05);
  const mouth = box(0.07, 0.02, 0.02, 0x2a1820); at(mouth, 0, -0.07, 0.03); b.face.add(mouth);
  b.top = bone('top', body, 0, 0.52, 0);
  if (ice) { crystal(b.top, 0, -0.04, 0, 0.26, 0.07, 0xd8f6ff, 0, 0); crystal(b.top, 0.09, -0.06, 0.02, 0.17, 0.05, 0xbfeaff, 0, -25); crystal(b.top, -0.08, -0.06, -0.03, 0.15, 0.05, 0xbfeaff, 0, 30); }
  else { const st = taper(0.012, 0.016, 0.1, 0x3f7a2a, { up: true }); b.top.add(st); for (const s of [-1, 1]) { const lf = ball(0.08, 0x8ee060, 1.6, 0.35, 0.8); at(lf, s * 0.09, 0.1, 0, 0, 0, s * 25); b.top.add(lf); } }
  rig.addSpring(b.top, { k: 50, damp: 5, gain: 0.5 });
  const anims = {
    idle: { dur: 1.2, loop: true, keys: [K(0, {}, { sq: 0.06 }), K(0.6, { face: [4, 0, 0] }, { sq: -0.05 }), K(1.2, {}, { sq: 0.06 })] },
    attack: { dur: 0.8, hit: 0.42, keys: [K(0, {}, {}), K(0.22, { face: [-6, 0, 0] }, { sq: 0.3, r: [0, 0, -0.05] }), K(0.34, {}, { sq: -0.25, r: [0, 0.35, 0.35] }), K(0.42, { face: [8, 0, 0] }, { sq: 0.2, r: [0, 0.05, 0.7], e: 'in' }), K(0.6, {}, { sq: 0.1, r: [0, 0, 0.5] }), K(0.8, {}, { r: [0, 0, 0] })] },
    cast: { dur: 1.0, hit: 0.55, keys: [K(0, {}), K(0.3, {}, { sq: 0.32 }), K(0.55, { face: [-10, 0, 0] }, { sq: -0.3, r: [0, 0.25, 0], e: 'back', glow: 1 }), K(1, {}, { sq: 0 })] },
    hurt: { dur: 0.45, keys: [K(0, {}), K(0.07, { face: [-14, 0, 0] }, { sq: -0.25, r: [0, 0.04, -0.15], e: 'snap' }), K(0.45, {}, { sq: 0 })] },
  };
  return { rig, anims, size: 72, bodyH: 0.62, bodyW: 0.8, mul: 1.25 };
}

// ── 뿔토끼 ──
function rabbit() {
  const rig = new Rig(); const R = rig.root, b = rig.b;
  const body = b.body = bone('body', R, 0, 0.24, 0);
  const fur = 0xf2ece0, furS = 0xc9bba6;
  const torso = ball(0.22, fur, 1, 0.9, 1.15); body.add(torso);
  const belly = ball(0.15, 0xfffaf0, 1, 0.9, 0.8); at(belly, 0, -0.04, 0.1); body.add(belly);
  const tail = ball(0.08, 0xffffff); at(tail, 0, 0.02, -0.24); body.add(tail);
  b.head = bone('head', body, 0, 0.16, 0.14);
  const hd = ball(0.17, fur, 1, 0.92, 1); at(hd, 0, 0.06, 0.04); b.head.add(hd);
  const snout = ball(0.07, 0xfffaf0, 1.2, 0.8, 0.8); at(snout, 0, 0.0, 0.18); b.head.add(snout);
  const nose = ball(0.022, 0xe07a8a); at(nose, 0, 0.03, 0.23); b.head.add(nose);
  eyes(b.head, 0.09, 0.08, 0.15, 0.04, { color: 0xb02838 });
  const horn = cone(0.035, 0.2, 0xe8c050, 6, { emissive: 0.15 }); at(horn, 0, 0.18, 0.12, 30, 0, 0); b.head.add(horn);
  for (const s of [-1, 1]) {
    const ear = b['ear' + (s > 0 ? 'L' : 'R')] = bone('ear', b.head, s * 0.07, 0.18, -0.02);
    ear.rotation.set(-10 * D2R, 0, -s * 12 * D2R);
    const e1 = capsule(0.045, 0.26, fur); e1.rotation.x = Math.PI; ear.add(e1);
    const e2 = capsule(0.025, 0.2, 0xf0b0b8); e2.rotation.x = Math.PI; at(e2, 0, 0.01, 0.022); e2.rotation.x = Math.PI; ear.add(e2);
    rig.addSpring(ear, { rest: -10 * D2R, k: 35, damp: 5, gain: 0.5, side: s });
    const fl = b['legF' + (s > 0 ? 'L' : 'R')] = bone('legF', body, s * 0.09, -0.1, 0.12);
    fl.add(capsule(0.035, 0.1, fur));
    const bl = b['legB' + (s > 0 ? 'L' : 'R')] = bone('legB', body, s * 0.12, -0.06, -0.1);
    const th = ball(0.09, fur, 0.8, 1, 1.2); bl.add(th);
    const ft = ball(0.05, furS, 0.9, 0.6, 1.8); at(ft, 0, -0.15, 0.04); bl.add(ft);
  }
  const anims = {
    idle: { dur: 1.0, loop: true, keys: [K(0, { head: [0, 0, 0] }, { r: [0, 0, 0] }), K(0.15, { head: [5, 0, 0] }, { r: [0, 0.05, 0] }), K(0.3, { head: [0, 0, 0] }, { r: [0, 0, 0] }), K(1.0, { head: [-3, 8, 0] }, { r: [0, 0, 0] })] },
    attack: { dur: 0.8, hit: 0.4, keys: [K(0, {}), K(0.2, { body: [-20, 0, 0], head: [-10, 0, 0], legBL: [30, 0, 0], legBR: [30, 0, 0] }, { r: [0, -0.04, -0.08] }), K(0.4, { body: [40, 0, 0], head: [25, 0, 0], legBL: [-60, 0, 0], legBR: [-60, 0, 0], legFL: [-50, 0, 0], legFR: [-50, 0, 0] }, { r: [0, 0.25, 0.7], e: 'snap' }), K(0.6, { body: [10, 0, 0] }, { r: [0, 0.05, 0.5] }), K(0.8, {}, { r: [0, 0, 0] })] },
    cast: { dur: 1.0, hit: 0.55, keys: [K(0, {}), K(0.3, { body: [-30, 0, 0], head: [-20, 0, 0] }, { r: [0, 0.15, 0] }), K(0.55, { body: [-35, 0, 0], head: [-30, 0, 0] }, { r: [0, 0.2, 0], glow: 1 }), K(1, {})] },
    hurt: { dur: 0.45, keys: [K(0, {}), K(0.07, { body: [-25, 0, 0], head: [-30, 0, 0] }, { r: [0, 0.05, -0.2], e: 'snap' }), K(0.45, {})] },
  };
  return { rig, anims, size: 80, bodyH: 0.75, bodyW: 0.7, mul: 1.25 };
}

// ── 버섯 ──
function mushroom(variant) {
  const purple = variant === 'mushroomP';
  const rig = new Rig(); const R = rig.root, b = rig.b;
  const body = b.body = bone('body', R, 0, 0.05, 0); rig.squashBone = body;
  const stem = taper(0.13, 0.17, 0.42, 0xf0e2c8, { up: true, sides: 10 }); body.add(stem);
  b.face = bone('face', body, 0, 0.24, 0.13);
  eyes(b.face, 0.06, 0, 0.02, 0.04, purple ? { color: 0xff70e0, glow: 1, white: false } : {});
  const mouth = box(0.08, 0.025, 0.02, 0x3a2028); at(mouth, 0, -0.08, 0.02); b.face.add(mouth);
  b.cap = bone('cap', body, 0, 0.4, 0);
  const capC = purple ? 0x8a4ad0 : 0xd8402e, spotC = purple ? 0x7ff0ff : 0xfff6e8;
  const capG = new THREE.SphereGeometry(0.32, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55); capG.scale(1, 0.75, 1);
  const cap = new THREE.Mesh(capG, toon(capC)); b.cap.add(cap);
  const under = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16), toon(0xe8d0b0, { side: THREE.DoubleSide })); under.rotation.x = Math.PI / 2; under.position.y = 0.05; b.cap.add(under);
  const spots = [[0, 0.24, 0.05, 0.06], [0.16, 0.17, 0.12, 0.045], [-0.17, 0.16, 0.1, 0.05], [0.05, 0.14, 0.24, 0.045], [-0.1, 0.2, -0.16, 0.05], [0.2, 0.12, -0.12, 0.04]];
  for (const [x, y, z, r] of spots) { const sp = ball(r, spotC, 1, 0.45, 1, purple ? { emissive: 0.9 } : undefined); sp.position.set(x, y, z); sp.lookAt(x * 3, y * 3 + 0.2, z * 3); b.cap.add(sp); }
  for (const s of [-1, 1]) {
    const a = b['arm' + (s > 0 ? 'L' : 'R')] = bone('arm', body, s * 0.15, 0.2, 0); a.rotation.z = s * 30 * D2R;
    a.add(capsule(0.03, 0.12, 0xe8d8bc));
    const f = b['foot' + (s > 0 ? 'L' : 'R')] = bone('foot', body, s * 0.08, 0.02, 0.02);
    const fm = ball(0.06, 0xd8c4a0, 1, 0.6, 1.4); f.add(fm);
  }
  rig.addSpring(b.cap, { k: 45, damp: 5, gain: 0.3 });
  const anims = {
    idle: { dur: 1.4, loop: true, keys: [K(0, { cap: [0, 0, 4] }, { sq: 0.03 }), K(0.7, { cap: [0, 0, -4], face: [3, 0, 0] }, { sq: -0.03 }), K(1.4, { cap: [0, 0, 4] }, { sq: 0.03 })] },
    attack: { dur: 0.85, hit: 0.42, keys: [K(0, {}), K(0.24, { cap: [-25, 0, 0], body: [-12, 0, 0] }, { sq: 0.2 }), K(0.42, { cap: [40, 0, 0], body: [25, 0, 0] }, { sq: -0.15, r: [0, 0.1, 0.55], e: 'snap' }), K(0.6, { cap: [30, 0, 0], body: [18, 0, 0] }, { r: [0, 0, 0.5] }), K(0.85, {})] },
    cast: { dur: 1.0, hit: 0.55, keys: [K(0, {}), K(0.3, { cap: [-10, 0, 0], armL: [0, 0, 60], armR: [0, 0, -60] }, { sq: 0.25 }), K(0.55, { cap: [-20, 0, 0], armL: [0, 0, 100], armR: [0, 0, -100] }, { sq: -0.25, r: [0, 0.12, 0], e: 'back', glow: 1 }), K(1, {})] },
    hurt: { dur: 0.45, keys: [K(0, {}), K(0.07, { cap: [-30, 0, 0], body: [-15, 0, 0] }, { sq: -0.2, r: [0, 0, -0.15], e: 'snap' }), K(0.45, {})] },
  };
  return { rig, anims, size: 80, bodyH: 0.85, bodyW: 0.75, mul: 1.2 };
}

// ── 사족 보행 (늑대) ──
function wolf() {
  const rig = new Rig(); const R = rig.root, b = rig.b;
  const fur = 0x6a7a96, furD = 0x3c4660, furL = 0xc8d0dc;
  const body = b.body = bone('body', R, 0, 0.55, 0);
  const torso = capsule(0.19, 0.5, fur); at(torso, 0, 0, 0.3); torso.rotation.x = Math.PI / 2; body.add(torso);
  const back = capsule(0.12, 0.42, furD); at(back, 0, 0.11, 0.24); back.rotation.x = Math.PI / 2; body.add(back);
  b.chest = bone('chest', body, 0, 0.02, 0.28);
  const ch = ball(0.24, fur, 1, 1.05, 1); b.chest.add(ch);
  const mane = ball(0.25, furL, 1.05, 1.1, 0.8); at(mane, 0, -0.04, 0.08); b.chest.add(mane);
  b.head = bone('head', b.chest, 0, 0.2, 0.2);
  const hd = ball(0.15, fur, 1, 0.95, 1.1); b.head.add(hd);
  const snout = box(0.12, 0.1, 0.2, fur); at(snout, 0, -0.05, 0.16); b.head.add(snout);
  const nose = box(0.06, 0.04, 0.04, 0x1a1420); at(nose, 0, -0.02, 0.27); b.head.add(nose);
  b.jaw = bone('jaw', b.head, 0, -0.1, 0.06);
  const jaw = box(0.1, 0.035, 0.18, furL); at(jaw, 0, 0, 0.1); b.jaw.add(jaw);
  for (const s of [-1, 1]) { const f = cone(0.012, 0.04, 0xffffff, 4); at(f, s * 0.035, 0.0, 0.17, 180, 0, 0); b.jaw.add(f); }
  eyes(b.head, 0.075, 0.04, 0.12, 0.03, { color: 0xffd040, glow: 1.4, white: false, sy: 0.8 });
  for (const s of [-1, 1]) { const ear = cone(0.06, 0.14, furD, 4); at(ear, s * 0.08, 0.12, -0.03, -10, 0, -s * 15); b.head.add(ear); }
  // 다리 4개
  const legs = [['FL', 1, 0.3], ['FR', -1, 0.3], ['BL', 1, -0.22], ['BR', -1, -0.22]];
  for (const [n, s, z] of legs) {
    const th = b['thigh' + n] = bone('thigh' + n, body, s * 0.12, -0.05, z);
    th.add(capsule(n[0] === 'B' ? 0.08 : 0.065, 0.24, fur));
    const sh = b['shin' + n] = bone('shin' + n, th, 0, -0.26, 0);
    sh.add(capsule(0.045, 0.2, furD));
    const pw = ball(0.05, furD, 1, 0.6, 1.4); at(pw, 0, -0.22, 0.03); sh.add(pw);
  }
  b.tailBase = bone('tailBase', body, 0, 0.08, -0.28);
  tailChain(rig, b.tailBase, 3, 0.15, 0.07, 0.05, furD, { lift: 25 });
  const tip = ball(0.06, furL, 1, 1, 1.5); at(tip, 0, 0, -0.14); b.tail2.add(tip);
  const stand = { thighFL: [0, 0, 0], thighBL: [0, 0, 0] };
  const anims = {
    idle: { dur: 1.4, loop: true, keys: [K(0, { ...stand, chest: [0, 0, 0], head: [5, 0, 0] }, { r: [0, 0, 0] }), K(0.7, { chest: [-3, 0, 0], head: [0, 10, 0], jaw: [6, 0, 0] }, { r: [0, 0.015, 0] }), K(1.4, { chest: [0, 0, 0], head: [5, 0, 0] })] },
    walk: { dur: 0.6, loop: true, keys: [K(0, { thighFL: [-30, 0, 0], thighFR: [25, 0, 0], thighBL: [25, 0, 0], thighBR: [-30, 0, 0] }, { e: 'linear' }), K(0.3, { thighFL: [25, 0, 0], thighFR: [-30, 0, 0], thighBL: [-30, 0, 0], thighBR: [25, 0, 0] }, { e: 'linear', r: [0, 0.03, 0] }), K(0.6, { thighFL: [-30, 0, 0], thighFR: [25, 0, 0], thighBL: [25, 0, 0], thighBR: [-30, 0, 0] }, { e: 'linear' })] },
    attack: { dur: 0.85, hit: 0.4, keys: [
      K(0, {}),
      K(0.22, { body: [-14, 0, 0], chest: [-10, 0, 0], head: [-20, 0, 0], jaw: [35, 0, 0], thighFL: [-40, 0, 0], thighFR: [-40, 0, 0], thighBL: [30, 0, 0], thighBR: [30, 0, 0], shinBL: [-30, 0, 0], shinBR: [-30, 0, 0] }, { r: [0, -0.04, -0.12] }),
      K(0.4, { body: [12, 0, 0], chest: [10, 0, 0], head: [20, 0, 0], jaw: [0, 0, 0], thighFL: [-70, 0, 0], thighFR: [-70, 0, 0], thighBL: [50, 0, 0], thighBR: [50, 0, 0] }, { r: [0, 0.22, 0.75], e: 'snap', smear: 1 }),
      K(0.6, { body: [6, 0, 0], head: [15, 0, 0], jaw: [10, 0, 0] }, { r: [0, 0, 0.55] }),
      K(0.85, {}, { r: [0, 0, 0] })] },
    cast: { dur: 1.1, hit: 0.6, keys: [K(0, {}), K(0.3, { body: [-20, 0, 0], chest: [-25, 0, 0], head: [-45, 0, 0], jaw: [20, 0, 0], thighFL: [-30, 0, 0], thighFR: [-30, 0, 0] }, { r: [0, 0.1, 0] }), K(0.6, { body: [-24, 0, 0], chest: [-30, 0, 0], head: [-55, 0, 0], jaw: [45, 0, 0], thighFL: [-40, 0, 0], thighFR: [-40, 0, 0] }, { r: [0, 0.12, 0], glow: 1 }), K(1.1, {})] },
    hurt: { dur: 0.45, keys: [K(0, {}), K(0.07, { body: [-12, 0, 0], head: [-30, 0, 0], jaw: [20, 0, 0] }, { r: [0, 0.03, -0.18], e: 'snap' }), K(0.45, {})] },
  };
  return { rig, anims, size: 128, bodyH: 1.0, bodyW: 1.2, mul: 1.15 };
}

// ── 수정 박쥐 ──
function bat() {
  const rig = new Rig(); const R = rig.root, b = rig.b;
  const body = b.body = bone('body', R, 0, 0.5, 0);
  const c = 0x5e4c8e, cd = 0x3a2c58, mem = 0x9a62d8;
  body.add(ball(0.17, c, 1, 1.1, 0.95));
  const belly = ball(0.11, 0x8a7ab0, 1, 1.1, 0.7); at(belly, 0, -0.03, 0.08); body.add(belly);
  b.head = bone('head', body, 0, 0.16, 0.04);
  b.head.add(ball(0.12, c, 1.1, 0.95, 1));
  eyes(b.head, 0.055, 0.02, 0.1, 0.03, { color: 0xff4a6a, glow: 1.4, white: false });
  for (const s of [-1, 1]) {
    const ear = cone(0.06, 0.18, cd, 4); at(ear, s * 0.07, 0.07, -0.01, 0, 0, -s * 18); b.head.add(ear);
    const fang = cone(0.012, 0.04, 0xffffff, 4); at(fang, s * 0.025, -0.07, 0.1, 180, 0, 0); b.head.add(fang);
    const w = b['wing' + (s > 0 ? 'L' : 'R')] = bone('wing', body, s * 0.12, 0.06, 0);
    const arm = capsule(0.022, 0.42, cd); arm.rotation.z = s * 95 * D2R; w.add(arm);
    const m = membrane([[0, 0], [0.42, 0.04], [0.5, -0.12], [0.36, -0.1], [0.3, -0.26], [0.18, -0.18], [0.06, -0.3], [0, -0.14]], mem);
    m.scale.x = s; w.add(m);
    crystal(w, s * 0.3, 0.02, 0, 0.12, 0.03, 0x7ef0ff, 0, -s * 70);
    const ft = cone(0.02, 0.07, cd, 4); at(ft, s * 0.05, -0.2, 0, 180, 0, 0); body.add(ft);
  }
  crystal(body, 0, 0.12, -0.12, 0.16, 0.04, 0x7ef0ff, -35, 0); crystal(body, 0.05, 0.05, -0.14, 0.11, 0.03, 0x9af6ff, -50, -20);
  const flap = (t, up) => K(t, { wingL: [0, up ? -15 : 10, up ? 55 : -40], wingR: [0, up ? 15 : -10, up ? -55 : 40], body: [up ? -6 : 6, 0, 0] }, { r: [0, up ? -0.04 : 0.04, 0], e: 'inOut' });
  const anims = {
    idle: { dur: 0.5, loop: true, keys: [flap(0, false), flap(0.25, true), flap(0.5, false)] },
    attack: { dur: 0.75, hit: 0.38, keys: [flap(0, false), K(0.2, { wingL: [0, -20, 70], wingR: [0, 20, -70], head: [-20, 0, 0], body: [-15, 0, 0] }, { r: [0, 0.15, -0.1] }), K(0.38, { wingL: [0, 10, -50], wingR: [0, -10, 50], head: [25, 0, 0], body: [30, 0, 0] }, { r: [0, -0.1, 0.7], e: 'snap', smear: 1 }), K(0.55, { wingL: [0, 0, 20], wingR: [0, 0, -20] }, { r: [0, 0, 0.4] }), flap(0.75, false)] },
    cast: { dur: 1.0, hit: 0.55, keys: [flap(0, false), K(0.3, { wingL: [0, -30, 80], wingR: [0, 30, -80], head: [-25, 0, 0] }, { r: [0, 0.2, 0] }), K(0.55, { wingL: [0, -40, 95], wingR: [0, 40, -95], head: [-30, 0, 0] }, { r: [0, 0.25, 0], glow: 1 }), flap(1, false)] },
    hurt: { dur: 0.4, keys: [flap(0, false), K(0.07, { wingL: [0, 0, -50], wingR: [0, 0, 50], head: [-30, 0, 0] }, { r: [0, 0.05, -0.2], e: 'snap' }), flap(0.4, false)] },
  };
  return { rig, anims, size: 112, bodyH: 0.85, bodyW: 1.0, mul: 1.35, yaw: 30 };
}

// ── 불꽃 정령 ──
function wisp() {
  const rig = new Rig(); const R = rig.root, b = rig.b;
  const body = b.body = bone('body', R, 0, 0.45, 0); rig.squashBone = body;
  const core = ball(0.16, 0xfff0a0, 1, 1, 1, { emissive: 1.4 }); body.add(core);
  const layers = [];
  [[0.24, 0.55, 0xff9030, 0.9], [0.2, 0.45, 0xffc050, 1.1], [0.27, 0.38, 0xd84a20, 0.7]].forEach(([r, h, c, e], i) => {
    const f = cone(r, h, c, 7, { emissive: e }); at(f, 0, -0.12 + i * 0.02, 0); f.material = f.material.clone(); f.material.transparent = true; f.material.opacity = 0.92; body.add(f); layers.push(f);
  });
  const shell = ball(0.24, 0xff7a30, 1, 0.9, 1, { emissive: 0.8 }); at(shell, 0, -0.04, 0); body.add(shell);
  b.face = bone('face', body, 0, 0, 0.2);
  eyes(b.face, 0.07, 0.02, 0.02, 0.04, { color: 0x3a0a08, white: true, sy: 1.5 });
  const mouth = ball(0.035, 0x3a0a08, 1.4, 0.8, 0.5); at(mouth, 0, -0.07, 0.02); b.face.add(mouth);
  for (const s of [-1, 1]) { const a = b['arm' + (s > 0 ? 'L' : 'R')] = bone('arm', body, s * 0.22, -0.02, 0); const h = ball(0.06, 0xffb040, 1, 1, 1, { emissive: 1.2 }); at(h, s * 0.04, -0.04, 0.02); a.add(h); }
  const embers = [];
  for (let i = 0; i < 5; i++) { const e = ball(0.03, 0xffd070, 1, 1, 1, { emissive: 1.5 }); body.add(e); embers.push(e); }
  rig.extraUpdate.push((dt, t) => {
    layers.forEach((f, i) => { f.rotation.y = t * (2 + i) * (i % 2 ? -1 : 1); f.scale.set(1 + Math.sin(t * 9 + i) * 0.08, 1 + Math.sin(t * 11 + i * 2) * 0.14, 1); });
    embers.forEach((e, i) => { const k = (t * 0.8 + i / 5) % 1; e.position.set(Math.sin(i * 2.3 + t) * 0.18, 0.15 + k * 0.5, Math.cos(i * 1.7 + t) * 0.12); e.scale.setScalar(1 - k); });
  });
  const anims = {
    idle: { dur: 1.2, loop: true, keys: [K(0, { armL: [0, 0, 10], armR: [0, 0, -10] }, { sq: 0.04 }), K(0.6, { armL: [0, 0, -10], armR: [0, 0, 10] }, { sq: -0.05, r: [0, 0.04, 0] }), K(1.2, { armL: [0, 0, 10], armR: [0, 0, -10] }, { sq: 0.04 })] },
    attack: { dur: 0.8, hit: 0.4, keys: [K(0, {}), K(0.22, { armL: [-60, 0, 30] }, { sq: 0.2, r: [0, 0.05, -0.1] }), K(0.4, { armL: [-90, 0, -20], armR: [-50, 0, 0] }, { sq: -0.2, r: [0, -0.05, 0.6], e: 'snap' }), K(0.8, {})] },
    cast: { dur: 1.0, hit: 0.55, keys: [K(0, {}), K(0.3, { armL: [0, 0, 70], armR: [0, 0, -70] }, { sq: 0.25 }), K(0.55, { armL: [0, 0, 110], armR: [0, 0, -110] }, { sq: -0.3, r: [0, 0.15, 0], e: 'back', glow: 1 }), K(1, {})] },
    hurt: { dur: 0.4, keys: [K(0, {}), K(0.07, {}, { sq: -0.25, r: [0, 0, -0.2], e: 'snap' }), K(0.4, {})] },
  };
  return { rig, anims, size: 88, bodyH: 0.9, bodyW: 0.7, mul: 1.25, yaw: 40 };
}

// ── 수정 골렘 ──
function golem() {
  const rig = new Rig(); const R = rig.root, b = rig.b;
  const rock = 0x5f6a86, rockD = 0x3c4258, rockL = 0x8a96b0, cry = 0x7ef0ff;
  b.hips = bone('hips', R, 0, 0.62, 0);
  const pel = box(0.6, 0.28, 0.42, rockD); b.hips.add(pel);
  b.chest = bone('chest', b.hips, 0, 0.18, 0);
  const tor = box(1.1, 0.78, 0.7, rock); at(tor, 0, 0.4, 0); b.chest.add(tor);
  const gut = box(0.8, 0.3, 0.58, rockD); at(gut, 0, 0.0, 0.02); b.chest.add(gut);
  const plate = box(0.6, 0.4, 0.08, rockL); at(plate, 0, 0.42, 0.31); b.chest.add(plate);
  const heart = ball(0.1, cry, 1, 1, 0.6, { emissive: 1.4 }); at(heart, 0, 0.42, 0.36); b.chest.add(heart);
  crystal(b.chest, 0.36, 0.72, -0.05, 0.42, 0.1, cry, -10, -25); crystal(b.chest, 0.48, 0.66, 0.1, 0.3, 0.08, 0xa8f6ff, 10, -45);
  crystal(b.chest, -0.36, 0.72, -0.05, 0.46, 0.11, cry, -10, 25); crystal(b.chest, -0.15, 0.74, -0.2, 0.32, 0.08, 0xa8f6ff, -30, 10);
  b.head = bone('head', b.chest, 0, 0.7, 0.22);
  const hd = box(0.32, 0.24, 0.3, rockL); at(hd, 0, 0.08, 0); b.head.add(hd);
  const visor = box(0.24, 0.05, 0.02, cry, { emissive: 1.5 }); at(visor, 0, 0.08, 0.16); b.head.add(visor);
  for (const s of [-1, 1]) {
    const n = s > 0 ? 'L' : 'R';
    const arm = b['arm' + n] = bone('arm' + n, b.chest, s * 0.68, 0.6, 0); arm.rotation.z = s * 8 * D2R;
    const sh = box(0.5, 0.42, 0.5, rockL); at(sh, s * 0.06, 0.04, 0); arm.add(sh);
    const up = box(0.26, 0.48, 0.26, rock); at(up, 0, -0.3, 0); arm.add(up);
    const fore = b['fore' + n] = bone('fore' + n, arm, 0, -0.55, 0);
    const fa = box(0.34, 0.5, 0.34, rock); at(fa, 0, -0.22, 0.02); fore.add(fa);
    const fist = box(0.48, 0.38, 0.48, rockD); at(fist, 0, -0.56, 0.02); fore.add(fist);
    crystal(fore, s * 0.12, -0.05, -0.1, 0.22, 0.06, cry, -60, s * -20);
    const leg = b['leg' + n] = bone('leg' + n, b.hips, s * 0.2, -0.1, 0);
    const lg = box(0.3, 0.42, 0.32, rock); at(lg, 0, -0.22, 0); leg.add(lg);
    const ft = box(0.36, 0.14, 0.46, rockD); at(ft, 0, -0.48, 0.05); leg.add(ft);
  }
  const anims = {
    idle: { dur: 2.0, loop: true, keys: [K(0, { chest: [0, 0, 0], armL: [0, 0, 0], armR: [0, 0, 0] }), K(1.0, { chest: [4, 0, 0], head: [-4, 0, 0], armL: [0, 0, 4], armR: [0, 0, -4], foreL: [-6, 0, 0], foreR: [-6, 0, 0] }, { r: [0, -0.02, 0] }), K(2.0, {})] },
    attack: { dur: 1.1, hit: 0.55, keys: [K(0, {}),
      K(0.35, { chest: [-18, 30, 0], armL: [-160, 0, 20], foreL: [-40, 0, 0], armR: [-20, 0, -10], head: [-8, -15, 0], legR: [-20, 0, 0] }, { r: [0, 0, -0.1] }),
      K(0.55, { chest: [30, -15, 0], armL: [-60, 0, -5], foreL: [-5, 0, 0], armR: [20, 0, -10], head: [10, 10, 0], legL: [-25, 0, 0], legR: [15, 0, 0] }, { r: [0, -0.1, 0.45], e: 'snap', smear: 1 }),
      K(0.75, { chest: [28, -15, 0], armL: [-55, 0, -5], head: [10, 10, 0] }, { r: [0, -0.1, 0.45] }), K(1.1, {})] },
    cast: { dur: 1.2, hit: 0.65, keys: [K(0, {}), K(0.35, { chest: [-12, 0, 0], armL: [-40, 0, 50], armR: [-40, 0, -50], head: [-15, 0, 0] }), K(0.65, { chest: [-18, 0, 0], armL: [-150, 0, 30], armR: [-150, 0, -30], head: [-20, 0, 0] }, { r: [0, 0.05, 0], e: 'back', glow: 1 }), K(1.2, {})] },
    hurt: { dur: 0.5, keys: [K(0, {}), K(0.08, { chest: [-14, 10, 0], head: [-15, 0, 0], armL: [20, 0, 20], armR: [20, 0, -20] }, { r: [0, 0, -0.12], e: 'snap' }), K(0.5, {})] },
  };
  return { rig, anims, size: 160, bodyH: 2.0, bodyW: 1.6, yaw: 45 };
}

// ── 고목의 파수꾼 (보스) ──
function treant() {
  const rig = new Rig(); const R = rig.root, b = rig.b;
  const bark = 0x6a4a32, barkD = 0x45301f, leaf = 0x4f9a3c, leafL = 0x7ac852, moss = 0x8ab84a;
  b.hips = bone('hips', R, 0, 0.5, 0);
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + 0.3; const root = taper(0.09, 0.03, 0.55, barkD, { sides: 6 }); at(root, Math.cos(a) * 0.2, -0.1, Math.sin(a) * 0.2, Math.sin(a) * 55, 0, -Math.cos(a) * 55); b.hips.add(root); }
  b.chest = bone('chest', b.hips, 0, 0.05, 0);
  const trunk = taper(0.34, 0.42, 1.25, bark, { up: true, sides: 9 }); b.chest.add(trunk);
  for (let i = 0; i < 6; i++) { const r = box(0.06, 0.9, 0.05, barkD); const a = i / 6 * Math.PI * 2; at(r, Math.cos(a) * 0.37, 0.6, Math.sin(a) * 0.37, 0, -a * 180 / Math.PI, 0); b.chest.add(r); }
  const mossP = ball(0.2, moss, 1.6, 0.5, 1); at(mossP, 0.18, 0.95, 0.24); b.chest.add(mossP);
  b.face = bone('face', b.chest, 0, 0.78, 0.36);
  for (const s of [-1, 1]) { const hole = box(0.2, 0.13, 0.08, 0x1a0e08); at(hole, s * 0.14, 0, 0, 0, 0, s * -14); b.face.add(hole); const e = ball(0.055, 0xd8ff70, 1.3, 1, 0.6, { emissive: 2 }); at(e, s * 0.14, 0, 0.04); b.face.add(e); const brow = box(0.26, 0.07, 0.1, barkD); at(brow, s * 0.14, 0.12, 0.03, 0, 0, s * -20); b.face.add(brow); }
  b.mouth = bone('mouth', b.face, 0, -0.26, 0);
  const mouth = box(0.34, 0.14, 0.08, 0x1a0e08); b.mouth.add(mouth); for (let k = -1; k <= 1; k += 2) { const tooth = box(0.05, 0.06, 0.04, 0xd8c8a0); at(tooth, k * 0.08, 0.05, 0.03); b.mouth.add(tooth); }
  b.crown = bone('crown', b.chest, 0, 1.08, 0);
  [[0, 0.4, -0.05, 0.62, leaf], [-0.55, 0.22, 0.0, 0.46, leaf], [0.55, 0.25, -0.05, 0.48, leaf], [0.12, 0.78, -0.1, 0.42, leafL], [-0.3, 0.55, 0.25, 0.36, leafL], [0.32, 0.5, 0.28, 0.34, leafL], [0, 0.18, -0.45, 0.46, 0x3c7a30], [-0.3, 0.05, -0.3, 0.36, 0x3c7a30], [0.35, 0.05, -0.3, 0.34, 0x3c7a30]].forEach(([x, y, z, r, c]) => {
    const g = new THREE.IcosahedronGeometry(r, 1); const m = new THREE.Mesh(g, toon(c)); m.position.set(x, y, z); b.crown.add(m);
  });
  for (let i = 0; i < 4; i++) { const f = ball(0.05, 0xffe070, 1, 1, 1, { emissive: 1 }); at(f, Math.cos(i * 1.7) * 0.45, 0.3 + (i % 2) * 0.3, Math.sin(i * 1.7) * 0.35 + 0.1); b.crown.add(f); }
  rig.addSpring(b.crown, { k: 25, damp: 4, gain: 0.25, wind: 1.2 });
  for (const s of [-1, 1]) {
    const n = s > 0 ? 'L' : 'R';
    const arm = b['arm' + n] = bone('arm' + n, b.chest, s * 0.34, 0.95, 0.05); arm.rotation.z = s * 32 * D2R;
    arm.add(taper(0.15, 0.11, 0.75, bark, { sides: 6 }));
    const fore = b['fore' + n] = bone('fore' + n, arm, 0, -0.72, 0); fore.rotation.x = -25 * D2R;
    fore.add(taper(0.11, 0.07, 0.7, bark, { sides: 6 }));
    for (let k = -1; k <= 1; k++) { const tw = taper(0.05, 0.012, 0.4, barkD, { sides: 4 }); at(tw, k * 0.06, -0.66, 0, k * 22, 0, k * 28); fore.add(tw); }
    const lf = ball(0.12, leafL, 1, 0.6, 1); at(lf, s * 0.05, -0.2, 0.06); fore.add(lf);
  }
  const anims = {
    idle: { dur: 2.4, loop: true, keys: [K(0, { chest: [0, 0, 2], armL: [0, 0, 0], armR: [0, 0, 0] }), K(1.2, { chest: [3, 0, -2], crown: [0, 0, 3], armL: [10, 0, 6], armR: [10, 0, -6], foreL: [-10, 0, 0], foreR: [-10, 0, 0], mouth: [0, 0, 0] }, { r: [0, -0.02, 0] }), K(2.4, { chest: [0, 0, 2] })] },
    attack: { dur: 1.1, hit: 0.55, keys: [K(0, {}),
      K(0.35, { chest: [-14, 25, 0], armL: [-150, 0, 10], foreL: [-30, 0, 0], mouth: [20, 0, 0] }, { r: [0, 0, -0.1] }),
      K(0.55, { chest: [22, -10, 0], armL: [-40, 0, -10], foreL: [0, 0, 0], armR: [20, 0, 0], mouth: [0, 0, 0] }, { r: [0, -0.05, 0.4], e: 'snap', smear: 1 }),
      K(0.8, { chest: [20, -10, 0], armL: [-35, 0, -10] }, { r: [0, -0.05, 0.4] }), K(1.1, {})] },
    cast: { dur: 1.3, hit: 0.7, keys: [K(0, {}), K(0.4, { chest: [-10, 0, 0], armL: [-40, 0, 40], armR: [-40, 0, -40], mouth: [15, 0, 0] }), K(0.7, { chest: [-16, 0, 0], armL: [-150, 0, 20], armR: [-150, 0, -20], crown: [-10, 0, 0], mouth: [35, 0, 0] }, { r: [0, 0.06, 0], e: 'back', glow: 1 }), K(1.3, {})] },
    hurt: { dur: 0.55, keys: [K(0, {}), K(0.08, { chest: [-12, 8, 0], crown: [-14, 0, 0], armL: [20, 0, 20], armR: [20, 0, -20], mouth: [25, 0, 0] }, { r: [0, 0, -0.12], e: 'snap' }), K(0.55, {})] },
  };
  return { rig, anims, size: 200, bodyH: 2.5, bodyW: 1.8, yaw: 30, mul: 0.85 };
}

// ── 수정룡 (최종 보스) — dark: 2페이즈 ──
function dragon(variant) {
  const dark = variant === 'dragonDark';
  const P = dark
    ? { body: 0x2a2038, bodyL: 0x463a5a, belly: 0x5a3a68, mem: 0x6a1e5a, cry: 0xe45ac8, cry2: 0xff8ae8, eye: 0xff3a8a, horn: 0x1a1222 }
    : { body: 0x8aa8d8, bodyL: 0xc8daf4, belly: 0xe8eef8, mem: 0x5a7ac8, cry: 0x7ef0ff, cry2: 0xc8fbff, eye: 0xffe060, horn: 0xe8f0ff };
  const rig = new Rig(); const R = rig.root, b = rig.b;
  b.body = bone('body', R, 0, 1.0, -0.2);
  const torso = capsule(0.42, 0.9, P.body); at(torso, 0, 0, 0.45); torso.rotation.x = Math.PI / 2; b.body.add(torso);
  const belly = capsule(0.32, 0.8, P.belly); at(belly, 0, -0.14, 0.42); belly.rotation.x = Math.PI / 2; b.body.add(belly);
  b.chest = bone('chest', b.body, 0, 0.05, 0.45);
  const ch = ball(0.5, P.body, 1, 1, 1.05); b.chest.add(ch);
  const chP = ball(0.36, P.belly, 1, 1.1, 0.8); at(chP, 0, -0.1, 0.2); b.chest.add(chP);
  const core = ball(0.11, P.cry, 1, 1, 0.6, { emissive: 1.6 }); at(core, 0, 0.0, 0.48); b.chest.add(core);
  // 목 + 머리
  let p = b.chest;
  for (let i = 0; i < 3; i++) {
    const nb = b['neck' + i] = bone('neck' + i, p, 0, i === 0 ? 0.3 : 0.3, i === 0 ? 0.25 : 0.04);
    nb.rotation.x = (i === 0 ? 30 : i === 1 ? 12 : -4) * D2R;
    nb.add(capsule(0.23 - i * 0.025, 0.28, P.body).translateY(0.3));
    const sp = cone(0.05, 0.16, P.cry, 4, { emissive: 1 }); at(sp, 0, 0.18, -0.16, -60, 0, 0); nb.add(sp);
    p = nb;
  }
  b.head = bone('head', p, 0, 0.36, 0.05); b.head.rotation.x = -10 * D2R;
  const skull = ball(0.3, P.body, 1, 0.85, 1.15); b.head.add(skull);
  const snout = box(0.32, 0.2, 0.5, P.body); at(snout, 0, -0.04, 0.38); b.head.add(snout);
  const nose = box(0.28, 0.08, 0.12, P.bodyL); at(nose, 0, 0.07, 0.58); b.head.add(nose);
  b.jaw = bone('jaw', b.head, 0, -0.12, 0.08);
  const jw = box(0.28, 0.09, 0.52, P.belly); at(jw, 0, -0.03, 0.28); b.jaw.add(jw);
  for (const s of [-1, 1]) {
    for (let k = 0; k < 4; k++) { const f = cone(0.02, 0.08, 0xffffff, 4); at(f, s * 0.11, 0.02, 0.12 + k * 0.11); b.jaw.add(f); }
    const hornA = cone(0.09, 0.62, P.horn, 6, { emissive: dark ? 0 : 0.25 }); at(hornA, s * 0.17, 0.14, -0.1, -120, 0, -s * 20); b.head.add(hornA);
    const hornB = cone(0.04, 0.22, P.horn, 5); at(hornB, s * 0.2, 0.0, 0.02, -100, 0, -s * 50); b.head.add(hornB);
    const eye = ball(0.055, P.eye, 1.3, 0.7, 0.6, { emissive: 1.8 }); at(eye, s * 0.17, 0.07, 0.24, 0, s * 30, 0); b.head.add(eye);
    const brow = box(0.2, 0.06, 0.12, P.bodyL); at(brow, s * 0.16, 0.13, 0.22, 0, s * 20, s * -18); b.head.add(brow);
  }
  crystal(b.head, 0, 0.18, 0.05, 0.22, 0.05, P.cry, -40, 0);
  // 날개
  for (const s of [-1, 1]) {
    const n = s > 0 ? 'L' : 'R';
    const w = b['wing' + n] = bone('wing' + n, b.body, s * 0.3, 0.32, 0.55);
    w.rotation.set(-15 * D2R, s * -10 * D2R, s * 30 * D2R);
    const arm = capsule(0.07, 1.3, P.bodyL); arm.rotation.z = s * 100 * D2R; w.add(arm);
    const tip = b['wingTip' + n] = bone('wingTip' + n, w, s * 1.3, 0.2, 0);
    tip.rotation.z = s * -25 * D2R;
    const arm2 = capsule(0.05, 1.15, P.bodyL); arm2.rotation.z = s * 75 * D2R; tip.add(arm2);
    const m1 = membrane([[0, 0], [0.95, 0.15], [0.9, -0.55], [0.55, -0.4], [0.3, -0.75], [0, -0.35]], P.mem); m1.scale.set(s * 1.38, 1.35, 1); w.add(m1);
    const m2 = membrane([[0, 0], [0.82, 0.45], [0.95, 0.2], [0.75, -0.25], [0.45, -0.3], [0.2, -0.7], [-0.05, -0.55]], P.mem); m2.scale.set(s * 1.38, 1.35, 1); tip.add(m2);
    crystal(tip, s * 1.1, 0.58, 0, 0.36, 0.07, P.cry, 0, -s * 30);
  }
  // 등 수정
  for (let i = 0; i < 4; i++) crystal(b.body, (i % 2 ? 0.08 : -0.08), 0.36, 0.55 - i * 0.28, 0.42 - i * 0.06, 0.09, i % 2 ? P.cry2 : P.cry, -20, i % 2 ? -15 : 15);
  // 다리
  for (const [n, s, z, front] of [['FL', 1, 0.6, 1], ['FR', -1, 0.6, 1], ['BL', 1, -0.15, 0], ['BR', -1, -0.15, 0]]) {
    const th = b['thigh' + n] = bone('thigh' + n, b.body, s * 0.3, -0.15, z);
    th.add(capsule(front ? 0.16 : 0.26, 0.36, P.body));
    const sh = b['shin' + n] = bone('shin' + n, th, 0, -0.42, front ? 0 : -0.05); sh.rotation.x = (front ? -10 : 25) * D2R;
    sh.add(capsule(front ? 0.11 : 0.14, 0.34, P.bodyL));
    const foot = box(0.26, 0.1, 0.36, P.body); at(foot, 0, -0.42, 0.1); sh.add(foot);
    for (let k = -1; k <= 1; k++) { const cl = cone(0.03, 0.12, 0xffffff, 4); at(cl, k * 0.08, -0.44, 0.3, 90, 0, 0); sh.add(cl); }
  }
  // 꼬리
  b.tailBase = bone('tailBase', b.body, 0, 0.02, -0.15);
  const tb = tailChain(rig, b.tailBase, 5, 0.42, 0.22, 0.08, P.body, { lift: 12 });
  tb.forEach((t, i) => { if (i % 2 === 0) crystal(t, 0, 0.12, -0.2, 0.22 - i * 0.03, 0.05, P.cry, -40, 0); });
  const tipC = crystal(tb[4], 0, 0, -0.35, 0.4, 0.1, P.cry2, -90, 0);
  void tipC;
  const anims = {
    idle: { dur: 2.2, loop: true, keys: [
      K(0, { chest: [0, 0, 0], neck0: [0, 0, 0], head: [0, 0, 0], wingL: [0, 0, 0], wingR: [0, 0, 0] }),
      K(1.1, { chest: [-4, 0, 0], neck0: [-4, 0, 0], neck1: [-3, 0, 0], head: [6, 8, 0], jaw: [8, 0, 0], wingL: [0, 0, 10], wingR: [0, 0, -10], wingTipL: [0, 0, -8], wingTipR: [0, 0, 8] }, { r: [0, 0.05, 0] }),
      K(2.2, {})] },
    attack: { dur: 1.15, hit: 0.55, keys: [K(0, {}),
      K(0.32, { body: [-12, 0, 0], chest: [-10, 0, 0], neck0: [-25, 0, 0], neck1: [-15, 0, 0], head: [-15, 0, 0], jaw: [35, 0, 0], thighFL: [-40, 0, 0], wingL: [0, 0, 25], wingR: [0, 0, -25] }, { r: [0, 0.08, -0.2] }),
      K(0.55, { body: [10, 0, 0], chest: [12, 0, 0], neck0: [35, 0, 0], neck1: [20, 0, 0], head: [20, 0, 0], jaw: [5, 0, 0], thighFL: [-70, 0, 0], thighFR: [-30, 0, 0], wingL: [0, 0, -15], wingR: [0, 0, 15] }, { r: [0, -0.05, 0.7], e: 'snap', smear: 1 }),
      K(0.8, { body: [8, 0, 0], neck0: [30, 0, 0], head: [15, 0, 0], jaw: [15, 0, 0] }, { r: [0, -0.05, 0.6] }), K(1.15, {})] },
    cast: { dur: 1.4, hit: 0.75, keys: [K(0, {}),
      K(0.45, { body: [-14, 0, 0], chest: [-15, 0, 0], neck0: [-35, 0, 0], neck1: [-20, 0, 0], head: [-25, 0, 0], jaw: [10, 0, 0], wingL: [0, -20, 45], wingR: [0, 20, -45], wingTipL: [0, 0, 20], wingTipR: [0, 0, -20], thighFL: [-30, 0, 0], thighFR: [-30, 0, 0] }, { r: [0, 0.25, -0.1] }),
      K(0.75, { body: [6, 0, 0], chest: [5, 0, 0], neck0: [15, 0, 0], neck1: [10, 0, 0], head: [25, 0, 0], jaw: [45, 0, 0], wingL: [0, 10, -5], wingR: [0, -10, 5] }, { r: [0, 0.1, 0.25], e: 'back', glow: 1 }),
      K(1.4, {})] },
    hurt: { dur: 0.55, keys: [K(0, {}), K(0.08, { body: [-10, 0, 0], neck0: [-25, 0, 0], head: [-30, 15, 0], jaw: [30, 0, 0], wingL: [0, 0, 30], wingR: [0, 0, -30] }, { r: [0, 0.05, -0.25], e: 'snap' }), K(0.55, {})] },
  };
  return { rig, anims, size: 288, bodyH: 2.8, bodyW: 2.6, centerY: 1.45, yaw: 48, mul: 0.7 };
}

const BUILDERS = { slime, slimeIce: slime, rabbit, mushroom, mushroomP: mushroom, wolf, bat, wisp, golem, treant, dragon, dragonDark: dragon };
export const HAS_MONSTER_RIG = d => !!BUILDERS[d];

export function buildMonster(design) { return BUILDERS[design](design); }

// 몬스터 빌보드 (적은 오른쪽=파티 쪽을 바라봄)
function fitLunge(m) {
  // 스프라이트 틀 밖으로 나가지 않도록 앞으로 내딛는 거리 제한
  const cap = Math.max(0.06, (m.size / PX / 2 - m.bodyW * 0.45) * 0.9);
  for (const a of Object.values(m.anims)) for (const k of a.keys) if (k.r) k.r = [k.r[0], Math.min(k.r[1], cap), Math.max(-cap, Math.min(k.r[2], cap))];
  return m;
}
export function makeMonster(design, { scale = 1, baseYaw } = {}) {
  const m = fitLunge(buildMonster(design));
  scale *= m.mul || 1;
  if (baseYaw === undefined) baseYaw = m.yaw ?? 62;
  else if (baseYaw === 0) baseYaw = 0;
  const bb = new RigBillboard(m.rig, { size: m.size, viewW: m.size / PX, anims: m.anims, baseYaw, scale, bodyW: m.bodyW, bodyH: m.bodyH, centerY: m.centerY });
  bb.glow = 0.1;
  bb.design = design;
  bb.morph = d => { if (!BUILDERS[d]) return; const n = fitLunge(buildMonster(d)); bb.swapRig(n.rig, n.anims); bb.design = d; };
  return bb;
}
