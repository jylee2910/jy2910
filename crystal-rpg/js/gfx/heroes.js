// ─────────────────────────────────────────────────────────────
//  캐릭터 디자인 (3D 리그 파츠 조립). 색은 팔레트 이름 또는 hex.
//  makeCharacter(id, weaponLook) → RigBillboard
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { buildHumanoid, at, ball, cone, box, taper, capsule, lathe, toon, HUMAN_ANIMS, RigBillboard } from './rig.js';
import { WEAPON_STYLE } from '../art/sprites.data.js';

const D2R = Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0);

// 방향 d로 뻗는 원뿔 (머리카락 가닥/뿔)
function spike(parent, pos, dir, r, h, c, sides = 5) {
  const m = cone(r, h, c, sides);
  m.position.set(...pos);
  m.quaternion.setFromUnitVectors(UP, new THREE.Vector3(...dir).normalize());
  parent.add(m);
  return m;
}
// 스프링으로 흔들리는 사슬 (망토/스카프/포니테일)
function chain(rig, parent, pos, segs, makeSeg, { rest = 10, gain = 0.5, wind = 1, k = 50, damp = 6, side = 0, ry = 0, rz = 0 } = {}) {
  let p = parent;
  const bones = [];
  for (let i = 0; i < segs.length; i++) {
    const b = new THREE.Object3D();
    if (i === 0) { b.position.set(...pos); b.rotation.set(rest * D2R, ry * D2R, rz * D2R); }
    else { b.position.set(0, -segs[i - 1], 0); b.rotation.x = (rest * 0.5) * D2R; }
    p.add(b);
    b.add(makeSeg(i, segs[i]));
    rig.addSpring(b, { rest: b.rotation.x, gain: gain * (1 + i * 0.4), wind: wind * (1 + i * 0.5), k: k - i * 8, damp, side: side + i * 0.7 });
    bones.push(b); p = b;
  }
  return bones;
}
const panel = (w, h, c, d = 0.012) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, -h / 2, 0); return new THREE.Mesh(g, toon(c, { side: THREE.DoubleSide })); };

// ── 머리 스타일 ──
const HC = 0.135; // 머리 중심 높이(머리 뼈 기준)
const HAIR = {
  spiky(rig, c, sh) {
    const H = rig.b.head;
    H.add(at(ball(0.152, c, 1, 0.92, 1.02), 0, HC + 0.035, -0.03));
    const tips = [[0, 0.12, -0.02, 0, 1, -0.3], [0.07, 0.11, -0.04, 0.5, 1, -0.5], [-0.07, 0.11, -0.04, -0.5, 1, -0.5], [0.1, 0.06, -0.08, 0.8, 0.5, -0.8], [-0.1, 0.06, -0.08, -0.8, 0.5, -0.8],
      [0, 0.08, -0.12, 0, 0.6, -1], [0.05, 0.02, -0.14, 0.3, 0.1, -1], [-0.05, 0.02, -0.14, -0.3, 0.1, -1], [0.03, 0.14, 0.04, 0.2, 1, 0.3]];
    for (const [x, y, z, dx, dy, dz] of tips) spike(H, [x, HC + y, z], [dx, dy, dz], 0.05, 0.17, c);
    // 앞머리 + 옆머리
    for (const [x, z, dx] of [[0.05, 0.11, 0.25], [-0.02, 0.12, -0.1], [-0.08, 0.09, -0.4]]) spike(H, [x, HC + 0.1, z], [dx, -1, 0.55], 0.04, 0.13, c);
    spike(H, [0.12, HC + 0.03, 0.04], [0.15, -1, 0.1], 0.03, 0.14, sh);
    spike(H, [-0.12, HC + 0.03, 0.04], [-0.15, -1, 0.1], 0.03, 0.14, sh);
  },
  long(rig, c, sh) {
    const H = rig.b.head;
    H.add(at(ball(0.155, c, 1, 0.95, 1.04), 0, HC + 0.03, -0.025));
    for (const [x, dx] of [[0.06, 0.2], [-0.01, 0], [-0.07, -0.25]]) spike(H, [x, HC + 0.11, 0.1], [dx, -1, 0.5], 0.045, 0.12, c);
    spike(H, [0.125, HC - 0.02, 0.05], [0.05, -1, 0], 0.035, 0.24, c);
    spike(H, [-0.125, HC - 0.02, 0.05], [-0.05, -1, 0], 0.035, 0.24, c);
    chain(rig, H, [0, HC + 0.02, -0.11], [0.2, 0.2, 0.16], (i, l) => { const m = panel(0.24 - i * 0.04, l + 0.03, i % 2 ? sh : c, 0.06); return m; }, { rest: 12, gain: 0.35, wind: 0.6 });
    // 서클릿
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.152, 0.012, 4, 16), toon('gold')); ring.rotation.x = Math.PI / 2 - 0.25; ring.position.set(0, HC + 0.07, 0.0); H.add(ring);
    H.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.025), toon('crystal', { emissive: 0.6 })), 0, HC + 0.1, 0.15));
  },
  swept(rig, c, sh) {
    const H = rig.b.head;
    H.add(at(ball(0.154, c, 1, 0.94, 1.04), 0, HC + 0.03, -0.03));
    // 한쪽 눈을 가리는 긴 앞머리
    const bang = panel(0.12, 0.2, c, 0.04); bang.position.set(0.06, HC + 0.12, 0.13); bang.rotation.set(-0.35, 0, 0.35); H.add(bang);
    for (const [x, y, dx] of [[-0.06, 0.12, -0.5], [-0.1, 0.08, -0.9], [0.0, 0.14, 0.2]]) spike(H, [x, HC + y, 0.06], [dx, 0.3, -0.6], 0.045, 0.16, c);
    for (const z of [-0.06, -0.12]) spike(H, [0, HC + 0.08, z], [0, 0.2, -1], 0.06, 0.18, sh);
    chain(rig, H, [0, HC - 0.06, -0.12], [0.16, 0.16, 0.14], (i, l) => capsule(0.04 - i * 0.008, l, i % 2 ? sh : c), { rest: 20, gain: 0.5, wind: 0.8 });
  },
  helm(rig, c, sh, def) {
    const H = rig.b.head;
    const metal = def.colors.metal || 'steel';
    H.add(at(ball(0.165, metal, 1, 0.95, 1.05), 0, HC + 0.035, -0.015));
    const brim = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.018, 5, 16), toon('gold')); brim.rotation.x = Math.PI / 2; brim.position.set(0, HC + 0.04, 0); H.add(brim);
    H.add(at(box(0.026, 0.11, 0.03, metal), 0, HC + 0.02, 0.16));
    for (const s of [1, -1]) H.add(at(box(0.04, 0.12, 0.09, metal), s * 0.14, HC - 0.03, 0.04));
    // 뿔
    spike(H, [0.12, HC + 0.1, -0.02], [0.8, 0.6, -0.3], 0.03, 0.16, 'creamL');
    spike(H, [-0.12, HC + 0.1, -0.02], [-0.8, 0.6, -0.3], 0.03, 0.16, 'creamL');
    // 장식 깃털
    chain(rig, H, [0, HC + 0.17, -0.04], [0.1, 0.12, 0.12], (i, l) => capsule(0.035 - i * 0.006, l, i % 2 ? 'redS' : 'red'), { rest: 75, gain: 0.4, wind: 1 });
    // 수염
    const beard = ball(0.1, c, 1.1, 0.85, 0.8); beard.position.set(0, HC - 0.1, 0.07); H.add(beard);
    H.add(at(ball(0.05, c, 1.4, 0.5, 0.6), 0, HC - 0.035, 0.13));
  },
  dragon(rig, c, sh, def) {
    const H = rig.b.head;
    const metal = def.colors.metal || 'teal';
    H.add(at(ball(0.162, metal, 1, 0.93, 1.06), 0, HC + 0.04, -0.02));
    // 이마 위 용 주둥이 장식
    const snout = cone(0.06, 0.16, metal, 4); snout.position.set(0, HC + 0.13, 0.09); snout.rotation.set(1.2, Math.PI / 4, 0); H.add(snout);
    H.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.022), toon('gold', { emissive: 0.4 })), 0, HC + 0.12, 0.15));
    // 뒤로 뻗은 뿔
    spike(H, [0.1, HC + 0.1, -0.06], [0.35, 0.55, -1], 0.035, 0.28, 'goldS');
    spike(H, [-0.1, HC + 0.1, -0.06], [-0.35, 0.55, -1], 0.035, 0.28, 'goldS');
    spike(H, [0.14, HC + 0.03, -0.02], [1, 0.2, -0.6], 0.02, 0.12, metal);
    spike(H, [-0.14, HC + 0.03, -0.02], [-1, 0.2, -0.6], 0.02, 0.12, metal);
    for (const s of [1, -1]) H.add(at(box(0.035, 0.12, 0.09, metal), s * 0.14, HC - 0.02, 0.05));
    // 앞머리 + 높은 포니테일
    for (const [x, dx] of [[0.04, 0.3], [-0.04, -0.3]]) spike(H, [x, HC + 0.07, 0.13], [dx, -1, 0.4], 0.035, 0.1, c);
    chain(rig, H, [0, HC + 0.12, -0.14], [0.17, 0.17, 0.15, 0.12], (i, l) => capsule(0.05 - i * 0.008, l, i % 2 ? sh : c), { rest: 60, gain: 0.6, wind: 1 });
  },
  bun(rig, c, sh) {
    const H = rig.b.head;
    H.add(at(ball(0.153, c, 1, 0.93, 1.03), 0, HC + 0.03, -0.02));
    H.add(at(ball(0.07, c), 0, HC + 0.12, -0.12));
    for (const [x, dx] of [[0.05, 0.3], [-0.05, -0.3]]) spike(H, [x, HC + 0.1, 0.11], [dx, -1, 0.5], 0.04, 0.1, c);
  },
  bald(rig, c, sh) {
    const H = rig.b.head;
    for (const s of [1, -1]) H.add(at(ball(0.05, c, 0.8, 1, 1.2), s * 0.13, HC, -0.04));
    const beard = ball(0.11, c, 1.1, 1.2, 0.8); beard.position.set(0, HC - 0.13, 0.07); H.add(beard);
    chain(rig, H, [0, HC - 0.2, 0.08], [0.1, 0.08], (i, l) => capsule(0.05 - i * 0.015, l, c), { rest: -10, gain: 0.1, wind: 0.3 });
    H.add(at(ball(0.05, c, 1.5, 0.45, 0.6), 0, HC - 0.04, 0.13));
  },
  bandana(rig, c, sh, def) {
    const H = rig.b.head;
    H.add(at(ball(0.152, c, 1, 0.92, 1.02), 0, HC + 0.02, -0.03));
    const band = ball(0.157, def.colors.band || 'green', 1, 0.45, 1.02); band.position.set(0, HC + 0.08, -0.01); H.add(band);
    chain(rig, H, [0, HC + 0.06, -0.15], [0.09, 0.08], (i, l) => panel(0.05, l, def.colors.band || 'green', 0.02), { rest: 40, gain: 0.5, wind: 1 });
  },
};

// ── 외형 파츠 ──
function scarf(rig, c, sh) {
  const n = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.04, 6, 12), toon(c)); n.rotation.x = Math.PI / 2; n.position.set(0, 0.02, 0); rig.b.neck.add(n);
  chain(rig, rig.b.neck, [0.06, 0.0, -0.08], [0.18, 0.18, 0.18, 0.15], (i, l) => panel(0.075, l + 0.02, i % 2 ? sh : c, 0.02), { rest: 35, gain: 0.9, wind: 1.6, ry: 25 });
  chain(rig, rig.b.neck, [-0.03, -0.01, -0.08], [0.15, 0.15, 0.12], (i, l) => panel(0.065, l + 0.02, i % 2 ? c : sh, 0.02), { rest: 25, gain: 0.8, wind: 1.4, ry: -10, side: 2 });
}
function cape(rig, c, sh, len = [0.3, 0.3, 0.26], w = 0.36) {
  chain(rig, rig.b.chest, [0, 0.27, -0.1], len, (i, l) => panel(w + i * 0.05, l + 0.02, i % 2 ? sh : c, 0.016), { rest: 6, gain: 0.5, wind: 0.7 });
}
function skirt(rig, c, pts, { gap = 0, parent = 'hips', y = 0.06 } = {}) {
  const m = lathe(pts, c, gap ? { phiStart: gap / 2, phiLength: Math.PI * 2 - gap } : {});
  m.position.y = y; rig.b[parent].add(m);
  return m;
}
function pauldron(rig, side, c, size = 1, spiky = false) {
  const p = ball(0.085 * size, c, 1.15, 0.75, 1.05); p.position.set(side * 0.02, 0.03, 0); rig.b['arm' + (side > 0 ? 'L' : 'R')].add(p);
  if (spiky) spike(rig.b['arm' + (side > 0 ? 'L' : 'R')], [side * 0.05, 0.05, 0], [side, 0.6, -0.2], 0.03, 0.12, c);
}

// ── 무기 (3D) ──
export function makeWeapon(type, tint = {}) {
  const g = new THREE.Group();
  const pc = n => tint[n] || null;
  const steel = pc('B') || 'steel', edge = pc('W') || 'steelL', gold = pc('T') || 'gold', grip = 'leatherS', gem = pc('G') || 'crystal';
  if (type === 'sword' || type === 'greatsword') {
    const L = type === 'sword' ? 0.66 : 0.95, Wd = type === 'sword' ? 0.05 : 0.09;
    g.add(at(capsule(0.017, 0.1, grip), 0, 0.06, 0));
    g.add(at(ball(0.025, gold), 0, 0.075, 0));
    g.add(at(box(type === 'sword' ? 0.15 : 0.22, 0.03, 0.04, gold), 0, -0.05, 0));
    g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.02), toon(gem, { emissive: 0.5 })), 0, -0.05, 0.02));
    const blade = new THREE.Mesh(new THREE.BoxGeometry(Wd, L, 0.014), toon(steel)); blade.position.y = -0.065 - L / 2; g.add(blade);
    const ed = new THREE.Mesh(new THREE.BoxGeometry(Wd * 0.35, L, 0.018), toon(edge)); ed.position.set(Wd * 0.3, -0.065 - L / 2, 0); g.add(ed);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(Wd * 0.72, Wd * 1.6, 4), toon(edge)); tip.rotation.z = Math.PI; tip.rotation.y = Math.PI / 4; tip.scale.z = 0.25; tip.position.y = -0.065 - L - Wd * 0.8; g.add(tip);
  } else if (type === 'spear') {
    const shaft = taper(0.016, 0.016, 1.55, 'wood'); shaft.position.y = 0.5; g.add(shaft);
    g.add(at(box(0.06, 0.03, 0.06, gold), 0, -1.06, 0));
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.3, 4), toon(edge)); head.rotation.z = Math.PI; head.position.y = -1.22; head.scale.z = 0.35; g.add(head);
    for (const s of [1, -1]) { const w = cone(0.02, 0.1, gold, 3); w.position.set(s * 0.04, -1.07, 0); w.rotation.z = s * 2.2; g.add(w); }
    // 리본
    g.add(at(box(0.03, 0.1, 0.01, pc('G') || 'red'), 0.03, -1.0, 0, 0, 0, 20));
  } else if (type === 'staff') {
    const shaft = taper(0.018, 0.022, 1.25, 'woodL'); shaft.position.y = 0.95; g.add(shaft);
    const cres = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 5, 14, Math.PI * 1.4), toon(gold)); cres.position.y = 1.03; cres.rotation.z = -0.9; g.add(cres);
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.055), toon(gem, { emissive: 0.9 })); orb.position.y = 1.03; orb.name = 'orb'; g.add(orb);
    g.add(at(box(0.05, 0.03, 0.05, gold), 0, 0.92, 0));
    g.add(at(ball(0.024, gold), 0, -0.31, 0));
  } else if (type === 'rod') {
    g.add(at(capsule(0.018, 0.3, 'darkMetal'), 0, 0.08, 0));
    g.add(at(box(0.07, 0.025, 0.025, gold), 0, -0.23, 0));
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), toon(gem, { emissive: 1 })); orb.position.y = -0.3; orb.name = 'orb'; g.add(orb);
    for (const s of [1, -1]) { const w = cone(0.015, 0.09, gold, 3); w.position.set(s * 0.04, -0.27, 0); w.rotation.z = s * 2.6; g.add(w); }
  }
  return g;
}

function smearFor(rig, style, color = 0xeaf6ff) {
  let m;
  if (style === 'thrust') {
    const g = new THREE.ConeGeometry(0.09, 1.5, 6); g.rotateX(Math.PI / 2); g.translate(0, 0, 0.9);
    m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false }));
    m.position.set(0.12, 0.2, 0); rig.b.chest.add(m);
  } else {
    // 초승달 모양 잔상 (바깥은 밝고 안쪽은 투명)
    const g = new THREE.RingGeometry(0.5, 0.92, 22, 3, -Math.PI * 0.55, Math.PI * 0.95);
    const c = new THREE.Color(color), cols = [];
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) { const r = Math.hypot(pos.getX(i), pos.getY(i)); const k = (r - 0.5) / 0.42; cols.push(c.r * (0.6 + k * 0.6), c.g * (0.6 + k * 0.6), c.b * (0.7 + k * 0.5)); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.y = -Math.PI / 2; m.position.set(0.22, 0.2, 0.1); rig.b.chest.add(m);
  }
  m.visible = false;
  rig.smear = m;
}

// ─────────────────────────────────────────────────────────────
//  캐릭터 정의
// ─────────────────────────────────────────────────────────────
const HERO_DEFS = {
  leon: { face: 'hero', hair: 'spiky', colors: { hair: 'hairBrown', hairS: 'hairBrownS', eye: '#3a7ad8', chest: '#2c3e78', sleeve: '#2c3e78', forearm: '#24305e', glove: 'leatherS', pants: '#2a2838', boots: 'leather', bootTop: 'leatherS', belt: 'leatherS' },
    parts: [(rig) => {
      const B = rig.b;
      B.chest.add(at(box(0.08, 0.26, 0.02, 'creamL'), 0, 0.15, 0.105));
      B.chest.add(at(box(0.03, 0.2, 0.025, 'gold'), 0.05, 0.14, 0.108));
      skirt(rig, '#2c3e78', [[0.13, 0], [0.16, -0.12], [0.2, -0.32]], { gap: 0.9, parent: 'spine', y: -0.08 });
      pauldron(rig, 1, 'steel', 1.1);
      B.armL.add(at(ball(0.03, 'gold'), 0.08, 0.04, 0));
      scarf(rig, 'red', 'redS');
    }] },
  sera: { face: 'heroine', hair: 'long', colors: { hair: 'hairGold', hairS: 'hairGoldS', eye: '#2aa0a0', chest: '#e4dac4', sleeve: '#e4dac4', forearm: '#e4dac4', glove: 'skin', pants: '#e4dac4', boots: '#c8b8a0', belt: 'blue' },
    parts: [(rig) => {
      const B = rig.b;
      skirt(rig, '#ddd2ba', [[0.13, 0.06], [0.16, -0.2], [0.24, -0.55], [0.3, -0.82]], { y: 0.06 });
      skirt(rig, 'gold', [[0.301, -0.79], [0.305, -0.83]], { y: 0.06 });
      skirt(rig, 'blue', [[0.12, 0.05], [0.13, -0.1], [0.11, -0.45], [0.1, -0.78]], { gap: 5.2, y: 0.06 });
      const collar = taper(0.08, 0.1, 0.09, 'creamL', { open: true, up: true }); collar.position.y = 0.27; B.chest.add(collar);
      const cap = lathe([[0.1, 0], [0.2, -0.07], [0.22, -0.12]], 'creamL'); cap.position.y = 0.32; B.chest.add(cap);
      const capT = lathe([[0.221, -0.115], [0.225, -0.13]], 'gold'); capT.position.y = 0.32; B.chest.add(capT);
      for (const s of ['L', 'R']) { const cuff = lathe([[0.045, 0], [0.075, -0.1], [0.085, -0.14]], 'creamL'); cuff.position.y = -0.1; B['fore' + s].add(cuff); }
      B.chest.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.03), toon('crystal', { emissive: 0.8 })), 0, 0.18, 0.12));
    }] },
  bran: { face: 'stern', hair: 'helm', scale: 1.05, bulk: 1.22, colors: { hair: 'hairBrown', hairS: 'hairBrownS', eye: '#4a3a2a', metal: 'steel', chest: 'steel', sleeve: 'steelS', forearm: 'steel', glove: 'steelS', pants: 'darkMetal', boots: 'steel', bootTop: 'steelS', belt: 'leather' },
    parts: [(rig) => {
      const B = rig.b;
      B.chest.add(at(box(0.2, 0.2, 0.02, 'gold'), 0, 0.17, 0.112));
      B.chest.add(at(box(0.17, 0.17, 0.025, 'crimson'), 0, 0.17, 0.115));
      pauldron(rig, 1, 'steel', 1.45); pauldron(rig, -1, 'steel', 1.45);
      for (const s of ['L', 'R']) rig.b['arm' + s].add(at(new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 4, 12), toon('gold')), 0, 0.0, 0, 90, 0, 0));
      chain(rig, B.spine, [0, 0.0, 0.13], [0.22, 0.2], (i, l) => panel(0.2, l + 0.02, i ? 'crimsonS' : 'crimson', 0.015), { rest: -6, gain: 0.25, wind: 0.4 });
      cape(rig, 'crimson', 'crimsonS', [0.32, 0.32, 0.3], 0.44);
      // 방패 (오른손)
      const sh = new THREE.Group();
      const body = box(0.4, 0.56, 0.04, 'blue'); sh.add(body);
      sh.add(at(box(0.42, 0.04, 0.05, 'gold'), 0, 0.26, 0)); sh.add(at(box(0.04, 0.5, 0.05, 'gold'), 0, 0, 0.005)); sh.add(at(box(0.36, 0.04, 0.05, 'gold'), 0, 0.06, 0.005));
      sh.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.04), toon('crystal', { emissive: 0.6 })), 0, 0.06, 0.035));
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.16, 4), toon('blue')); tip.rotation.z = Math.PI; tip.rotation.y = Math.PI / 4; tip.scale.z = 0.12; tip.position.y = -0.36; sh.add(tip);
      sh.position.set(-0.04, -0.06, 0.08); sh.rotation.set(0, 0.25, 0);
      B.handR.add(sh);
    }] },
  kyle: { face: 'cool', hair: 'swept', colors: { hair: 'hairSilver', hairS: 'hairSilverS', eye: '#d03040', chest: '#1e1a28', sleeve: '#1e1a28', forearm: '#1e1a28', glove: '#2a2236', pants: '#24202e', boots: '#18141e', bootTop: 'crimson', belt: 'crimson' },
    parts: [(rig) => {
      const B = rig.b;
      skirt(rig, 'crimson', [[0.128, 0.0], [0.17, -0.25], [0.24, -0.62]], { gap: 1.2, parent: 'spine', y: -0.1 });
      skirt(rig, '#1e1a28', [[0.134, 0.0], [0.18, -0.25], [0.25, -0.64]], { gap: 1.0, parent: 'spine', y: -0.1 });
      const collar = taper(0.11, 0.075, 0.14, '#1e1a28', { open: true, up: true }); collar.position.y = 0.26; B.chest.add(collar);
      const lining = taper(0.105, 0.07, 0.13, 'crimson', { open: true, up: true }); lining.position.y = 0.265; lining.scale.setScalar(0.96); B.chest.add(lining);
      for (const y of [0.22, 0.16, 0.1]) B.chest.add(at(ball(0.012, 'gold'), 0.03, y, 0.11));
      B.chest.add(at(box(0.012, 0.28, 0.02, 'crimson'), 0, 0.14, 0.11));
      const rune = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.01, 4, 12), toon('crystal', { emissive: 1.2 })); rune.rotation.x = Math.PI / 2; rune.position.y = -0.14; B.foreL.add(rune);
      pauldron(rig, 1, '#2a2236', 0.9);
    }] },
  rhea: { face: 'fierce', hair: 'dragon', colors: { hair: 'hairRed', hairS: 'hairRedS', eye: '#2aa0a0', metal: 'teal', chest: 'teal', sleeve: '#1c3a44', forearm: 'teal', glove: 'tealS', pants: '#1c3a44', boots: 'teal', bootTop: 'gold', belt: 'gold' },
    parts: [(rig) => {
      const B = rig.b;
      for (const y of [0.24, 0.17, 0.1]) B.chest.add(at(box(0.18, 0.02, 0.02, 'tealL'), 0, y, 0.1));
      pauldron(rig, 1, 'teal', 1.15, true); pauldron(rig, -1, 'teal', 1.15, true);
      skirt(rig, 'teal', [[0.14, 0.02], [0.17, -0.1], [0.2, -0.24]], { gap: 0.7, y: 0.04 });
      skirt(rig, 'gold', [[0.2, -0.23], [0.205, -0.26]], { gap: 0.7, y: 0.04 });
      cape(rig, 'red', 'redS', [0.26, 0.26, 0.22], 0.32);
    }] },
  // NPC
  elder: { face: 'old', hair: 'bald', colors: { hair: 'hairSilverL', hairS: 'hairSilver', eye: '#3a3a3a', chest: 'green', sleeve: 'green', forearm: 'green', glove: 'skin', pants: 'green', boots: 'leatherS', belt: 'gold' },
    parts: [(rig) => { skirt(rig, 'green', [[0.13, 0.06], [0.17, -0.3], [0.24, -0.82]], { y: 0.06 }); skirt(rig, 'gold', [[0.241, -0.79], [0.245, -0.83]], { y: 0.06 }); }] },
  merchant: { face: 'kind', hair: 'bandana', colors: { hair: 'hairGold', hairS: 'hairGoldS', band: 'green', eye: '#5a3a2a', chest: 'creamL', sleeve: 'creamL', forearm: 'creamL', glove: 'skin', pants: 'leatherS', boots: 'leather', belt: 'leather' },
    parts: [(rig) => { rig.b.chest.add(at(box(0.27, 0.34, 0.03, 'green'), 0, 0.06, 0.1)); skirt(rig, 'green', [[0.13, 0], [0.15, -0.3]], { gap: 3.6, parent: 'spine', y: -0.05 }); }] },
  innkeeper: { face: 'heroine', hair: 'bun', colors: { hair: 'hairRed', hairS: 'hairRedS', eye: '#3a8a4a', chest: 'red', sleeve: 'creamL', forearm: 'creamL', glove: 'skin', pants: 'red', boots: 'leatherS', belt: 'creamL' },
    parts: [(rig) => { skirt(rig, 'red', [[0.13, 0.06], [0.17, -0.3], [0.26, -0.8]], { y: 0.06 }); skirt(rig, 'creamL', [[0.12, 0.04], [0.14, -0.3], [0.16, -0.62]], { gap: 3.8, y: 0.06 }); }] },
  clerk: { face: 'kind', hair: 'bun', colors: { hair: 'hairNavy', hairS: 'hairNavyS', eye: '#6a4ab0', chest: 'purple', sleeve: 'purple', forearm: 'purple', glove: 'skin', pants: 'pants', boots: '#18141e', belt: 'gold' },
    parts: [(rig) => { skirt(rig, 'purple', [[0.13, 0], [0.17, -0.25], [0.22, -0.5]], { gap: 1, parent: 'spine', y: -0.08 }); }] },
  herbalist: { face: 'heroine', hair: 'long', colors: { hair: 'hairBrown', hairS: 'hairBrownS', eye: '#3a8a4a', chest: 'mossL', sleeve: 'mossL', forearm: 'mossL', glove: 'skin', pants: 'moss', boots: 'leatherS', belt: 'flowerPink' },
    parts: [(rig) => { skirt(rig, 'moss', [[0.13, 0.06], [0.17, -0.3], [0.25, -0.82]], { y: 0.06 }); }] },
  kid: { face: 'hero', hair: 'spiky', scale: 0.74, colors: { hair: 'hairGold', hairS: 'hairGoldS', eye: '#3a7ad8', chest: 'red', sleeve: 'red', forearm: 'red', glove: 'skin', pants: 'pants', boots: 'leather', belt: 'leatherS' }, parts: [] },
};
export const HAS_RIG = id => !!HERO_DEFS[id];

// 무기 종류별 대기 자세 보정 (지팡이는 세워 든다)
function animsFor(weaponType) {
  if (weaponType !== 'staff') return HUMAN_ANIMS;
  const A = JSON.parse(JSON.stringify(HUMAN_ANIMS));
  for (const n of ['idle', 'walk']) for (const k of A[n].keys) { if (k.p.armL) { k.p.armL = [-12, 0, 14]; k.p.foreL = [-50, 0, 0]; k.p.weapon = [50, 0, 0]; } }
  return A;
}

export function makeCharacter(id, weapon) {
  const def = HERO_DEFS[id];
  const rig = buildHumanoid(def);
  HAIR[def.hair]?.(rig, def.colors.hair, def.colors.hairS, def);
  if (weapon) {
    const w = makeWeapon(weapon.type, weapon.tint || {});
    rig.b.weapon.add(w);
    rig.attackAnim = WEAPON_STYLE[weapon.type] === 'thrust' ? 'attack_thrust' : 'attack_slash';
    smearFor(rig, WEAPON_STYLE[weapon.type]);
    const orb = w.getObjectByName('orb');
    if (orb) rig.extraUpdate.push((dt, t) => { orb.rotation.y = t * 2; });
  }
  const size = weapon?.type === 'spear' ? 160 : 136;
  return new RigBillboard(rig, { size, anims: animsFor(weapon?.type), scale: def.scale && def.scale < 0.9 ? 1 : 1 });
}
