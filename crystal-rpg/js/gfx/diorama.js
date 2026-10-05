// ─────────────────────────────────────────────────────────────
//  디오라마 v2: 타일맵 + 높이맵 → 하나로 병합된 지형 메시
//   - 높이 단계(LV)에 따른 절벽/단차, 계단 타일, 정점 AO
//   - 자연 지면은 스플랫 셰이더로 풀/흙/모래/꽃이 도트 단위로 유기적으로 섞임
//   - 흔들리는 풀 포기·꽃, 활엽수/침엽수(바람 흔들림), 바위·덤불·울타리·소품
//   - 하늘: 구름, 먼 산 실루엣, 빛줄기(god ray), 부유 입자
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { textureCanvas } from '../art/assets.js';
import { PALETTE } from '../art/palette.js';

export const LV = 0.5;      // 높이 1단계 = 0.5 월드 단위
const BASE_Y = -1.2;        // 디오라마 바닥

// kind: ground(스플랫 지면) | floor(고유 텍스처 바닥) | wall(솟은 벽) | water | bridge | stairs
export const TILES = {
  '.': { kind: 'ground', mask: 'grass', walk: true, grassy: true },
  ',': { kind: 'ground', mask: 'flower', walk: true, grassy: true },
  ':': { kind: 'ground', mask: 'dirt', walk: true },
  '_': { kind: 'ground', mask: 'sand', walk: true },
  'h': { kind: 'ground', mask: 'dirt' },
  'T': { kind: 'ground', mask: 'grass', tree: 'round', grassy: true },
  't': { kind: 'ground', mask: 'grass', tree: 'pine', grassy: true },
  'u': { kind: 'ground', mask: 'grass', bush: true, grassy: true },
  'o': { kind: 'ground', mask: 'grass', rock: true, grassy: true },
  'f': { kind: 'ground', mask: 'grass', fence: true, grassy: true },
  '=': { kind: 'floor', top: 'stoneFloor2', side: 'stoneWall', walk: true },
  'w': { kind: 'floor', top: 'planks2', side: 'planks', walk: true },
  'A': { kind: 'floor', top: 'altar2', side: 'stoneWall', walk: true },
  's': { kind: 'stairs', top: 'stoneFloor2', side: 'stoneWall', walk: true },
  '#': { kind: 'wall', top: 'stoneTop', side: 'stoneWall', h: 1.5 },
  'M': { kind: 'wall', top: 'leaves2', side: 'mossWall', h: 1.5, rough: true },
  'R': { kind: 'wall', top: 'caveFloor2', side: 'cliffCave', h: 1.5, rough: true },
  'r': { kind: 'floor', top: 'caveFloor2', side: 'cliffCave', walk: true, cave: true },
  'C': { kind: 'floor', top: 'caveFloor2', side: 'cliffCave', crystal: true, cave: true },
  'x': { kind: 'floor', top: 'caveFloor2', side: 'cliffCave', rock: true, cave: true },
  '~': { kind: 'water' },
  'b': { kind: 'bridge', walk: true },
};

export const THEMES = {
  town: { sky: ['#5aa6f0', '#ffe6c0'], fog: ['#dbe8f0', 24, 62], hemi: ['#d6e8ff', '#6a7a50', 1.05], sun: ['#fff0d0', 2.9], sunDir: [-8, 14, 7], motes: 'pollen', ground: 'grass', clouds: true, mountains: 0x7a9cb8, rays: 0xfff0c0 },
  field: { sky: ['#4a9cf0', '#fff2d4'], fog: ['#dceaf2', 22, 58], hemi: ['#d6e8ff', '#6a7a50', 1.05], sun: ['#fff4e0', 2.9], sunDir: [-9, 14, 5], motes: 'pollen', ground: 'grass', clouds: true, mountains: 0x7aa0bc, rays: 0xfff0c0 },
  forest: { sky: ['#24503e', '#b0d8a8'], fog: ['#5a8a6c', 14, 40], hemi: ['#b4e0bc', '#24402a', 0.85], sun: ['#ffe8b0', 2.2], sunDir: [-6, 14, 3], motes: 'firefly', ground: 'leavesDark', treeRing: true, rays: 0xe8ffc0 },
  cave: { sky: ['#06061a', '#1c2450'], fog: ['#10142e', 14, 38], hemi: ['#b8b8e8', '#282040', 1.1], sun: ['#c8d0ff', 1.3], sunDir: [-4, 14, 6], motes: 'crystal', ground: 'caveRock', stalactites: true },
  boss: { sky: ['#10041c', '#46184a'], fog: ['#1e0a2a', 15, 40], hemi: ['#c8a0f0', '#301030', 1.15], sun: ['#e8b8ff', 1.6], sunDir: [-4, 14, 6], motes: 'ember', ground: 'caveRock', stalactites: true },
  world: { sky: ['#3e94f0', '#fff0d0'], fog: ['#d4e6f4', 34, 85], hemi: ['#d6e8ff', '#6a7a50', 1.1], sun: ['#fff0d0', 2.7], sunDir: [-9, 16, 8], motes: 'pollen', ground: 'grass', clouds: true, mountains: 0x8aaac4 },
};

// ── 가림 처리 (플레이어 앞 가리는 물체를 화면 공간 원형 디더링으로 투과) ──
export const OCCLUSION = { uOccPos: { value: new THREE.Vector2() }, uOccDepth: { value: 0 }, uOccR: { value: 0 } };
const OCC_FRAG = `
      if (uOccR > 0.0) { vec2 od = gl_FragCoord.xy - uOccPos; float dd = dot(od, od);
        if (gl_FragCoord.z < uOccDepth && dd < uOccR * uOccR) { float b = mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0); if (b < 1.0 || dd < uOccR * uOccR * 0.45) discard; } }`;

// 공용 시간 유니폼 (풀/나무 흔들림)
export const WIND = { uTime: { value: 0 } };

// onBeforeCompile 조합: occl(가림), sway(흔들림 세기)
function patch(mat, { occl = false, sway = 0, swayMode = 'height' } = {}) {
  if (!occl && !sway) return mat;
  mat.onBeforeCompile = sh => {
    if (occl) {
      Object.assign(sh.uniforms, OCCLUSION);
      sh.fragmentShader = 'uniform vec2 uOccPos; uniform float uOccDepth; uniform float uOccR;\n' + sh.fragmentShader.replace('void main() {', 'void main() {' + OCC_FRAG);
    }
    if (sway) {
      Object.assign(sh.uniforms, WIND);
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = instanceMatrix[3].xyz;
        #else
          vec3 ip = vec3(0.0);
        #endif
        float swK = ${swayMode === 'uv' ? 'uv.y' : 'max(0.0, position.y)'};
        float sw = sin(uTime * 1.7 + ip.x * 0.9 + ip.z * 0.6) + 0.4 * sin(uTime * 3.1 + ip.x * 2.0);
        transformed.x += sw * ${sway.toFixed(3)} * swK;
        transformed.z += cos(uTime * 1.3 + ip.z) * ${(sway * 0.4).toFixed(3)} * swK;`);
    }
  };
  mat.customProgramCacheKey = () => `p${occl}${sway}${swayMode}`;
  return mat;
}

const texCache = new Map();
function tex(name, { repeat = true, nearest = true } = {}) {
  const key = name + repeat + nearest;
  if (texCache.has(key)) return texCache.get(key);
  const t = new THREE.CanvasTexture(textureCanvas(name, 0));
  t.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
  t.minFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  texCache.set(key, t);
  return t;
}
const matCache = new Map();
function texMat(name, opts = {}) {
  const key = name + JSON.stringify(opts);
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshLambertMaterial({ map: tex(name), ...(opts.mat || {}) });
  if (opts.repeat) { m.map = tex(name).clone(); m.map.needsUpdate = true; m.map.repeat.set(opts.repeat[0], opts.repeat[1]); }
  patch(m, opts);
  matCache.set(key, m);
  return m;
}

function gradientTexture(top, bottom) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d').createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, top); g.addColorStop(0.75, bottom); g.addColorStop(1, bottom);
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

function cloudTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const x = c.getContext('2d');
  const blobs = [];
  for (let i = 0; i < 14; i++) blobs.push([40 + Math.random() * 176, 60 + Math.random() * 30 - (i % 3) * 8, 18 + Math.random() * 26]);
  for (const [bx, by, r] of blobs) { x.fillStyle = 'rgba(190,200,225,1)'; x.beginPath(); x.arc(bx, by + 6, r, 0, 7); x.fill(); }
  for (const [bx, by, r] of blobs) { x.fillStyle = 'rgba(255,255,255,1)'; x.beginPath(); x.arc(bx - 2, by - 2, r * 0.92, 0, 7); x.fill(); }
  x.globalCompositeOperation = 'destination-in';
  const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.85, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function rayTexture() {
  const c = document.createElement('canvas'); c.width = 32; c.height = 128;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 32, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 32, 128);
  x.globalCompositeOperation = 'destination-in';
  const v = x.createLinearGradient(0, 0, 0, 128); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.3, 'rgba(0,0,0,1)'); v.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = v; x.fillRect(0, 0, 32, 128);
  return new THREE.CanvasTexture(c);
}

// ── 테마: 조명/하늘/안개/배경/부유 입자 ──
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
  const s = size * 0.72;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 70 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
  scene.add(sun); scene.add(sun.target);
  const baseCol = { grass: 0x2e5428, leavesDark: 0x1c3422, caveRock: 0x120e1e }[th.ground] ?? 0x303040;
  const base = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: baseCol }));
  base.rotation.x = -Math.PI / 2; base.position.y = BASE_Y - 0.02; base.receiveShadow = true;
  scene.add(base);
  const updaters = [];
  const motes = makeMotes(th.motes, size);
  scene.add(motes.points); updaters.push(motes.update);
  // 구름
  if (th.clouds) {
    const ct = cloudTexture();
    const clouds = [];
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, fog: false, transparent: true, opacity: 0.92, depthWrite: false }));
      const a = Math.random() * Math.PI * 2, r = 70 + Math.random() * 40;
      m.position.set(Math.cos(a) * r, 22 + Math.random() * 14, Math.sin(a) * r - 30);
      const sc = 26 + Math.random() * 22; m.scale.set(sc, sc / 2, 1);
      scene.add(m); clouds.push(m);
    }
    updaters.push(t => { for (const c of clouds) { c.position.x += 0.012; if (c.position.x > 120) c.position.x = -120; } });
  }
  // 먼 산
  if (th.mountains) {
    const mm = new THREE.MeshLambertMaterial({ color: th.mountains, flatShading: true });
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * Math.PI * 2 + Math.random() * 0.2, r = 58 + Math.random() * 18;
      const h = 9 + Math.random() * 14;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(9 + Math.random() * 7, h, 5 + (i % 3)), mm);
      cone.position.set(Math.cos(a) * r, BASE_Y + h / 2 - 1, Math.sin(a) * r);
      cone.rotation.y = Math.random() * 3;
      scene.add(cone);
    }
  }
  // 숲 외곽 나무 실루엣
  if (th.treeRing) {
    const geo = new THREE.ConeGeometry(1.6, 6, 7); geo.translate(0, 3, 0);
    const n = 70;
    const im = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0x1e4030, flatShading: true }), n);
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = size * 0.75 + 4 + Math.random() * 14;
      m.compose(new THREE.Vector3(Math.cos(a) * r, BASE_Y, Math.sin(a) * r), new THREE.Quaternion(), new THREE.Vector3(1, 0.8 + Math.random() * 0.8, 1).multiplyScalar(0.8 + Math.random() * 0.7));
      im.setMatrixAt(i, m);
    }
    scene.add(im);
  }
  // 동굴 종유석
  if (th.stalactites) {
    const geo = new THREE.ConeGeometry(0.6, 4, 6); geo.rotateX(Math.PI); geo.translate(0, -2, 0);
    const n = 46;
    const im = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: themeName === 'boss' ? 0x2a1438 : 0x22203a, flatShading: true }), n);
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = size * 0.45 + Math.random() * size * 0.6;
      m.compose(new THREE.Vector3(Math.cos(a) * r, 9 + Math.random() * 3, Math.sin(a) * r - 4), new THREE.Quaternion(), new THREE.Vector3(1, 0.6 + Math.random() * 1.2, 1).multiplyScalar(0.6 + Math.random()));
      im.setMatrixAt(i, m);
    }
    scene.add(im);
  }
  // 빛줄기
  if (th.rays) {
    const rt = rayTexture();
    const rays = [];
    for (let i = 0; i < 6; i++) {
      const mat = new THREE.MeshBasicMaterial({ map: rt, color: th.rays, transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1.6 + Math.random() * 2.2, 18), mat);
      p.position.set((Math.random() - 0.5) * size * 0.9, 4, (Math.random() - 0.5) * size * 0.6);
      p.lookAt(p.position.clone().add(new THREE.Vector3(...th.sunDir)));
      p.rotateX(Math.PI / 2); p.rotateY(Math.random());
      scene.add(p); rays.push({ mat, ph: Math.random() * 6 });
    }
    updaters.push(t => { for (const r of rays) r.mat.opacity = 0.06 + Math.sin(t * 0.5 + r.ph) * 0.04; });
  }
  return { hemi, sun, motes: { update(t) { WIND.uTime.value = t; for (const u of updaters) u(t); } }, theme: th };
}

function makeMotes(kind, size) {
  const n = kind === 'firefly' ? 70 : 100;
  const pos = new Float32Array(n * 3), seed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (Math.random() - 0.5) * size; pos[i * 3 + 1] = Math.random() * 4 + 0.2; pos[i * 3 + 2] = (Math.random() - 0.5) * size;
    seed[i] = Math.random() * 100;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const col = { pollen: 0xfff6c0, firefly: 0xc8ff70, crystal: 0x90f0ff, ember: 0xff80d0 }[kind] || 0xffffff;
  const mat = new THREE.PointsMaterial({ color: col, size: kind === 'firefly' ? 0.22 : 0.11, map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9, fog: false });
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

function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }

// ─────────────────────────────────────────────────────────────
//  지면 스플랫 재질 (풀/흙/모래/꽃을 도트 경계로 섞음)
// ─────────────────────────────────────────────────────────────
let noiseTex = null;
function getNoiseTex() {
  if (noiseTex) return noiseTex;
  const S = 64, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d'), img = x.createImageData(S, S);
  const g = 8, v = []; for (let i = 0; i < g * g; i++) v.push(Math.random());
  const at = (i, j) => v[((j + g) % g) * g + ((i + g) % g)];
  const sm = t => t * t * (3 - 2 * t);
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
    const fx = xx / (S / g), fy = y / (S / g), i = Math.floor(fx), j = Math.floor(fy), u = sm(fx - i), w = sm(fy - j);
    const a = at(i, j) + (at(i + 1, j) - at(i, j)) * u, b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * u;
    const val = (a + (b - a) * w) * 0.75 + Math.random() * 0.25;
    const o = (y * S + xx) * 4; img.data[o] = img.data[o + 1] = img.data[o + 2] = val * 255; img.data[o + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  noiseTex = new THREE.CanvasTexture(c); noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping;
  return noiseTex;
}

function groundMaterial(maskTex, W, H, dark) {
  const m = new THREE.MeshLambertMaterial({ map: tex(dark ? 'g_moss' : 'g_grass'), vertexColors: true });
  const uni = {
    tDirt: { value: tex('g_dirt') }, tSand: { value: tex('g_sand') }, tFlower: { value: tex('g_flower') },
    tMask: { value: maskTex }, tNoise: { value: getNoiseTex() }, mapSize: { value: new THREE.Vector2(W, H) },
  };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, uni);
    sh.fragmentShader = 'uniform sampler2D tDirt, tSand, tFlower, tMask, tNoise; uniform vec2 mapSize;\n' + sh.fragmentShader.replace('#include <map_fragment>', `
      vec2 tuv = vMapUv;
      vec2 mc = tuv * 2.0;
      vec2 q = (floor(mc * 16.0) + 0.5) / 16.0;
      vec4 mk = texture2D(tMask, q / mapSize);
      float nz = texture2D(tNoise, q * 0.22).r - 0.5;
      float nz2 = texture2D(tNoise, q * 0.9 + 0.37).r - 0.5;
      float dirtV = mk.r + nz * 0.5 + nz2 * 0.18;
      float dirt = step(0.5, dirtV);
      float edge = step(0.4, dirtV) - dirt;
      float sand = step(0.5, mk.g + nz * 0.5 + nz2 * 0.18);
      float flw = step(0.52, mk.b + nz * 0.6);
      // 반복 무늬 깨기: 저주파 노이즈로 뒤집힌/어긋난 샘플과 섞고 밝기 변화
      float low = texture2D(tNoise, q * 0.045 + 0.13).r;
      vec4 c = mix(texture2D(map, tuv), texture2D(map, vec2(-tuv.y, tuv.x) + 0.37), step(0.5, texture2D(tNoise, q * 0.11 + 0.71).r));
      c.rgb *= 0.88 + low * 0.24;
      c = mix(c, texture2D(tFlower, tuv), flw);
      c.rgb *= 1.0 - edge * 0.22;
      c = mix(c, texture2D(tSand, tuv), sand);
      c = mix(c, texture2D(tDirt, tuv), dirt);
      diffuseColor *= c;`);
  };
  m.customProgramCacheKey = () => 'ground' + (dark ? 'd' : '');
  return m;
}

let waterMat = null;
function getWaterMaterial() {
  if (waterMat) return waterMat;
  // 애니메이션 노멀맵 (노이즈 기반)
  const S = 64, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d'), img = x.createImageData(S, S);
  const h = (i, j) => Math.sin(i * 0.39) * Math.cos(j * 0.27) + Math.sin((i + j) * 0.2) * 0.6 + Math.cos(i * 0.12 - j * 0.31) * 0.5;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const dx = h(i + 1, j) - h(i - 1, j), dy = h(i, j + 1) - h(i, j - 1);
    const o = (j * S + i) * 4; img.data[o] = 128 + dx * 60; img.data[o + 1] = 128 + dy * 60; img.data[o + 2] = 255; img.data[o + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const nt = new THREE.CanvasTexture(c); nt.wrapS = nt.wrapT = THREE.RepeatWrapping; nt.repeat.set(0.3, 0.3);
  waterMat = new THREE.MeshStandardMaterial({ color: 0x2f7fc8, roughness: 0.12, metalness: 0.0, transparent: true, opacity: 0.78, normalMap: nt, normalScale: new THREE.Vector2(0.5, 0.5), emissive: 0x0a2c5a, emissiveIntensity: 0.4 });
  return waterMat;
}

// ─────────────────────────────────────────────────────────────
//  맵 빌드
//  map = { rows, heights?, objects }
// ─────────────────────────────────────────────────────────────
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();

export function buildDiorama(map, opts = {}) {
  const rows = map.rows;
  const H = rows.length, W = Math.max(...rows.map(r => r.length));
  const group = new THREE.Group();
  const ox = -W / 2 + 0.5, oz = -H / 2 + 0.5;
  const tileAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? null : TILES[rows[y][x]] || null;
  const level = (x, y) => { if (!map.heights) return 0; const c = map.heights[y]?.[x]; return c && c >= '0' && c <= '9' ? +c : 0; };
  const dark = opts.dark ?? (map.theme === 'forest');
  const lowSpec = matchMedia('(pointer: coarse)').matches;

  // 각 타일의 위면 높이
  const topY = (x, y) => {
    const t = tileAt(x, y); if (!t) return BASE_Y;
    const g = level(x, y) * LV;
    if (t.kind === 'wall') return g + t.h;
    if (t.kind === 'water' || t.kind === 'bridge') return g - 0.5;
    return g;
  };
  // 캐릭터가 서는 높이
  const standY = (x, y) => {
    const t = tileAt(x, y); if (!t) return 0;
    const g = level(x, y) * LV;
    if (t.kind === 'stairs') return g + LV * 0.5;
    if (t.kind === 'bridge') return g + 0.08;
    return g;
  };
  const toWorld = (x, y) => new THREE.Vector3(x + ox, standY(x, y), y + oz);
  const blocked = new Set();
  const updaters = [];
  const lights = [];
  const pickables = [];

  // ── 1) 지형 메시 (재질별 버퍼 누적) ──
  const bufs = new Map();
  const B = key => { if (!bufs.has(key)) bufs.set(key, { pos: [], nrm: [], uv: [], col: [], idx: [] }); return bufs.get(key); };
  const isRegular = t => t && (t.kind === 'floor' && !t.cave || t.kind === 'stairs' || t.kind === 'bridge');
  // 모서리 흔들림: 규칙 무늬 바닥이 닿지 않는 자연 지형 모서리만
  const jitter = (cx, cy) => {
    for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) { const t = tileAt(cx + dx, cy + dy); if (isRegular(t) || (t && t.kind === 'wall' && !t.rough)) return [0, 0]; }
    const a = 0.16;
    return [(hash(cx * 1.3, cy * 0.7) - 0.5) * a * 2, (hash(cx * 0.9 + 5, cy * 1.7) - 0.5) * a * 2];
  };
  const roughY = (cx, cy, y, t) => (t && t.rough && t.kind === 'wall') ? y + (hash(cx + 11, cy * 3) - 0.5) * 0.35 : y;
  const corner = (cx, cy, y) => { const [jx, jz] = jitter(cx, cy); return [cx - W / 2 + jx, y, cy - H / 2 + jz]; };
  // AO: 모서리 주변에 더 높은 타일이 있으면 어둡게
  const aoTop = (cx, cy, y) => {
    let k = 1;
    for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) { const ty = topY(cx + dx, cy + dy); if (ty > y + 0.25) k = Math.min(k, 0.58); }
    return k;
  };
  const pushQuad = (b, v, n, uvs, cols) => {
    const base = b.pos.length / 3;
    for (let i = 0; i < 4; i++) { b.pos.push(...v[i]); b.nrm.push(...n); b.uv.push(...uvs[i]); b.col.push(cols[i], cols[i], cols[i]); }
    b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };

  const mask = new Uint8Array(W * H * 4);
  const waters = [], stairs = [], bridges = [];
  const trees = [], rocks = [], crystals = [], fences = [], bushes = [], grassTiles = [];

  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = tileAt(x, y);
    if (!t) continue;
    if (!t.walk) blocked.add(x + ',' + y);
    const mi = (y * W + x) * 4;
    if (t.kind === 'ground') {
      mask[mi] = t.mask === 'dirt' ? 255 : 0; mask[mi + 1] = t.mask === 'sand' ? 255 : 0; mask[mi + 2] = t.mask === 'flower' ? 255 : 0;
    } else if (t.kind === 'water' || t.kind === 'bridge') mask[mi + 1] = 200;
    mask[mi + 3] = 255;
    if (t.tree) trees.push([x, y, t.tree]);
    if (t.rock) rocks.push([x, y, !!t.cave]);
    if (t.crystal) crystals.push([x, y]);
    if (t.fence) fences.push([x, y]);
    if (t.bush) bushes.push([x, y]);
    if (t.kind === 'water') waters.push([x, y]);
    if (t.kind === 'bridge') { waters.push([x, y]); bridges.push([x, y]); }
    if (t.kind === 'stairs') stairs.push([x, y]);
    if (t.grassy || (t.kind === 'ground' && t.mask === 'grass')) grassTiles.push([x, y, t]);

    const top = topY(x, y);
    // 위면
    if (t.kind !== 'stairs') {
      const key = (t.kind === 'ground') ? 'ground' : (t.kind === 'water' || t.kind === 'bridge') ? 'top:g_bed' : 'top:' + t.top + (t.kind === 'wall' ? ':w' : '');
      const cs = [[x, y], [x, y + 1], [x + 1, y + 1], [x + 1, y]];
      const v = cs.map(([cx, cy]) => corner(cx, cy, roughY(cx, cy, top, t)));
      const uvs = cs.map(([cx, cy]) => [cx / 2, cy / 2]);
      const cols = cs.map(([cx, cy]) => aoTop(cx, cy, top));
      pushQuad(B(key), v, [0, 1, 0], uvs, cols);
    }
    // 옆면 (이웃이 더 낮을 때)
    const sideKey = t.kind === 'ground' ? (t.mask === 'sand' ? 'side:cliffSand' : 'side:cliff') : (t.kind === 'water' || t.kind === 'bridge') ? 'side:cliff' : 'side:' + (t.side || 'cliff') + (t.kind === 'wall' ? ':w' : '');
    const selfTop = t.kind === 'stairs' ? level(x, y) * LV : top;
    for (const [dx, dy, nx, nz] of [[0, -1, 0, -1], [0, 1, 0, 1], [-1, 0, -1, 0], [1, 0, 1, 0]]) {
      const nt = tileAt(x + dx, y + dy);
      let ny = nt ? (nt.kind === 'stairs' ? level(x + dx, y + dy) * LV : topY(x + dx, y + dy)) : BASE_Y;
      if (ny >= selfTop - 0.001) continue;
      // 변의 두 모서리
      let c0, c1;
      if (dy === -1) { c0 = [x + 1, y]; c1 = [x, y]; }
      else if (dy === 1) { c0 = [x, y + 1]; c1 = [x + 1, y + 1]; }
      else if (dx === -1) { c0 = [x, y]; c1 = [x, y + 1]; }
      else { c0 = [x + 1, y + 1]; c1 = [x + 1, y]; }
      const y0 = Math.max(ny, BASE_Y);
      const t0 = roughY(c0[0], c0[1], selfTop, t), t1 = roughY(c1[0], c1[1], selfTop, t);
      const v = [corner(c0[0], c0[1], t0), corner(c0[0], c0[1], y0), corner(c1[0], c1[1], y0), corner(c1[0], c1[1], t1)];
      const along0 = dy !== 0 ? c0[0] : c0[1], along1 = dy !== 0 ? c1[0] : c1[1];
      const uvs = [[along0 / 2, 1], [along0 / 2, 1 - (t0 - y0) / 2], [along1 / 2, 1 - (t1 - y0) / 2], [along1 / 2, 1]];
      const deep = ny <= BASE_Y + 0.01;
      pushQuad(B(sideKey), v, [nx, 0, nz], uvs, [1, deep ? 0.5 : 0.6, deep ? 0.5 : 0.6, 1]);
    }
  }

  const maskTex = new THREE.DataTexture(mask, W, H, THREE.RGBAFormat);
  maskTex.magFilter = maskTex.minFilter = THREE.LinearFilter; maskTex.needsUpdate = true;
  // 마스크 세로축은 UV(-y)와 맞춘다
  maskTex.flipY = false;

  for (const [key, b] of bufs) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.nrm, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
    geo.setIndex(b.idx);
    let mat;
    if (key === 'ground') mat = groundMaterial(maskTex, W, H, dark);
    else {
      const [kind, name, w] = key.split(':');
      mat = new THREE.MeshLambertMaterial({ map: tex(name), vertexColors: true });
      patch(mat, { occl: kind === 'side' || w === 'w' });
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true; mesh.castShadow = key.startsWith('side') || key.endsWith(':w');
    group.add(mesh);
    pickables.push(mesh);
  }

  // ── 2) 계단 ──
  if (stairs.length) {
    const stepMat = new THREE.MeshLambertMaterial({ map: tex('stoneFloor2') });
    for (const [x, y] of stairs) {
      const lv = level(x, y);
      let dir = [0, -1];
      for (const d of [[0, -1], [0, 1], [-1, 0], [1, 0]]) { const n = tileAt(x + d[0], y + d[1]); if (n && n.kind !== 'stairs' && level(x + d[0], y + d[1]) === lv + 1) dir = d; }
      const g = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const hgt = LV * (i + 1) / 4;
        const box = new THREE.Mesh(new THREE.BoxGeometry(1, hgt + 0.02, 0.25), stepMat);
        box.position.set(0, lv * LV + hgt / 2 - 0.01, -0.375 + i * 0.25);
        box.castShadow = true; box.receiveShadow = true; g.add(box);
      }
      g.position.set(x + ox, 0, y + oz);
      g.rotation.y = dir[1] === -1 ? Math.PI : dir[1] === 1 ? 0 : dir[0] === -1 ? -Math.PI / 2 : Math.PI / 2;
      group.add(g);
    }
  }

  // ── 3) 물 + 다리 ──
  if (waters.length) {
    const wm = getWaterMaterial();
    const geo = new THREE.PlaneGeometry(1.02, 1.02); geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.InstancedMesh(geo, wm, waters.length);
    waters.forEach(([x, y], i) => { _m.makeTranslation(x + ox, level(x, y) * LV - 0.14, y + oz); mesh.setMatrixAt(i, _m); });
    mesh.receiveShadow = true;
    group.add(mesh);
    updaters.push(t => { wm.normalMap.offset.set(t * 0.02, t * 0.013); });
    // 반짝임
    const sp = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    const n = Math.min(200, waters.length * 2), pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const [x, y] = waters[i % waters.length]; pos[i * 3] = x + ox + Math.random() - 0.5; pos[i * 3 + 1] = level(x, y) * LV - 0.1; pos[i * 3 + 2] = y + oz + Math.random() - 0.5; }
    sp.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    group.add(sp);
    updaters.push(t => { sp.material.opacity = 0.4 + Math.sin(t * 5) * 0.35; });
  }
  for (const [x, y] of bridges) {
    const g = makeBridge(tileAt(x - 1, y)?.kind === 'water' || tileAt(x + 1, y)?.kind === 'water' ? 'z' : 'x');
    g.position.copy(toWorld(x, y)).setY(level(x, y) * LV);
    group.add(g);
  }

  // ── 4) 풀 포기 / 꽃 ──
  {
    const per = lowSpec ? 1 : (opts.grass ?? 2);
    const list = [], flowers = [];
    for (const [x, y, t] of grassTiles) {
      if (t.tree || t.rock || t.bush) continue;
      for (let i = 0; i < per; i++) {
        const r1 = hash(x * 3 + i, y * 7), r2 = hash(y * 5 + i * 3, x * 2 + 1);
        const p = [x + ox + (r1 - 0.5) * 0.9, standY(x, y), y + oz + (r2 - 0.5) * 0.9];
        (t.mask === 'flower' && i % 2 === 0 ? flowers : list).push([p, hash(x + i, y + 9)]);
      }
    }
    const mk = (arr, texName, h = 0.3) => {
      if (!arr.length) return;
      const geo = new THREE.BufferGeometry();
      const parts = [];
      for (let k = 0; k < 3; k++) { const pg = new THREE.PlaneGeometry(0.36, h); pg.translate(0, h / 2, 0); pg.rotateY(k * Math.PI / 3); parts.push(pg); }
      const merged = mergeGeos(parts);
      const nrm = merged.attributes.normal; for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);
      const mat = new THREE.MeshLambertMaterial({ map: tex(texName, { repeat: false }), alphaTest: 0.5, side: THREE.DoubleSide });
      patch(mat, { sway: 0.07, swayMode: 'uv' });
      const im = new THREE.InstancedMesh(merged, mat, arr.length);
      const col = new THREE.Color();
      arr.forEach(([p, r], i) => {
        _e.set(0, r * 6, 0); _q.setFromEuler(_e); _s.setScalar(0.6 + r * 0.45);
        _m.compose(_p.set(...p), _q, _s); im.setMatrixAt(i, _m);
        im.setColorAt(i, col.setScalar(0.85 + r * 0.3));
      });
      im.receiveShadow = true;
      group.add(im);
      void geo;
    };
    mk(list, dark ? 'tuftDark' : map.theme === 'cave' ? 'tuftCave' : 'tuft');
    mk(flowers, 'tuftFlower', 0.32);
  }

  // ── 5) 나무 ──
  const roundT = trees.filter(t => t[2] === 'round'), pineT = trees.filter(t => t[2] === 'pine');
  if (trees.length) {
    const trunkGeo = new THREE.CylinderGeometry(0.1, 0.19, 1.2, 7); trunkGeo.translate(0, 0.6, 0);
    const trunk = new THREE.InstancedMesh(trunkGeo, patch(new THREE.MeshLambertMaterial({ map: tex('barkTex') }), { occl: true }), trees.length);
    trees.forEach(([x, y, k], i) => {
      const r = hash(x, y);
      _s.set(1 + r * 0.3, 0.8 + r * 0.5 + (k === 'pine' ? 0.2 : 0), 1 + r * 0.3);
      _m.compose(_p.set(x + ox + (r - 0.5) * 0.25, standY(x, y), y + oz + (hash(y, x) - 0.5) * 0.25), _q.identity(), _s);
      trunk.setMatrixAt(i, _m);
    });
    trunk.castShadow = true; trunk.receiveShadow = true;
    group.add(trunk);
  }
  if (roundT.length) {
    const blob = new THREE.IcosahedronGeometry(0.5, 1);
    const mat = patch(new THREE.MeshLambertMaterial({ map: tex('leaves2'), flatShading: true }), { occl: true, sway: 0.03 });
    const parts = [[0, 1.75, 0, 1.15], [0.42, 1.45, 0.18, 0.85], [-0.4, 1.5, -0.12, 0.85], [0.1, 1.4, -0.42, 0.8], [-0.12, 1.35, 0.42, 0.78], [0.05, 2.2, 0.05, 0.75]];
    const im = new THREE.InstancedMesh(blob, mat, roundT.length * parts.length);
    const col = new THREE.Color();
    let k = 0;
    for (const [x, y] of roundT) {
      const r = hash(x, y), hs = 0.85 + r * 0.45;
      for (const [dx, dy, dz, sc] of parts) {
        _e.set(r * 3 + dx, r * 5 + dz, dy); _q.setFromEuler(_e);
        _s.setScalar(sc * (0.95 + r * 0.25));
        _m.compose(_p.set(x + ox + dx + (r - 0.5) * 0.25, standY(x, y) + dy * hs, y + oz + dz), _q, _s);
        im.setMatrixAt(k, _m); im.setColorAt(k, col.setScalar(0.88 + hash(k, r) * 0.24)); k++;
      }
    }
    im.castShadow = true; im.receiveShadow = true;
    group.add(im);
  }
  if (pineT.length) {
    const tiers = [[0.6, 0.85, 0.8], [0.47, 0.8, 1.25], [0.32, 0.72, 1.68]];
    const mat = patch(new THREE.MeshLambertMaterial({ map: tex('pineTex'), flatShading: true }), { occl: true, sway: 0.04 });
    for (const [rad, h, yy] of tiers) {
      const geo = new THREE.ConeGeometry(rad, h, 8); geo.translate(0, h / 2, 0);
      const im = new THREE.InstancedMesh(geo, mat, pineT.length);
      pineT.forEach(([x, y], i) => {
        const r = hash(x, y), hs = 0.9 + r * 0.45;
        _e.set(0, r * 4, 0); _q.setFromEuler(_e); _s.set(1, hs, 1).multiplyScalar(0.85 + r * 0.25);
        _m.compose(_p.set(x + ox + (r - 0.5) * 0.25, standY(x, y) + yy * hs * 0.82, y + oz + (hash(y, x) - 0.5) * 0.25), _q, _s);
        im.setMatrixAt(i, _m);
      });
      im.castShadow = true; im.receiveShadow = true;
      group.add(im);
    }
  }

  // ── 6) 바위 / 덤불 / 울타리 / 크리스탈 ──
  if (rocks.length) {
    const geo = new THREE.DodecahedronGeometry(0.42, 1);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); v.multiplyScalar(0.85 + hash(v.x * 9, v.y * 7 + v.z) * 0.3); p.setXYZ(i, v.x, v.y, v.z); }
    geo.computeVertexNormals();
    const im = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ map: tex(rocks[0][2] ? 'cliffCave' : 'stoneTop'), flatShading: true }), rocks.length * 2);
    let k = 0;
    rocks.forEach(([x, y]) => {
      const r = hash(x, y);
      _e.set(r, r * 4, 0); _q.setFromEuler(_e); _s.set(1.1 + r * 0.4, 0.75 + r * 0.35, 1);
      _m.compose(_p.set(x + ox, standY(x, y) + 0.15, y + oz), _q, _s); im.setMatrixAt(k++, _m);
      _s.setScalar(0.4 + r * 0.2); _m.compose(_p.set(x + ox + 0.35, standY(x, y) + 0.05, y + oz + 0.3), _q, _s); im.setMatrixAt(k++, _m);
    });
    im.castShadow = true; im.receiveShadow = true;
    group.add(im);
  }
  if (bushes.length) {
    const blob = new THREE.IcosahedronGeometry(0.32, 1);
    const im = new THREE.InstancedMesh(blob, patch(new THREE.MeshLambertMaterial({ map: tex('leaves2'), flatShading: true }), { sway: 0.03 }), bushes.length * 4);
    let k = 0;
    for (const [x, y] of bushes) for (let i = 0; i < 4; i++) {
      const r = hash(x * 3 + i, y);
      _s.setScalar(0.8 + r * 0.5); _m.compose(_p.set(x + ox + (r - 0.5) * 0.6, standY(x, y) + 0.2 + (i === 3 ? 0.18 : 0), y + oz + (hash(y, x + i) - 0.5) * 0.6), _q.identity(), _s);
      im.setMatrixAt(k++, _m);
    }
    im.castShadow = true; im.receiveShadow = true; group.add(im);
  }
  if (fences.length) {
    const post = new THREE.BoxGeometry(0.1, 0.62, 0.1); post.translate(0, 0.31, 0);
    const rail = new THREE.BoxGeometry(1.02, 0.07, 0.05);
    const pm = new THREE.InstancedMesh(post, texMat('planks2'), fences.length);
    const rm = new THREE.InstancedMesh(rail, texMat('planks2'), fences.length * 2);
    fences.forEach(([x, y], i) => {
      const horiz = tileAt(x - 1, y)?.fence || tileAt(x + 1, y)?.fence || !(tileAt(x, y - 1)?.fence || tileAt(x, y + 1)?.fence);
      const yy = standY(x, y);
      _m.makeTranslation(x + ox, yy, y + oz); pm.setMatrixAt(i, _m);
      _q.setFromEuler(_e.set(0, horiz ? 0 : Math.PI / 2, 0));
      for (let k = 0; k < 2; k++) { _m.compose(_p.set(x + ox, yy + 0.25 + k * 0.22, y + oz), _q, _s.set(1, 1, 1)); rm.setMatrixAt(i * 2 + k, _m); }
    });
    pm.castShadow = rm.castShadow = true;
    group.add(pm, rm);
  }
  for (const [x, y] of crystals) {
    const c = makeCrystal(hash(x, y), 1.1);
    c.position.copy(toWorld(x, y));
    group.add(c);
    updaters.push(t => { c.children.forEach((m, i) => { if (m.material.emissiveIntensity !== undefined) m.material.emissiveIntensity = 0.8 + Math.sin(t * 2 + x + i) * 0.25; }); });
  }

  // ── 7) 오브젝트 ──
  const smoke = [];
  for (const o of map.objects || []) {
    const at = (xx, yy) => toWorld(xx, yy);
    if (o.type === 'house') {
      const hg = makeHouse(o);
      const c = at(o.x + (o.w - 1) / 2, o.y + (o.d - 1) / 2);
      hg.position.set(c.x, level(o.x, o.y + o.d - 1) * LV, c.z);
      group.add(hg);
      if (hg.userData.chimney) smoke.push(hg.userData.chimney);
      for (let yy = o.y; yy < o.y + o.d; yy++) for (let xx = o.x; xx < o.x + o.w; xx++) blocked.add(xx + ',' + yy);
    } else if (o.type === 'lamp') {
      const l = makeLamp(o.color);
      l.group.position.copy(at(o.x, o.y));
      group.add(l.group); lights.push(l.light);
      blocked.add(o.x + ',' + o.y);
      updaters.push(t => { l.light.intensity = l.base * (0.9 + Math.sin(t * 7 + o.x) * 0.05 + Math.sin(t * 13) * 0.04); });
    } else if (o.type === 'well') {
      const w = makeWell(); w.position.copy(at(o.x, o.y)); group.add(w); blocked.add(o.x + ',' + o.y);
    } else if (o.type === 'bigCrystal') {
      const c = makeCrystal(0.5, 2.2, o.color || 0x7ef0ff);
      c.position.copy(at(o.x, o.y)); group.add(c);
      const pl = new THREE.PointLight(o.color || 0x7ef0ff, 6, 9, 1.6); pl.position.set(0, 1.5, 0); c.add(pl); lights.push(pl);
      blocked.add(o.x + ',' + o.y);
      updaters.push(t => { c.rotation.y = t * 0.3; pl.intensity = 5 + Math.sin(t * 2) * 1.5; });
    } else if (o.type === 'pointLight') {
      const pl = new THREE.PointLight(o.color || 0xffc080, o.intensity || 4, o.range || 7, 1.5);
      pl.position.copy(at(o.x, o.y)).add(new THREE.Vector3(0, o.h || 1.5, 0)); group.add(pl); lights.push(pl);
    } else if (o.type === 'signpost') {
      const s = makeSign(); s.position.copy(at(o.x, o.y)); group.add(s); blocked.add(o.x + ',' + o.y);
    } else if (o.type === 'prop') {
      const p = makeProp(o.kind, o);
      p.position.copy(at(o.x, o.y));
      if (o.rot) p.rotation.y = o.rot;
      group.add(p);
      if (!o.walk) blocked.add(o.x + ',' + o.y);
      if (p.userData.update) updaters.push(p.userData.update);
    }
  }
  if (smoke.length) {
    const sm = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xe8e8f0, size: 0.5, map: glowTexture(), transparent: true, opacity: 0.35, depthWrite: false }));
    const N = smoke.length * 10, pos = new Float32Array(N * 3), age = new Float32Array(N);
    for (let i = 0; i < N; i++) age[i] = Math.random() * 3;
    sm.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    group.add(sm);
    updaters.push((t, dt = 0.016) => {
      for (let i = 0; i < N; i++) {
        age[i] += 0.016; if (age[i] > 3) age[i] = 0;
        const c = smoke[i % smoke.length].getWorldPosition(_p);
        pos[i * 3] = c.x + age[i] * 0.35 + Math.sin(age[i] * 2 + i) * 0.1; pos[i * 3 + 1] = c.y + age[i] * 0.6; pos[i * 3 + 2] = c.z;
      }
      sm.geometry.attributes.position.needsUpdate = true;
    });
  }

  return {
    group, blocked, lights, W, H, ox, oz, toWorld, pickables, level, standY,
    tile: (x, y) => tileAt(x, y),
    walkable(x, y) { const t = tileAt(x, y); return !!t && !!t.walk && !blocked.has(x + ',' + y); },
    // 높이 규칙: 같은 높이이거나, 계단을 통해 1단계 차이
    canMove(x0, y0, x1, y1) {
      if (!this.walkable(x1, y1)) return false;
      const a = tileAt(x0, y0), b = tileAt(x1, y1);
      const la = level(x0, y0), lb = level(x1, y1);
      if (a?.kind === 'stairs' && b?.kind === 'stairs') return Math.abs(la - lb) <= 1;
      if (a?.kind === 'stairs') return lb === la || lb === la + 1;
      if (b?.kind === 'stairs') return la === lb || la === lb + 1;
      return la === lb;
    },
    update(t) { for (const u of updaters) u(t); },
  };
}

function mergeGeos(list) {
  const pos = [], nrm = [], uv = [], idx = [];
  let off = 0;
  for (const g of list) {
    const gi = g.index ? g.index.array : [...Array(g.attributes.position.count).keys()];
    pos.push(...g.attributes.position.array); nrm.push(...g.attributes.normal.array); uv.push(...g.attributes.uv.array);
    for (const i of gi) idx.push(i + off);
    off += g.attributes.position.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

export function makeCrystal(r = 0.5, scale = 1, color = 0x7ef0ff) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.15, metalness: 0.2, flatShading: true, transparent: true, opacity: 0.9 });
  const n = 4;
  for (let i = 0; i < n; i++) {
    const geo = new THREE.OctahedronGeometry(0.22, 0); geo.scale(0.7, 2.6, 0.7);
    const m = new THREE.Mesh(geo, mat.clone());
    const a = i / n * Math.PI * 2 + r * 6;
    const main = i === 0;
    m.position.set(main ? 0 : Math.cos(a) * 0.2, main ? 0.45 : 0.28, main ? 0 : Math.sin(a) * 0.2);
    m.rotation.set(main ? 0 : 0.5 * Math.cos(a), 0, main ? 0 : 0.5 * Math.sin(a));
    if (!main) m.scale.setScalar(0.55 + hash(i, r) * 0.25);
    m.castShadow = true;
    g.add(m);
  }
  g.scale.setScalar(scale);
  return g;
}

function prismGeometry(w, h, d) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(0, h); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
  geo.translate(0, 0, -d / 2);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + pos.getZ(i)) * 0.5, pos.getY(i) * 0.75);
  return geo;
}

function boxM(w, h, d, mat, x = 0, y = 0, z = 0, cast = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true;
  return m;
}

// 집 v2: 석조 기초, 회벽+목조 골조, 처마가 깊은 지붕, 용마루, 창틀/덧문/화분, 문틀과 계단, 굴뚝
export function makeHouse({ w = 3, d = 3, roof = 'roofRed', wallH = 1.7, sign = null, awning = null }) {
  const g = new THREE.Group();
  const occ = { occl: true };
  const plaster = texMat('plaster2', { ...occ, repeat: [Math.max(w, d) / 2, wallH / 2] });
  const wood = texMat('planks2', occ);
  const stone = texMat('stoneWall', occ);
  const dark = new THREE.MeshLambertMaterial({ color: 0x4a3020 });
  patch(dark, occ);
  g.add(boxM(w, 0.35, d, stone, 0, 0.175, 0));
  g.add(boxM(w - 0.16, wallH, d - 0.16, plaster, 0, 0.35 + wallH / 2, 0));
  // 기둥/보
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(boxM(0.14, wallH, 0.14, dark, sx * (w / 2 - 0.1), 0.35 + wallH / 2, sz * (d / 2 - 0.1)));
  for (const sz of [-1, 1]) g.add(boxM(w - 0.1, 0.12, 0.14, dark, 0, 0.35 + wallH - 0.06, sz * (d / 2 - 0.08)));
  g.add(boxM(w - 0.1, 0.1, 0.12, dark, 0, 0.35 + wallH * 0.48, d / 2 - 0.07));
  // 지붕
  const rmat = texMat(roof, { ...occ, repeat: [1, 1] });
  const roofM = new THREE.Mesh(prismGeometry(w + 0.7, 1.45, d + 0.5), rmat);
  roofM.position.y = 0.35 + wallH; roofM.rotation.y = Math.PI / 2; roofM.castShadow = true; roofM.receiveShadow = true;
  g.add(roofM);
  const ridge = boxM(0.16, 0.16, w + 0.8, dark, 0, 0.35 + wallH + 1.45, 0); ridge.rotation.y = Math.PI / 2; g.add(ridge);
  // 박공 삼각면 (회벽)
  // 굴뚝
  const ch = boxM(0.34, 1.1, 0.34, stone, w * 0.25, 0.35 + wallH + 0.9, -d * 0.18);
  g.add(ch);
  const chTop = new THREE.Object3D(); chTop.position.set(w * 0.25, 0.35 + wallH + 1.5, -d * 0.18); g.add(chTop);
  g.userData.chimney = chTop;
  // 문
  const fz = d / 2 - 0.06;
  g.add(boxM(0.82, 1.15, 0.08, dark, 0, 0.35 + 0.58, fz + 0.02));
  g.add(boxM(0.64, 1.02, 0.06, wood, 0, 0.35 + 0.52, fz + 0.05));
  const knob = boxM(0.06, 0.06, 0.04, new THREE.MeshStandardMaterial({ color: 0xeab84c, metalness: 0.8, roughness: 0.3 }), 0.2, 0.35 + 0.5, fz + 0.09, false); g.add(knob);
  g.add(boxM(0.9, 0.12, 0.3, stone, 0, 0.06, d / 2 + 0.12));
  // 창
  const glass = new THREE.MeshStandardMaterial({ color: 0xffe0a0, emissive: 0xffa040, emissiveIntensity: 1.1, roughness: 0.3 });
  const shutter = texMat('crate', occ);
  const flowerCols = [0xff7aa0, 0xffe070, 0xffffff, 0x8ab4ff];
  if (w >= 2.5) for (const sx of [-1, 1]) {
    const x = sx * w * 0.3;
    g.add(boxM(0.5, 0.5, 0.05, dark, x, 0.35 + 1.0, fz + 0.03));
    g.add(boxM(0.4, 0.4, 0.04, glass, x, 0.35 + 1.0, fz + 0.06, false));
    g.add(boxM(0.04, 0.4, 0.05, dark, x, 0.35 + 1.0, fz + 0.08, false));
    g.add(boxM(0.18, 0.5, 0.04, shutter, x - 0.36, 0.35 + 1.0, fz + 0.05));
    g.add(boxM(0.18, 0.5, 0.04, shutter, x + 0.36, 0.35 + 1.0, fz + 0.05));
    g.add(boxM(0.56, 0.14, 0.16, wood, x, 0.35 + 0.7, fz + 0.12));
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), new THREE.MeshLambertMaterial({ color: flowerCols[i] }));
      f.position.set(x - 0.18 + i * 0.12, 0.35 + 0.82, fz + 0.14); g.add(f);
    }
  }
  if (sign) {
    const arm = boxM(0.5, 0.05, 0.05, dark, -w * 0.32, 0.35 + 1.55, fz + 0.28); g.add(arm);
    const s = boxM(0.5, 0.36, 0.05, wood, -w * 0.32 - 0.05, 0.35 + 1.28, fz + 0.5); s.rotation.y = Math.PI / 2; g.add(s);
    const icon = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.26), new THREE.MeshBasicMaterial({ color: sign, toneMapped: false }));
    icon.position.set(-w * 0.32 - 0.02, 0.35 + 1.28, fz + 0.5); icon.rotation.y = Math.PI / 2; g.add(icon);
  }
  if (awning) {
    const c = document.createElement('canvas'); c.width = 16; c.height = 4;
    const x = c.getContext('2d'); for (let i = 0; i < 16; i++) { x.fillStyle = i % 4 < 2 ? awning : '#f8f0e0'; x.fillRect(i, 0, 1, 4); }
    const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
    const aw = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, 0.7), new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide }));
    aw.position.set(0, 0.35 + wallH - 0.15, d / 2 + 0.3); aw.rotation.x = -Math.PI / 2.8; aw.castShadow = true; g.add(aw);
  }
  return g;
}

export function makeLamp(color = 0xffc070) {
  const g = new THREE.Group();
  const iron = new THREE.MeshStandardMaterial({ color: 0x2c2838, metalness: 0.6, roughness: 0.5 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.07, 1.6, 8), iron); post.position.y = 0.8; post.castShadow = true; g.add(post);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.15, 8), iron); foot.position.y = 0.07; g.add(foot);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.04), iron); arm.position.set(0.15, 1.58, 0); g.add(arm);
  const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.28, 6, 1, true), iron); cage.position.set(0.3, 1.38, 0); g.add(cage);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 3 }));
  bulb.position.set(0.3, 1.38, 0); g.add(bulb);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.14, 6), iron); cap.position.set(0.3, 1.58, 0); g.add(cap);
  const light = new THREE.PointLight(color, 3.5, 6.5, 1.6); light.position.set(0.3, 1.35, 0); g.add(light);
  return { group: g, light, base: 3.5 };
}

function makeWell() {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.52, 0.55, 12, 1, true), texMat('stoneWall', { mat: { side: THREE.DoubleSide } }));
  ring.position.y = 0.27; ring.castShadow = true; g.add(ring);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 6, 14), texMat('stoneTop')); rim.rotation.x = Math.PI / 2; rim.position.y = 0.55; g.add(rim);
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.44, 14), getWaterMaterial());
  water.rotation.x = -Math.PI / 2; water.position.y = 0.32; g.add(water);
  for (const s of [-1, 1]) g.add(boxM(0.08, 1.2, 0.08, texMat('planks2'), s * 0.45, 0.6, 0));
  g.add(boxM(1.0, 0.06, 0.06, texMat('planks2'), 0, 1.0, 0));
  const roof = new THREE.Mesh(prismGeometry(1.35, 0.45, 0.9), texMat('roofBlue'));
  roof.position.y = 1.18; roof.castShadow = true; g.add(roof);
  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.15, 8), texMat('planks2')); bucket.position.set(0, 0.75, 0); g.add(bucket);
  return g;
}

function makeSign() {
  const g = new THREE.Group();
  g.add(boxM(0.08, 0.95, 0.08, texMat('planks2'), 0, 0.47, 0));
  const b = boxM(0.75, 0.3, 0.06, texMat('planks2'), 0.05, 0.82, 0); b.rotation.z = 0.06; g.add(b);
  const b2 = boxM(0.6, 0.24, 0.06, texMat('planks2'), -0.05, 0.52, 0.02); b2.rotation.z = -0.08; b2.rotation.y = 0.3; g.add(b2);
  return g;
}

function makeBridge(axis) {
  const g = new THREE.Group();
  const wood = texMat('planks2');
  const deck = boxM(1.02, 0.1, 0.9, wood, 0, 0.03, 0);
  g.add(deck);
  for (const s of [-1, 1]) {
    g.add(boxM(1.02, 0.07, 0.07, wood, 0, 0.45, s * 0.45));
    for (const px of [-0.45, 0.45]) g.add(boxM(0.08, 0.5, 0.08, wood, px, 0.22, s * 0.45));
  }
  if (axis === 'z') g.rotation.y = Math.PI / 2;
  return g;
}

// 소품 (o.kind): barrel crate sack pot bench cart banner hay woodpile stall bush stoneFence flowerbed
export function makeProp(kind, o = {}) {
  const g = new THREE.Group();
  const wood = texMat('planks2'), crate = texMat('crate');
  const iron = new THREE.MeshStandardMaterial({ color: 0x3a3440, metalness: 0.6, roughness: 0.5 });
  const cloth = c => new THREE.MeshLambertMaterial({ color: c });
  switch (kind) {
    case 'barrel': {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.62, 12), wood); b.position.y = 0.31; b.castShadow = true; g.add(b);
      const mid = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.3, 12), wood); mid.position.y = 0.31; g.add(mid);
      for (const y of [0.1, 0.52]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.285, 0.022, 4, 16), iron); r.rotation.x = Math.PI / 2; r.position.y = y; g.add(r); }
      break;
    }
    case 'crate': {
      g.add(boxM(0.55, 0.5, 0.55, crate, 0, 0.25, 0));
      if (o.stack) { const c2 = boxM(0.42, 0.38, 0.42, crate, 0.04, 0.69, -0.02); c2.rotation.y = 0.4; g.add(c2); }
      break;
    }
    case 'sack': {
      for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), cloth(0xd8c8a0)); s.scale.set(1, 0.8, 0.85); s.position.set(-0.2 + i * 0.22, 0.17 + (i === 1 ? 0.22 : 0), (i % 2) * 0.1); s.castShadow = true; g.add(s); }
      break;
    }
    case 'pot': {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.14, 0.3, 10), cloth(0xb0704a)); p.position.y = 0.15; p.castShadow = true; g.add(p);
      const cols = [0xff7aa0, 0xffe070, 0xffffff];
      for (let i = 0; i < 6; i++) { const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), cloth(i < 3 ? 0x4ea05c : cols[i % 3])); f.position.set(Math.cos(i) * 0.1, 0.36 + (i > 2 ? 0.08 : 0), Math.sin(i) * 0.1); g.add(f); }
      break;
    }
    case 'bench': {
      g.add(boxM(1.0, 0.08, 0.35, wood, 0, 0.36, 0));
      g.add(boxM(1.0, 0.3, 0.06, wood, 0, 0.6, -0.15));
      for (const x of [-0.42, 0.42]) g.add(boxM(0.07, 0.36, 0.3, wood, x, 0.18, 0));
      break;
    }
    case 'cart': {
      g.add(boxM(1.2, 0.35, 0.7, wood, 0, 0.55, 0));
      for (const x of [-0.4, 0.4]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 12), wood); w.rotation.x = Math.PI / 2; w.position.set(x, 0.3, 0.4); w.castShadow = true; g.add(w); }
      g.add(boxM(0.9, 0.06, 0.06, wood, 0.95, 0.45, 0));
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.5, 10), cloth(0xd8b850)); h.rotation.z = Math.PI / 2; h.position.set(-0.1, 0.9, 0); h.castShadow = true; g.add(h);
      break;
    }
    case 'banner': {
      g.add(boxM(0.08, 2.4, 0.08, iron, 0, 1.2, 0));
      g.add(boxM(0.7, 0.05, 0.05, iron, 0.3, 2.3, 0));
      const c = document.createElement('canvas'); c.width = 16; c.height = 32;
      const x = c.getContext('2d'); x.fillStyle = o.color || '#b4303c'; x.fillRect(0, 0, 16, 32);
      x.fillStyle = '#eab84c'; x.fillRect(0, 0, 16, 2); x.fillRect(0, 28, 16, 1);
      x.fillRect(7, 8, 2, 12); x.fillRect(4, 12, 8, 2); x.beginPath(); x.moveTo(8, 6); x.lineTo(11, 10); x.lineTo(5, 10); x.fill();
      x.clearRect(0, 30, 6, 2); x.clearRect(10, 30, 6, 2);
      const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
      const geo = new THREE.PlaneGeometry(0.55, 1.1, 1, 6); geo.translate(0, -0.55, 0);
      const mat = new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide, alphaTest: 0.5 });
      const flag = new THREE.Mesh(geo, mat); flag.position.set(0.35, 2.27, 0.02); flag.castShadow = true; g.add(flag);
      const p = geo.attributes.position, base = p.array.slice();
      g.userData.update = t2 => { for (let i = 0; i < p.count; i++) { const yy = base[i * 3 + 1]; p.setZ(i, Math.sin(t2 * 2.5 + yy * 3 + (o.x || 0)) * 0.08 * -yy); } p.needsUpdate = true; };
      break;
    }
    case 'hay': {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.42, 0.55, 12), cloth(0xd8b850)); h.rotation.z = Math.PI / 2; h.position.y = 0.42; h.castShadow = true; g.add(h);
      break;
    }
    case 'woodpile': {
      for (let i = 0; i < 6; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.8, 7), texMat('barkTex')); l.rotation.z = Math.PI / 2; l.position.set(0, 0.1 + Math.floor(i / 3) * 0.18, -0.2 + (i % 3) * 0.2 + (i >= 3 ? 0.1 : 0)); l.castShadow = true; g.add(l); }
      break;
    }
    case 'stall': {
      for (const [x, z] of [[-0.6, -0.35], [0.6, -0.35], [-0.6, 0.35], [0.6, 0.35]]) g.add(boxM(0.07, 1.5, 0.07, wood, x, 0.75, z));
      g.add(boxM(1.3, 0.1, 0.8, wood, 0, 0.75, 0));
      const c = document.createElement('canvas'); c.width = 16; c.height = 4;
      const x = c.getContext('2d'); for (let i = 0; i < 16; i++) { x.fillStyle = i % 4 < 2 ? (o.color || '#3c70cc') : '#f8f0e0'; x.fillRect(i, 0, 1, 4); }
      const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.06, 1.0), new THREE.MeshLambertMaterial({ map: t })); top.position.y = 1.52; top.rotation.x = 0.12; top.castShadow = true; g.add(top);
      const fruitCols = [0xe04a3a, 0xf0b040, 0x60b040];
      for (let i = 0; i < 9; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), cloth(fruitCols[i % 3])); f.position.set(-0.45 + (i % 5) * 0.22, 0.86, -0.15 + Math.floor(i / 5) * 0.25); g.add(f); }
      break;
    }
    case 'flowerbed': {
      g.add(boxM(0.95, 0.15, 0.95, texMat('stoneTop'), 0, 0.075, 0));
      const cols = [0xff7aa0, 0xffe070, 0xffffff, 0x8ab4ff, 0xff9050];
      for (let i = 0; i < 14; i++) { const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), cloth(i % 2 ? 0x4ea05c : cols[i % 5])); f.position.set((hash(i, 1) - 0.5) * 0.75, 0.2 + hash(i, 2) * 0.08, (hash(i, 3) - 0.5) * 0.75); g.add(f); }
      break;
    }
    case 'stoneFence': {
      g.add(boxM(1.0, 0.45, 0.35, texMat('stoneWall'), 0, 0.22, 0));
      break;
    }
    case 'pillar': {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 2.6, 10), texMat('stoneTop')); col.position.y = 1.3; col.castShadow = true; g.add(col);
      g.add(boxM(0.8, 0.2, 0.8, texMat('stoneTop'), 0, 0.1, 0));
      if (!o.broken) g.add(boxM(0.8, 0.2, 0.8, texMat('stoneTop'), 0, 2.65, 0));
      break;
    }
  }
  return g;
}

// ─────────────────────────────────────────────────────────────
//  전투 아레나 (뒤쪽이 높은 단차 + 테마별 장식)
// ─────────────────────────────────────────────────────────────
export function arenaMap(theme) {
  const W = 22, H = 14;
  const rows = [], heights = [];
  for (let y = 0; y < H; y++) {
    let r = '', h = '';
    for (let x = 0; x < W; x++) {
      const n = hash(x + 3, y + 7), n2 = hash(y * 3 + 1, x * 5);
      const back = y < 3, ledge = y === 3, sideHigh = (x < 3 || x > W - 4) && y < 7;
      const lv = back ? 4 + (n2 < 0.3 ? 1 : 0) : ledge ? (n < 0.5 ? 2 : 4) : sideHigh ? 2 : 0;
      h += lv;
      const stage = !back && !ledge && !sideHigh && y < H - 1;
      if (theme === 'cave' || theme === 'boss') {
        if (back) r += n < 0.25 ? 'C' : n < 0.5 ? 'x' : 'r';
        else if (sideHigh || ledge) r += n < 0.2 ? 'C' : n < 0.45 ? 'R' : 'r';
        else r += theme === 'boss' && Math.abs(x - W / 2 + 0.5) < 3 && Math.abs(y - 8) < 3 ? 'A' : n < 0.06 ? 'x' : 'r';
      } else if (theme === 'forest') {
        if (back || sideHigh) r += n < 0.55 ? 't' : n < 0.65 ? 'u' : n < 0.75 ? 'o' : '.';
        else if (ledge) r += n < 0.3 ? 'u' : '.';
        else r += stage && n < 0.22 ? ':' : n < 0.32 ? ',' : '.';
      } else {
        if (back || sideHigh) r += n < 0.45 ? 'T' : n < 0.55 ? 'u' : n < 0.62 ? 'o' : n < 0.8 ? ',' : '.';
        else if (ledge) r += n < 0.3 ? 'u' : ',';
        else r += stage && n < 0.2 ? ':' : n < 0.3 ? ',' : '.';
      }
    }
    rows.push(r); heights.push(h);
  }
  const objects = [];
  if (theme === 'cave') objects.push({ type: 'bigCrystal', x: 4, y: 1 }, { type: 'bigCrystal', x: 17, y: 2, color: 0xa080ff });
  if (theme === 'boss') objects.push({ type: 'bigCrystal', x: 5, y: 1, color: 0xe060ff }, { type: 'bigCrystal', x: 16, y: 1, color: 0x7ef0ff },
    { type: 'prop', kind: 'pillar', x: 6, y: 6 }, { type: 'prop', kind: 'pillar', x: 15, y: 6 }, { type: 'prop', kind: 'pillar', x: 4, y: 11, broken: true });
  if (theme === 'forest') objects.push({ type: 'pointLight', x: 11, y: 6, color: 0xc0ff90, intensity: 3, range: 12, h: 3 });
  if (theme === 'field') objects.push({ type: 'prop', kind: 'stoneFence', x: 2, y: 9, rot: 0.3 }, { type: 'prop', kind: 'hay', x: 19, y: 10 });
  return { rows, heights, objects, theme };
}
