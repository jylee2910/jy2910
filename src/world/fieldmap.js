// "Granvale Plains" – the tutorial overworld diorama.
//   North: Castle Arcadia on a cliff plateau      South-east: the Old Shrine
//   West: village, windmill, lake fed by a waterfall    East: river + bridge, forest
import * as THREE from 'three';
import { clamp, distToPolyline, fbm, lerp, mulberry, smoothstep, spline, vnoise } from '../engine/noise.js';
import { castleWall, gate, house, tower, box, brokenPillar, stairs, cylinder } from './buildings.js';
import { PropField } from './props.js';
import { Terrain } from './terrain.js';
import { Water, Waterfall } from './water.js';

export const PATH = spline(
  [
    [0, -31], [0, -24], [-3, -16], [-6, -9], [-2, -3], [6, 1], [14, 4], [21, 5.5], [27, 9], [31, 15], [33, 21], [34, 25],
  ],
  10,
);
const VILLAGE_PATH = spline([[-6, -9], [-14, -10], [-22, -11], [-28, -15]], 8);
const RIVER = spline([[62, -46], [44, -30], [30, -12], [22, 4], [16, 18], [6, 34], [-6, 58]], 10);
const LAKE = { x: -40, z: 18, r: 11 };
const SHRINE = { x: 36, z: 31, r: 12 };
const CASTLE_EDGE = -27.5;
const WEST_EDGE = -50;

export const SPOTS = {
  start: [0, -19],
  gate: [0, -31],
  village: [-18, -8],
  bridge: [21, 5.5],
  meet: [28, 11],
  shrineEntry: [33, 22],
  crystal: [38, 33],
  boss: [37, 30],
};

function plateauNoise(x, z) {
  return (fbm(x * 0.08, z * 0.08, 5, 3) - 0.5) * 4;
}

export function fieldHeight(x, z) {
  let h = (fbm(x * 0.035, z * 0.035, 1, 4) - 0.5) * 2.2 + (fbm(x * 0.12, z * 0.12, 2, 2) - 0.5) * 0.5;
  // keep dry land above the water table away from the river / lake
  h = Math.max(h, -0.3) + 0.15;
  // castle plateau to the north: cliffs everywhere except a broad ramp at the gate
  const edge = CASTLE_EDGE + plateauNoise(x, 0) * 0.6 * smoothstep(5, 9, Math.abs(x));
  const rampW = lerp(9.0, 0.9, smoothstep(4.5, 8.5, Math.abs(x)));
  const pc = smoothstep(edge + rampW, edge - 0.9, z);
  h = lerp(h, 3.2 + (fbm(x * 0.05, z * 0.05, 9, 2) - 0.5) * 0.4 * smoothstep(4, 9, Math.abs(x)), pc);
  // west highland (waterfall source)
  const we = WEST_EDGE + plateauNoise(0, z) * 0.6;
  const pw = smoothstep(we + 1.0, we - 1.0, x) * smoothstep(-6, 4, z);
  h = lerp(h, 6.5, pw);
  // shrine mesa (south-east)
  const ds = Math.hypot(x - SHRINE.x, z - SHRINE.z) + plateauNoise(x, z) * 0.5;
  // ramp on the north-west side of the mesa where the path arrives
  const ang = Math.atan2(z - SHRINE.z, x - SHRINE.x);
  const toEntry = Math.abs(((ang - Math.atan2(SPOTS.shrineEntry[1] - SHRINE.z, SPOTS.shrineEntry[0] - SHRINE.x) + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  const sw = lerp(8.0, 1.0, smoothstep(0.25, 0.6, toEntry));
  const ps = smoothstep(SHRINE.r + sw, SHRINE.r - 1.0, ds);
  h = lerp(h, 2.4, ps);
  // flatten the path a little so it reads as a trodden road
  const p = distToPolyline(x, z, PATH);
  if (p.d < 3) h -= smoothstep(3, 1.0, p.d) * 0.08;
  // river channel
  const r = distToPolyline(x, z, RIVER);
  if (r.d < 6) {
    const bank = smoothstep(5.5, 2.2, r.d);
    h = lerp(h, -1.4, bank * (1 - pc) * (1 - ps));
  }
  // lake basin
  const dl = Math.hypot(x - LAKE.x, (z - LAKE.z) * 1.15);
  h = lerp(h, -1.8, smoothstep(LAKE.r + 2.5, LAKE.r - 2, dl) * (1 - pw * 0.0));
  return h;
}

// height profile along the main path (keeps ramps walkable)
function pathHeight(t) {
  // castle gate (t≈0) at 5.2, down to plains, up to shrine at t≈1
  const k = [
    [0, 5.2], [0.07, 5.0], [0.16, 0.6], [0.25, 0.2], [0.55, 0.0], [0.62, 0.15], [0.78, 0.4], [0.88, 1.2], [1.0, 3.0],
  ];
  for (let i = 0; i < k.length - 1; i++) if (t <= k[i + 1][0]) return lerp(k[i][1], k[i + 1][1], smoothstep(k[i][0], k[i + 1][0], t));
  return 3.0;
}

function paint(x, z, h, slope) {
  const w = [0, 0, 0, 0, 0, 0, 0, 0];
  // grass base, flower meadows, forest floor
  const f = fbm(x * 0.06, z * 0.06, 33, 3);
  w[0] = 1;
  w[1] = smoothstep(0.55, 0.7, f);
  const forest = forestMask(x, z);
  w[5] = forest * 1.2;
  // paths
  const p = distToPolyline(x, z, PATH).d;
  const pv = distToPolyline(x, z, VILLAGE_PATH).d;
  w[2] = smoothstep(2.2, 1.0, Math.min(p, pv)) * 1.6;
  w[6] = smoothstep(2.9, 2.0, Math.min(p, pv)) * 0.9;
  // shores / sand
  const r = distToPolyline(x, z, RIVER).d;
  const dl = Math.hypot(x - LAKE.x, (z - LAKE.z) * 1.15);
  if (h < 0.2) w[3] = smoothstep(0.2, -0.6, h) * 1.4 * (r < 7 || dl < LAKE.r + 4 ? 1 : 0);
  // castle courtyard cobble & village square
  if (z < CASTLE_EDGE - 2.5 && Math.abs(x) < 18) w[4] = 1.5;
  if (Math.hypot(x + 20, z + 9) < 4.5) w[4] = 1.3;
  // shrine mesa: worn stone
  if (Math.hypot(x - SHRINE.x, z - SHRINE.z) < SHRINE.r - 2.5) w[7] = smoothstep(SHRINE.r - 2.5, SHRINE.r - 5, Math.hypot(x - SHRINE.x, z - SHRINE.z)) * 1.4 + (fbm(x * 0.3, z * 0.3, 4, 2) - 0.5);
  return w;
}

function forestMask(x, z) {
  const ne = smoothstep(12, 2, Math.hypot((x - 46) * 0.7, z + 14));
  const sw = smoothstep(10, 2, Math.hypot((x + 14) * 0.8, z - 36));
  const se = smoothstep(9, 2, Math.hypot(x - 52, z - 24));
  return Math.max(ne, sw, se);
}

export function buildField() {
  const terrain = new Terrain({ width: 132, depth: 116, step: 0.5, x0: -66, z0: -58, height: fieldHeight, paint, cliff: 'cliff', cliffTop: 0.5 });
  const group = new THREE.Group();
  group.add(terrain.mesh);

  // water ------------------------------------------------------------------
  const waterMask = (x, z) => distToPolyline(x, z, RIVER).d < 7 || Math.hypot(x - LAKE.x, (z - LAKE.z) * 1.15) < LAKE.r + 4;
  const water = new Water({ x0: -66, z0: -58, width: 132, depth: 116, level: -0.55, terrain, step: 0.5, mask: waterMask });
  group.add(water.mesh);
  const falls = [new Waterfall({ x: WEST_EDGE + 0.6, z: 14, y0: -0.6, y1: 6.6, width: 3.4, rotY: Math.PI / 2 })];
  for (const f of falls) group.add(f.mesh);

  // props --------------------------------------------------------------------
  const props = new PropField();
  const rnd = mulberry(1234);
  const H = (x, z) => terrain.heightAt(x, z);
  const near = (x, z, list, d) => list.some(([a, b]) => Math.hypot(x - a, z - b) < d);
  const avoid = (x, z) => {
    if (distToPolyline(x, z, PATH).d < 3.0) return true;
    if (distToPolyline(x, z, VILLAGE_PATH).d < 2.6) return true;
    if (H(x, z) < -0.3) return true;
    if (terrain.slopeAt(x, z) > 0.7) return true;
    if (z < CASTLE_EDGE - 1 && Math.abs(x) < 22) return true; // castle grounds
    if (Math.hypot(x - SHRINE.x, z - SHRINE.z) < SHRINE.r - 1) return true;
    if (Math.hypot(x + 21, z + 9) < 10) return true; // village (trees)
    return false;
  };
  const houses = [
    [-26, -16, 0.2, 'roof'], [-14, -15, -0.15, 'roof_red'], [-30, -5, 0.5, 'roof_red'], [-12, -2, -0.4, 'roof'], [-24, 0, 0.1, 'roof'],
  ];
  // forests
  for (let i = 0; i < 1400; i++) {
    const x = -64 + rnd() * 128, z = -56 + rnd() * 112;
    if (avoid(x, z)) continue;
    const fm = forestMask(x, z);
    const edgeBand = Math.abs(x) > 56 || Math.abs(z) > 48 ? 0.65 : 0;
    const chance = fm * 0.55 + edgeBand + 0.025;
    if (rnd() > chance) continue;
    const t = rnd();
    const name = fm > 0.4 && t < 0.35 ? 'pine' + (1 + Math.floor(rnd() * 2)) : t < 0.5 ? 'tree1' : t < 0.75 ? 'tree2' : t < 0.95 ? 'tree3' : 'tree_aut';
    props.add(name, x, H(x, z) - 0.05, z, { scale: 0.9 + rnd() * 0.35, collide: 0.7 });
  }
  // undergrowth: bushes, grass, flowers, rocks
  const nearHouse = (x, z) => houses.some(([hx, hz]) => Math.abs(x - hx) < 3.2 && Math.abs(z - hz) < 2.8);
  for (let i = 0; i < 9000; i++) {
    const x = -64 + rnd() * 128, z = -56 + rnd() * 112;
    const village = Math.hypot(x + 21, z + 9) < 10;
    if (village ? nearHouse(x, z) || distToPolyline(x, z, VILLAGE_PATH).d < 2.4 || Math.hypot(x + 20, z + 9) < 4.8 : avoid(x, z) && rnd() < 0.85) continue;
    if (z < CASTLE_EDGE - 1 && Math.abs(x) < 22) continue;
    if (H(x, z) < -0.3 || terrain.slopeAt(x, z) > 0.6) continue;
    const t = rnd();
    const f = fbm(x * 0.06, z * 0.06, 33, 3);
    let name;
    if (t < 0.62) name = 'grass' + (1 + Math.floor(rnd() * 3));
    else if (t < 0.8) name = f > 0.55 ? ['flowers_w', 'flowers_y', 'flowers_p'][Math.floor(rnd() * 3)] : 'grass1';
    else if (t < 0.88) name = rnd() < 0.7 ? 'bush1' : 'bush2';
    else if (t < 0.975) name = 'rock3';
    else name = 'rock1';
    props.add(name, x, H(x, z) - 0.02, z, { scale: 0.85 + rnd() * 0.4, collide: name.startsWith('bush') ? 0.45 : name === 'rock1' ? 0.6 : 0 });
  }
  // shoreline rocks around the lake
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2;
    const x = LAKE.x + Math.cos(a) * (LAKE.r + 1.5 + rnd() * 2), z = LAKE.z + Math.sin(a) * (LAKE.r + 1.5 + rnd() * 2) / 1.15;
    if (H(x, z) < -0.4) continue;
    props.add(rnd() < 0.3 ? 'rock2' : 'rock1', x, H(x, z) - 0.1, z, { scale: 0.6 + rnd() * 0.5, collide: 0.8 });
  }

  // village ------------------------------------------------------------------
  const bld = new THREE.Group();

  for (const [x, z, r, m] of houses) {
    const hgt = H(x, z);
    const hs = house({ w: 4.6, d: 3.8, h: 2.5, roofMat: m, rotY: r });
    hs.position.set(x, hgt - 0.3, z);
    bld.add(hs);
    props.colliders.push({ x, z, r: 3.3 });
  }
  props.add('windmill', -36, H(-36, -13) - 0.2, -13, { flip: false, collide: 2.2 });
  props.add('well', -20, H(-20, -9), -9, { flip: false, collide: 1.1 });
  for (const [x, z] of [[-17, -11], [-23, -6], [-15, -6]]) props.add(['barrel', 'crate'][Math.floor(rnd() * 2)], x, H(x, z), z, { collide: 0.5 });
  for (let i = 0; i < 8; i++) props.add('fence', -33 + i * 1.3, H(-33 + i * 1.3, 4), 4, { flip: false });
  props.add('sign', -4.5, H(-4.5, -6.5), -6.5, { flip: false, collide: 0.4 });
  props.add('sign', 15, H(15, 7.2), 7.2, { flip: false, collide: 0.4 });

  // castle -------------------------------------------------------------------
  const castle = new THREE.Group();
  const cy = 3.2;
  const front = -33;
  const wallL = castleWall(12, 6.5, 2.2);
  wallL.position.set(-10.2, cy, front);
  const wallR = castleWall(12, 6.5, 2.2);
  wallR.position.set(10.2, cy, front);
  const g = gate(5.2, 8.2, 3.2);
  g.position.set(0, cy, front);
  castle.add(wallL, wallR, g);
  for (const sx of [-1, 1]) {
    const t = tower(2.6, 11, 'roof');
    t.position.set(sx * 17, cy, front);
    castle.add(t);
    const t2 = tower(1.8, 9, 'roof');
    t2.position.set(sx * 4.4, cy, front + 0.4);
    castle.add(t2);
    const side = castleWall(14, 6.5, 2.2);
    side.rotation.y = Math.PI / 2;
    side.position.set(sx * 17, cy, front - 8);
    castle.add(side);
  }
  // keep
  const keep = box(14, 12, 9, 'castle_wall', 'castle_floor');
  keep.position.set(0, cy, front - 12);
  castle.add(keep);
  for (const sx of [-1, 0, 1]) {
    const kt = tower(sx === 0 ? 3.2 : 2.2, sx === 0 ? 20 : 15, 'roof');
    kt.position.set(sx * 6.4, cy, front - 12 - (sx === 0 ? 1 : 0));
    castle.add(kt);
  }
  // banners & torches on the gate
  props.add('banner_blue', -3.3, cy + 3.2, front + 1.7, { flip: false });
  props.add('banner_blue', 3.3, cy + 3.2, front + 1.7, { flip: false });
  props.add('torch', -3.8, cy, front + 2.4, { flip: false });
  props.add('torch', 3.8, cy, front + 2.4, { flip: false });
  props.colliders.push({ x: 0, z: front - 1, r: 0, wall: [-22, front - 1.3, 22, front + 1.4] });
  bld.add(castle);

  // bridge -------------------------------------------------------------------
  const bridge = new THREE.Group();
  const deck = box(9, 0.35, 3.2, 'wood');
  deck.position.y = 0;
  bridge.add(deck);
  for (const sz of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const post = box(0.25, 1.0, 0.25, 'wood');
      post.position.set(-4 + i * 2, 0.35, sz * 1.5);
      bridge.add(post);
    }
    const rail = box(9, 0.18, 0.18, 'wood');
    rail.position.set(0, 1.2, sz * 1.5);
    bridge.add(rail);
  }
  for (const sx of [-3.2, 0, 3.2]) {
    const pil = box(0.5, 2.0, 0.5, 'wood');
    pil.position.set(sx, -2.0, 0);
    bridge.add(pil);
  }
  bridge.position.set(SPOTS.bridge[0], 0.05, SPOTS.bridge[1]);
  bridge.rotation.y = -0.22;
  bld.add(bridge);

  // shrine ruins ------------------------------------------------------------
  const ruins = new THREE.Group();
  const sh = SHRINE;
  const sy = 2.4;
  const plat = box(9, 0.6, 9, 'castle_floor', 'marble');
  plat.position.set(sh.x + 2, sy - 0.25, sh.z + 2);
  ruins.add(plat);
  const st = stairs(4, 3, 0.2, 0.6, 'castle_floor');
  st.rotation.y = Math.PI * 0.75;
  st.position.set(sh.x - 2.1, sy - 0.25, sh.z - 2.1);
  ruins.add(st);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const hgt = [4.2, 2.1, 4.2, 1.0, 4.2, 3.0, 0.7, 4.2][i];
    const p = brokenPillar(hgt);
    p.position.set(sh.x + 2 + Math.cos(a) * 6.2, sy - 0.1, sh.z + 2 + Math.sin(a) * 6.2);
    ruins.add(p);
    props.colliders.push({ x: p.position.x, z: p.position.z, r: 0.75 });
  }
  // fallen column pieces
  for (const [dx, dz, r] of [[-4, 6, 0.3], [5, -4, 1.2]]) {
    const c = cylinder(0.5, 2.2, 'marble', 'marble', 10);
    c.rotation.z = Math.PI / 2;
    c.rotation.y = r;
    c.position.set(sh.x + dx, sy + 0.5, sh.z + dz);
    ruins.add(c);
  }
  props.add('crystal', SPOTS.crystal[0], sy + 0.05, SPOTS.crystal[1], { flip: false, scale: 1.7, collide: 1.2 });
  for (let i = 0; i < 5; i++) {
    const a = i * 0.9 + 2.6;
    const x = sh.x + Math.cos(a) * 9, z = sh.z + Math.sin(a) * 9;
    props.add('crystal_p', x, H(x, z) - 0.1, z, { scale: 0.55 + rnd() * 0.3 });
  }
  bld.add(ruins);

  props.build();
  group.add(props.group, bld);

  const walk = (x, z, r = 0.3) => {
    if (x < -63 || x > 63 || z < -55 || z > 54) return false;
    // bridge deck is walkable
    const bx = x - SPOTS.bridge[0], bz = z - SPOTS.bridge[1];
    const c = Math.cos(-0.22), s = Math.sin(-0.22);
    const lx = bx * c - bz * s, lz = bx * s + bz * c;
    if (Math.abs(lx) < 4.6 && Math.abs(lz) < 1.3) return true;
    if (terrain.heightAt(x, z) < -0.45) return false;
    if (terrain.slopeAt(x, z) > 1.1) return false;
    if (z < front + 1.6 && z > front - 30 && Math.abs(x) < 23) return false; // castle wall line
    for (const c2 of props.colliders) if (!c2.wall && Math.hypot(x - c2.x, z - c2.z) < c2.r + r) return false;
    return true;
  };
  const groundAt = (x, z) => {
    const bx = x - SPOTS.bridge[0], bz = z - SPOTS.bridge[1];
    const c = Math.cos(-0.22), s = Math.sin(-0.22);
    const lx = bx * c - bz * s, lz = bx * s + bz * c;
    if (Math.abs(lx) < 4.6 && Math.abs(lz) < 1.6) return Math.max(0.4, terrain.heightAt(x, z));
    return terrain.heightAt(x, z);
  };
  return { group, terrain, water, falls, props, walk, groundAt, castleGateZ: front };
}
