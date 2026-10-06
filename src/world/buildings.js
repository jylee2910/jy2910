// Low-poly 3D architecture with world-scaled pixel textures (HD-2D style):
// houses, castle walls, towers, gates, stairs, ruins.
import * as THREE from 'three';
import { assets } from '../engine/assets.js';
import { TILE } from './terrain.js';

const matCache = {};
export function texMat(name, opts = {}) {
  const key = name + JSON.stringify(opts);
  if (matCache[key]) return matCache[key];
  let t = assets.tex[name];
  const w = t?.image?.width || 64;
  if (w !== 64) {
    t = t.clone();
    t.needsUpdate = true;
    t.repeat.set(64 / w, 64 / w);
  }
  const m = new THREE.MeshLambertMaterial({ map: t, color: opts.color ?? 0xffffff, side: opts.side ?? THREE.FrontSide, emissive: opts.emissive ?? 0x000000 });
  matCache[key] = m;
  return m;
}

// scale every face's UVs to world size so 1 texture tile = TILE metres
function worldUV(geo, sx = 1, sy = 1) {
  geo.computeBoundingBox();
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    let u, v;
    if (ny > nx && ny > nz) {
      u = x; v = z;
    } else if (nx > nz) {
      u = z; v = y;
    } else {
      u = x; v = y;
    }
    uv.setXY(i, (u / TILE) * sx, (v / TILE) * sy);
  }
  uv.needsUpdate = true;
  return geo;
}

export function box(w, h, d, side, top = side, opts = {}) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  worldUV(g, opts.su ?? 1, opts.sv ?? 1);
  const ms = texMat(side), mt = texMat(top);
  const mesh = new THREE.Mesh(g, [ms, ms, mt, mt, ms, ms]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function cylinder(r, h, side, top = side, seg = 16, r2 = r) {
  const g = new THREE.CylinderGeometry(r2, r, h, seg, 1, false);
  g.translate(0, h / 2, 0);
  // cylinder uv: wrap around circumference
  const uv = g.attributes.uv;
  const circ = 2 * Math.PI * r;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * circ) / TILE, (uv.getY(i) * h) / TILE);
  const mesh = new THREE.Mesh(g, [texMat(side), texMat(top), texMat(top)]);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

export function cone(r, h, mat, seg = 16) {
  const g = new THREE.ConeGeometry(r, h, seg, 1, true);
  g.translate(0, h / 2, 0);
  const uv = g.attributes.uv;
  const slant = Math.hypot(r, h);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * 2 * Math.PI * r) / TILE, (uv.getY(i) * slant) / TILE);
  const mesh = new THREE.Mesh(g, texMat(mat, { side: THREE.DoubleSide }));
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

// gable roof prism along x
export function roof(w, d, h, mat, overhang = 0.35) {
  const W = w / 2 + overhang, D = d / 2 + overhang;
  const shape = [
    [-W, 0, -D], [W, 0, -D], [W, h, 0], [-W, h, 0], // back slope
    [-W, h, 0], [W, h, 0], [W, 0, D], [-W, 0, D], // front slope
  ];
  const pos = [];
  const uv = [];
  const L = Math.hypot(D, h);
  const quad = (a, b, c, d2) => {
    for (const p of [a, b, c, a, c, d2]) pos.push(...shape[p]);
    uv.push(0, 0, w / TILE, 0, w / TILE, L / TILE, 0, 0, w / TILE, L / TILE, 0, L / TILE);
  };
  quad(1, 0, 3, 2);
  quad(7, 6, 5, 4);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, texMat(mat, { side: THREE.DoubleSide }));
  m.castShadow = m.receiveShadow = true;
  // gable ends
  const tri = new THREE.BufferGeometry();
  const wE = w / 2;
  const tp = [-wE, 0, -d / 2, -wE, 0, d / 2, -wE, h * (d / 2) / D, 0, wE, 0, d / 2, wE, 0, -d / 2, wE, h * (d / 2) / D, 0];
  tri.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
  tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, d / TILE, 0, d / 2 / TILE, h / TILE, 0, 0, d / TILE, 0, d / 2 / TILE, h / TILE], 2));
  tri.computeVertexNormals();
  const te = new THREE.Mesh(tri, texMat('plaster', { side: THREE.DoubleSide }));
  te.castShadow = true;
  const g2 = new THREE.Group();
  g2.add(m, te);
  return g2;
}

function windowQuad(w, h, lit = true) {
  const g = new THREE.PlaneGeometry(w, h);
  const m = new THREE.MeshBasicMaterial({ color: lit ? 0xffd890 : 0x2a2a3a });
  const mesh = new THREE.Mesh(g, m);
  const frame = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.12, h + 0.12), new THREE.MeshLambertMaterial({ color: 0x3a2414 }));
  frame.position.z = -0.005;
  const cross = new THREE.Mesh(new THREE.PlaneGeometry(0.05, h), new THREE.MeshLambertMaterial({ color: 0x3a2414 }));
  cross.position.z = 0.003;
  const grp = new THREE.Group();
  grp.add(frame, mesh, cross);
  return grp;
}

export function house({ w = 5, d = 4, h = 3, roofMat = 'roof', rotY = 0, lit = true } = {}) {
  const g = new THREE.Group();
  const base = box(w + 0.2, 0.5, d + 0.2, 'cobble');
  const walls = box(w, h, d, 'plaster');
  walls.position.y = 0.5;
  const r = roof(w, d, h * 0.62, roofMat);
  r.position.y = h + 0.5;
  // chimney
  const ch = box(0.6, 1.6, 0.6, 'bricks');
  ch.position.set(w * 0.25, h + 0.5 + 0.3, -d * 0.15);
  g.add(base, walls, r, ch);
  // door
  const door = box(0.9, 1.6, 0.12, 'wood');
  door.position.set(-w * 0.28, 0.5, d / 2 + 0.02);
  g.add(door);
  for (const wx of [w * 0.05, w * 0.32]) {
    const win = windowQuad(0.7, 0.7, lit);
    win.position.set(wx, 0.5 + h * 0.55, d / 2 + 0.02);
    g.add(win);
  }
  const win2 = windowQuad(0.7, 0.7, lit);
  win2.position.set(w / 2 + 0.02, 0.5 + h * 0.55, 0);
  win2.rotation.y = Math.PI / 2;
  g.add(win2);
  g.rotation.y = rotY;
  return g;
}

// crenellated wall segment along local x
export function castleWall(len, h = 6, thick = 2.0) {
  const g = new THREE.Group();
  const wall = box(len, h, thick, 'castle_wall', 'castle_floor');
  g.add(wall);
  const n = Math.floor(len / 1.4);
  for (let i = 0; i < n; i++) {
    const m = box(0.8, 0.8, thick + 0.2, 'castle_wall', 'castle_floor');
    m.position.set(-len / 2 + 0.7 + i * (len - 1.4) / Math.max(1, n - 1), h, 0);
    g.add(m);
  }
  return g;
}

export function tower(r = 2.4, h = 10, roofMat = 'roof') {
  const g = new THREE.Group();
  const body = cylinder(r, h, 'castle_wall', 'castle_floor', 20);
  g.add(body);
  const ring = cylinder(r + 0.35, 0.6, 'castle_wall', 'castle_floor', 20);
  ring.position.y = h - 0.4;
  g.add(ring);
  const c = cone(r + 0.6, r * 2.4, roofMat, 20);
  c.position.y = h + 0.2;
  g.add(c);
  // slit windows
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.4;
    const w = windowQuad(0.35, 0.9, true);
    w.position.set(Math.sin(a) * (r + 0.01), h * 0.6, Math.cos(a) * (r + 0.01));
    w.rotation.y = a;
    g.add(w);
  }
  return g;
}

export function gate(w = 5, h = 7, d = 3) {
  const g = new THREE.Group();
  const L = box(1.6, h, d, 'castle_wall', 'castle_floor');
  L.position.x = -w / 2 - 0.8;
  const R = box(1.6, h, d, 'castle_wall', 'castle_floor');
  R.position.x = w / 2 + 0.8;
  const T = box(w + 3.2, 2, d, 'castle_wall', 'castle_floor');
  T.position.y = h - 2;
  // dark opening + portcullis bars
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(w, h - 2), new THREE.MeshBasicMaterial({ color: 0x0a0a12 }));
  hole.position.set(0, (h - 2) / 2, -0.3);
  g.add(L, R, T, hole);
  for (let i = 0; i < 6; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.4, 0.08), new THREE.MeshLambertMaterial({ color: 0x2a2a33 }));
    bar.position.set(-w / 2 + 0.4 + i * (w - 0.8) / 5, h - 2.7, d / 2 - 0.2);
    g.add(bar);
  }
  return g;
}

export function stairs(w, steps, rise, run, mat = 'castle_floor') {
  const g = new THREE.Group();
  for (let i = 0; i < steps; i++) {
    const s = box(w, rise * (i + 1), run, mat);
    s.position.z = -i * run;
    g.add(s);
  }
  return g;
}

export function brokenPillar(h, r = 0.55) {
  const g = new THREE.Group();
  const base = box(r * 2.7, 0.45, r * 2.7, 'castle_wall', 'castle_floor');
  const plinth = box(r * 2.3, 0.3, r * 2.3, 'castle_wall', 'castle_floor');
  plinth.position.y = 0.45;
  const col = cylinder(r, h, 'castle_wall', 'castle_floor', 12);
  col.position.y = 0.75;
  g.add(base, plinth, col);
  if (h > 3.8) {
    const cap = box(r * 2.5, 0.35, r * 2.5, 'castle_wall', 'castle_floor');
    cap.position.y = 0.75 + h;
    g.add(cap);
  } else {
    // jagged broken top
    const top = new THREE.Mesh(new THREE.ConeGeometry(r, 0.5, 7, 1), texMat('castle_wall'));
    top.position.y = 0.75 + h + 0.2;
    top.rotation.set(0.3, 0.7, 0.2);
    top.castShadow = true;
    g.add(top);
  }
  return g;
}
