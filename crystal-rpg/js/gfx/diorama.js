// 타일 문자열 맵 → three.js 디오라마. 인스턴싱으로 드로우콜을 줄인다.
import * as THREE from 'three';
import { textureCanvas } from '../art/assets.js';
import { PALETTE } from '../art/palette.js';

// 타일 정의: top/side 텍스처, 높이, 통행 여부
export const TILES = {
  '.': { top: 'grass', side: 'grassSide', h: 0, walk: true },
  ',': { top: 'grassFlower', side: 'grassSide', h: 0, walk: true },
  ':': { top: 'dirt', side: 'grassSide', h: 0, walk: true },
  '_': { top: 'sand', side: 'grassSide', h: 0, walk: true },
  '=': { top: 'stoneFloor', side: 'stoneWall', h: 0, walk: true },
  'w': { top: 'planks', side: 'planks', h: 0, walk: true },
  'A': { top: 'altar', side: 'stoneWall', h: 0, walk: true },
  '#': { top: 'stoneFloor', side: 'stoneWall', h: 1.5, walk: false },
  'M': { top: 'leavesDark', side: 'mossWall', h: 1.5, walk: false },
  'T': { top: 'grass', side: 'grassSide', h: 0, walk: false, tree: 'leaves' },
  't': { top: 'grass', side: 'grassSide', h: 0, walk: false, tree: 'leavesDark' },
  'f': { top: 'grass', side: 'grassSide', h: 0, walk: false, fence: true },
  '~': { top: 'water', side: 'stoneWall', h: -0.35, walk: false, water: true },
  'b': { top: 'planks', side: 'planks', h: 0, walk: true, bridge: true },
  'r': { top: 'caveFloor', side: 'caveWall', h: 0, walk: true },
  'R': { top: 'caveFloor', side: 'caveWall', h: 2.0, walk: false },
  'C': { top: 'caveFloor', side: 'caveWall', h: 0, walk: false, crystal: true },
  'o': { top: 'grass', side: 'grassSide', h: 0, walk: false, rock: true },
  'x': { top: 'caveFloor', side: 'caveWall', h: 0, walk: false, rock: true },
  'h': { top: 'dirt', side: 'grassSide', h: 0, walk: false }, // 집 부지
};

export const THEMES = {
  town: { sky: ['#6fb6ff', '#ffe9c8'], fog: ['#d8e8f0', 22, 55], hemi: ['#cfe6ff', '#6a8a50', 1.1], sun: ['#fff0d0', 2.6], sunDir: [-7, 14, 8], motes: 'pollen', exposure: 1.05, ground: 'grass' },
  field: { sky: ['#5aa8ff', '#fff4d8'], fog: ['#dcecf4', 20, 50], hemi: ['#cfe6ff', '#6a8a50', 1.1], sun: ['#fff4e0', 2.6], sunDir: [-8, 14, 6], motes: 'pollen', exposure: 1.05, ground: 'grass' },
  forest: { sky: ['#2e5a4a', '#a8d0a0'], fog: ['#58806a', 12, 34], hemi: ['#a8d8b0', '#2a4a30', 0.8], sun: ['#ffe8b0', 1.7], sunDir: [-5, 14, 4], motes: 'firefly', exposure: 1.0, ground: 'leavesDark' },
  cave: { sky: ['#0a0a1e', '#28305a'], fog: ['#141a38', 12, 34], hemi: ['#8aa0f0', '#2a2050', 1.3], sun: ['#b0c8ff', 1.5], sunDir: [-4, 14, 6], motes: 'crystal', exposure: 1.15, ground: 'caveRock' },
  boss: { sky: ['#12061e', '#4a1a4a'], fog: ['#200a2a', 14, 36], hemi: ['#c090f0', '#301030', 1.2], sun: ['#e0b0ff', 1.6], sunDir: [-4, 14, 6], motes: 'ember', exposure: 1.15, ground: 'caveRock' },
  world: { sky: ['#4aa0ff', '#fff0d0'], fog: ['#cfe4f4', 26, 70], hemi: ['#cfe6ff', '#6a8a50', 1.15], sun: ['#fff0d0', 2.4], sunDir: [-8, 16, 8], motes: 'pollen', exposure: 1.05, ground: 'grass' },
};

const matCache = new Map();
function texMat(name, variant = 0, opts = {}) {
  const key = name + ':' + variant + JSON.stringify(opts);
  if (matCache.has(key)) return matCache.get(key);
  const tex = new THREE.CanvasTexture(textureCanvas(name, variant));
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(opts.repeat[0], opts.repeat[1]); }
  const m = new THREE.MeshLambertMaterial({ map: tex, ...(opts.mat || {}) });
  matCache.set(key, m);
  return m;
}

function gradientTexture(top, bottom) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d').createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  const ctx = c.getContext('2d'); ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

// 테마 조명/하늘/안개/부유 입자
export function applyTheme(scene, themeName, size = 20) {
  const th = THEMES[themeName];
  scene.background = gradientTexture(th.sky[0], th.sky[1]);
  scene.fog = new THREE.Fog(th.fog[0], th.fog[1], th.fog[2]);
  const hemi = new THREE.HemisphereLight(th.hemi[0], th.hemi[1], th.hemi[2]);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(th.sun[0], th.sun[1]);
  sun.position.set(...th.sunDir);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = size * 0.75;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 60 });
  sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.02;
  scene.add(sun); scene.add(sun.target);
  const motes = makeMotes(th.motes, size);
  scene.add(motes.points);
  return { hemi, sun, motes, theme: th };
}

function makeMotes(kind, size) {
  const n = kind === 'firefly' ? 60 : 90;
  const pos = new Float32Array(n * 3), seed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (Math.random() - 0.5) * size; pos[i * 3 + 1] = Math.random() * 4 + 0.2; pos[i * 3 + 2] = (Math.random() - 0.5) * size;
    seed[i] = Math.random() * 100;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const col = { pollen: 0xfff6c0, firefly: 0xc8ff70, crystal: 0x90f0ff, ember: 0xff80d0 }[kind] || 0xffffff;
  const mat = new THREE.PointsMaterial({ color: col, size: kind === 'firefly' ? 0.22 : 0.12, map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9, fog: false });
  const points = new THREE.Points(geo, mat);
  const base = pos.slice();
  return {
    points,
    update(t) {
      for (let i = 0; i < n; i++) {
        const s = seed[i];
        pos[i * 3] = base[i * 3] + Math.sin(t * 0.3 + s) * 0.6;
        pos[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 0.5 + s * 2) * 0.4;
        pos[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.25 + s) * 0.6;
      }
      geo.attributes.position.needsUpdate = true;
      mat.opacity = kind === 'firefly' ? 0.6 + Math.sin(t * 3) * 0.3 : 0.8;
    },
  };
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();

// 맵 빌드. map = { rows: [...], objects: [...] }
export function buildDiorama(map) {
  const rows = map.rows;
  const H = rows.length, W = Math.max(...rows.map(r => r.length));
  const group = new THREE.Group();
  const ox = -W / 2 + 0.5, oz = -H / 2 + 0.5; // 타일 (x,y) → 월드 (x+ox, z+oz)
  const toWorld = (x, y) => new THREE.Vector3(x + ox, 0, y + oz);
  const blocked = new Set();
  const updaters = [];
  const lights = [];

  // 1) 지면/벽 블록을 (top,side,h) 조합별로 인스턴싱
  const buckets = new Map();
  const trees = [], rocks = [], crystals = [], fences = [], waters = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ch = rows[y][x] || ' ';
    const t = TILES[ch];
    if (!t) continue;
    if (!t.walk) blocked.add(x + ',' + y);
    const variant = (x * 7 + y * 13) % 3;
    const key = t.top + '|' + t.side + '|' + t.h + '|' + variant;
    if (!buckets.has(key)) buckets.set(key, { t, variant, list: [] });
    buckets.get(key).list.push([x, y]);
    if (t.tree) trees.push([x, y, t.tree]);
    if (t.rock) rocks.push([x, y, t.top]);
    if (t.crystal) crystals.push([x, y]);
    if (t.fence) fences.push([x, y]);
    if (t.water) waters.push([x, y]);
  }
  const base = 0.8; // 슬래브 두께
  for (const { t, variant, list } of buckets.values()) {
    const h = Math.max(t.h, -0.2);
    const height = base + h;
    const geo = new THREE.BoxGeometry(1, height, 1);
    geo.translate(0, height / 2 - base, 0);
    // 옆면 UV를 높이에 맞게
    const side = texMat(t.side, variant), top = texMat(t.water ? 'stoneFloor' : t.top, variant);
    const mats = [side, side, top, side, side, side];
    const mesh = new THREE.InstancedMesh(geo, mats, list.length);
    list.forEach(([x, y], i) => { _m.makeTranslation(x + ox, 0, y + oz); mesh.setMatrixAt(i, _m); });
    mesh.receiveShadow = true; mesh.castShadow = t.h > 0.5;
    group.add(mesh);
  }

  // 2) 물
  if (waters.length) {
    const wm = texMat('water', 0, { mat: { transparent: true, opacity: 0.85, emissive: new THREE.Color(PALETTE.waterS), emissiveIntensity: 0.25 } });
    const wtex = wm.map; wtex.wrapS = wtex.wrapT = THREE.RepeatWrapping;
    const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.InstancedMesh(geo, wm, waters.length);
    waters.forEach(([x, y], i) => { _m.makeTranslation(x + ox, -0.12, y + oz); mesh.setMatrixAt(i, _m); });
    mesh.receiveShadow = true;
    group.add(mesh);
    updaters.push(t => { wtex.offset.set(Math.sin(t * 0.4) * 0.06, t * 0.05); });
  }

  // 3) 나무 (줄기 + 잎 덩어리)
  if (trees.length) {
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1.0, 6); trunkGeo.translate(0, 0.5, 0);
    const trunk = new THREE.InstancedMesh(trunkGeo, texMat('bark'), trees.length);
    const blobGeo = new THREE.IcosahedronGeometry(0.55, 0);
    const byLeaf = {};
    trees.forEach(([x, y, leaf], i) => {
      const r = hash(x, y);
      _s.set(1, 0.8 + r * 0.5, 1);
      _m.compose(_p.set(x + ox + (r - 0.5) * 0.2, 0, y + oz + (hash(y, x) - 0.5) * 0.2), _q.identity(), _s);
      trunk.setMatrixAt(i, _m);
      (byLeaf[leaf] = byLeaf[leaf] || []).push([x, y, r]);
    });
    trunk.castShadow = true; trunk.receiveShadow = true;
    group.add(trunk);
    for (const [leaf, list] of Object.entries(byLeaf)) {
      const blobs = new THREE.InstancedMesh(blobGeo, texMat(leaf, 0, { mat: { flatShading: true } }), list.length * 3);
      let k = 0;
      for (const [x, y, r] of list) {
        const h0 = 0.9 + r * 0.4;
        const parts = [[0, h0 + 0.3, 0, 1.05], [0.25, h0, 0.15, 0.8], [-0.22, h0 + 0.05, -0.1, 0.78]];
        for (const [dx, dy, dz, sc] of parts) {
          _e.set(r * 3, r * 5 + dx, 0); _q.setFromEuler(_e);
          _s.setScalar(sc * (0.9 + r * 0.25));
          _m.compose(_p.set(x + ox + dx, dy, y + oz + dz), _q, _s);
          blobs.setMatrixAt(k++, _m);
        }
      }
      blobs.castShadow = true; blobs.receiveShadow = true;
      group.add(blobs);
    }
  }

  // 4) 바위
  if (rocks.length) {
    const geo = new THREE.DodecahedronGeometry(0.4, 0);
    const mesh = new THREE.InstancedMesh(geo, texMat(rocks[0][2] === 'caveFloor' ? 'caveWall' : 'stoneWall', 1, { mat: { flatShading: true } }), rocks.length);
    rocks.forEach(([x, y], i) => {
      const r = hash(x, y);
      _e.set(r, r * 4, 0); _q.setFromEuler(_e); _s.set(1 + r * 0.3, 0.7 + r * 0.3, 1);
      _m.compose(_p.set(x + ox, 0.18, y + oz), _q, _s); mesh.setMatrixAt(i, _m);
    });
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
  }

  // 5) 울타리
  if (fences.length) {
    const post = new THREE.BoxGeometry(0.12, 0.6, 0.12); post.translate(0, 0.3, 0);
    const mesh = new THREE.InstancedMesh(post, texMat('planks'), fences.length * 3);
    let k = 0;
    fences.forEach(([x, y]) => {
      _m.makeTranslation(x + ox - 0.35, 0, y + oz); mesh.setMatrixAt(k++, _m);
      _m.makeTranslation(x + ox + 0.35, 0, y + oz); mesh.setMatrixAt(k++, _m);
      _m.compose(_p.set(x + ox, 0.1, y + oz), _q.setFromEuler(_e.set(0, 0, Math.PI / 2)), _s.set(0.5, 1.8, 0.6));
      mesh.setMatrixAt(k++, _m);
    });
    mesh.castShadow = true; group.add(mesh);
  }

  // 6) 크리스탈
  for (const [x, y] of crystals) {
    const c = makeCrystal(hash(x, y));
    c.position.copy(toWorld(x, y));
    group.add(c);
    updaters.push(t => { c.children.forEach((m, i) => { if (m.material.emissiveIntensity !== undefined) m.material.emissiveIntensity = 0.8 + Math.sin(t * 2 + x + i) * 0.25; }); });
  }

  // 7) 오브젝트
  for (const o of map.objects || []) {
    if (o.type === 'house') {
      const hgrp = makeHouse(o);
      hgrp.position.copy(toWorld(o.x + (o.w - 1) / 2, o.y + (o.d - 1) / 2));
      group.add(hgrp);
      for (let yy = o.y; yy < o.y + o.d; yy++) for (let xx = o.x; xx < o.x + o.w; xx++) blocked.add(xx + ',' + yy);
    } else if (o.type === 'lamp') {
      const l = makeLamp(o.color);
      l.group.position.copy(toWorld(o.x, o.y));
      group.add(l.group); lights.push(l.light);
      blocked.add(o.x + ',' + o.y);
      updaters.push(t => { l.light.intensity = l.base * (0.9 + Math.sin(t * 7 + o.x) * 0.05 + Math.sin(t * 13) * 0.04); });
    } else if (o.type === 'well') {
      const w = makeWell(); w.position.copy(toWorld(o.x, o.y)); group.add(w); blocked.add(o.x + ',' + o.y);
    } else if (o.type === 'bigCrystal') {
      const c = makeCrystal(0.5, 2.2, o.color || 0x7ef0ff);
      c.position.copy(toWorld(o.x, o.y)); group.add(c);
      const pl = new THREE.PointLight(o.color || 0x7ef0ff, 6, 9, 1.6); pl.position.set(0, 1.5, 0); c.add(pl); lights.push(pl);
      blocked.add(o.x + ',' + o.y);
      updaters.push(t => { c.rotation.y = t * 0.3; pl.intensity = 5 + Math.sin(t * 2) * 1.5; });
    } else if (o.type === 'pointLight') {
      const pl = new THREE.PointLight(o.color || 0xffc080, o.intensity || 4, o.range || 7, 1.5);
      pl.position.copy(toWorld(o.x, o.y)).setY(o.h || 1.5); group.add(pl); lights.push(pl);
    } else if (o.type === 'signpost') {
      const s = makeSign(); s.position.copy(toWorld(o.x, o.y)); group.add(s); blocked.add(o.x + ',' + o.y);
    }
  }

  // 8) 슬래브 밑의 넓은 바닥 (디오라마 받침)
  return {
    group, blocked, lights, W, H, ox, oz, toWorld,
    walkable(x, y) { return x >= 0 && y >= 0 && x < W && y < H && TILES[rows[y][x]] && !blocked.has(x + ',' + y); },
    update(t) { for (const u of updaters) u(t); },
  };
}

function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }

export function makeCrystal(r = 0.5, scale = 1, color = 0x7ef0ff) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.1, flatShading: true, transparent: true, opacity: 0.92 });
  const n = 3;
  for (let i = 0; i < n; i++) {
    const geo = new THREE.OctahedronGeometry(0.22, 0); geo.scale(0.7, 2.4, 0.7);
    const m = new THREE.Mesh(geo, mat.clone());
    const a = i / n * Math.PI * 2 + r * 6;
    m.position.set(Math.cos(a) * 0.18 * (i ? 1 : 0), 0.4 * (i ? 0.75 : 1), Math.sin(a) * 0.18 * (i ? 1 : 0));
    m.rotation.set((i ? 0.4 : 0) * Math.cos(a), 0, (i ? 0.4 : 0) * Math.sin(a));
    if (i) m.scale.setScalar(0.7);
    m.castShadow = true;
    g.add(m);
  }
  g.scale.setScalar(scale);
  return g;
}

function prismGeometry(w, h, d) {
  // 박공 지붕: 삼각기둥
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(0, h); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
  geo.translate(0, 0, -d / 2);
  // UV 재계산 (월드 크기 기준으로 반복)
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + pos.getZ(i)) * 1.0, pos.getY(i) * 1.5);
  return geo;
}

function repeatMat(name, rx, ry, extra) { return texMat(name, 0, { repeat: [rx, ry], mat: extra }); }

export function makeHouse({ w = 3, d = 3, roof = 'roofRed', wallH = 1.6, sign = null }) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, wallH, d - 0.1), [
    repeatMat('plaster', d, 1.5), repeatMat('plaster', d, 1.5), repeatMat('plaster', w, 1), repeatMat('plaster', w, 1), repeatMat('plaster', w, 1.5), repeatMat('plaster', w, 1.5)]);
  body.position.y = wallH / 2; body.castShadow = true; body.receiveShadow = true; g.add(body);
  const roofGeo = prismGeometry(w + 0.4, 1.3, d + 0.3);
  const rtex = repeatMat(roof, 1, 1);
  rtex.map.wrapS = rtex.map.wrapT = THREE.RepeatWrapping;
  const roofM = new THREE.Mesh(roofGeo, rtex);
  roofM.position.y = wallH; roofM.rotation.y = Math.PI / 2; roofM.castShadow = true; roofM.receiveShadow = true;
  g.add(roofM);
  // 굴뚝
  const ch = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.9, 0.3), texMat('stoneWall'));
  ch.position.set(w * 0.25, wallH + 0.8, -d * 0.15); ch.castShadow = true; g.add(ch);
  // 문 + 창 (앞면 = +z)
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.95), texMat('planks', 1));
  door.position.set(0, 0.48, d / 2 - 0.04); g.add(door);
  const winMat = new THREE.MeshStandardMaterial({ color: 0xffd890, emissive: 0xffb050, emissiveIntensity: 1.2 });
  for (const sx of [-1, 1]) {
    if (w < 2.5) break;
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), winMat);
    win.position.set(sx * w * 0.3, 0.95, d / 2 - 0.035); g.add(win);
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.52), texMat('planks'));
    frame.position.set(sx * w * 0.3, 0.95, d / 2 - 0.04); g.add(frame);
  }
  if (sign) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.06), texMat('planks', 2));
    s.position.set(-w * 0.3, 1.45, d / 2 + 0.05); g.add(s);
    const icon = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({ color: sign, toneMapped: false }));
    icon.position.set(-w * 0.3, 1.45, d / 2 + 0.09); g.add(icon);
  }
  return g;
}

export function makeLamp(color = 0xffc070) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.5, 6), new THREE.MeshLambertMaterial({ color: 0x3a3048 }));
  post.position.y = 0.75; post.castShadow = true; g.add(post);
  const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, 0.22), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.2 }));
  bulb.position.y = 1.55; g.add(bulb);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.15, 4), new THREE.MeshLambertMaterial({ color: 0x3a3048 }));
  cap.position.y = 1.75; cap.rotation.y = Math.PI / 4; g.add(cap);
  const light = new THREE.PointLight(color, 3.5, 6, 1.6); light.position.y = 1.5; g.add(light);
  return { group: g, light, base: 3.5 };
}

function makeWell() {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.5, 10, 1, true), texMat('stoneWall', 0, { mat: { side: THREE.DoubleSide } }));
  ring.position.y = 0.25; ring.castShadow = true; g.add(ring);
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.42, 10), new THREE.MeshStandardMaterial({ color: 0x3a8cd4, emissive: 0x1a4a80, emissiveIntensity: 0.5 }));
  water.rotation.x = -Math.PI / 2; water.position.y = 0.3; g.add(water);
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 0.08), texMat('planks')); p.position.set(s * 0.42, 0.55, 0); p.castShadow = true; g.add(p); }
  const roof = new THREE.Mesh(prismGeometry(1.2, 0.4, 0.8), texMat('roofBlue'));
  roof.position.y = 1.05; roof.castShadow = true; g.add(roof);
  return g;
}

function makeSign() {
  const g = new THREE.Group();
  const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), texMat('planks')); p.position.y = 0.45; p.castShadow = true; g.add(p);
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.32, 0.06), texMat('planks', 1)); b.position.y = 0.8; b.castShadow = true; g.add(b);
  return g;
}

// 전투용 아레나 생성 (테마별)
export function arenaMap(theme) {
  const W = 18, H = 12;
  const rows = [];
  for (let y = 0; y < H; y++) {
    let r = '';
    for (let x = 0; x < W; x++) {
      const edge = y < 2 || x < 1 || x > W - 2;
      const front = y > H - 3;
      const n = hash(x + 3, y + 7);
      if (front && theme !== 'cave' && theme !== 'boss') r += n < 0.3 ? ',' : '.';
      else if (theme === 'field' || theme === 'town') r += edge ? (n < 0.55 ? 'T' : n < 0.7 ? 'o' : ',') : n < 0.15 ? ',' : n < 0.25 ? ':' : '.';
      else if (theme === 'forest') r += edge ? (n < 0.75 ? 't' : 'o') : n < 0.2 ? ':' : n < 0.3 ? ',' : '.';
      else if (theme === 'cave') r += y < 2 ? 'R' : edge ? (n < 0.35 ? 'C' : n < 0.6 ? 'x' : 'R') : 'r';
      else r += y < 2 ? 'R' : edge ? (n < 0.4 ? 'C' : 'R') : (Math.abs(x - W / 2) < 3 && Math.abs(y - H / 2) < 3 ? 'A' : '=');
    }
    rows.push(r);
  }
  const objects = [];
  if (theme === 'cave') objects.push({ type: 'bigCrystal', x: 3, y: 2 }, { type: 'bigCrystal', x: 14, y: 2, color: 0xa080ff });
  if (theme === 'boss') objects.push({ type: 'bigCrystal', x: 4, y: 2, color: 0xe060ff }, { type: 'bigCrystal', x: 13, y: 2, color: 0x7ef0ff });
  if (theme === 'forest') objects.push({ type: 'pointLight', x: 9, y: 4, color: 0xc0ff90, intensity: 3, range: 10, h: 3 });
  return { rows, objects };
}
