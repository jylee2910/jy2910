// Instanced billboard props (trees, grass, rocks …) with wind sway.
import * as THREE from 'three';
import { assets } from '../engine/assets.js';
import { PX } from '../engine/sprite.js';

const shared = { time: { value: 0 } };
export function updatePropsTime(t) {
  shared.time.value = t;
}

function swayMaterial(tex, sway, emissive = 0.18) {
  const mat = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: emissive });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.time = shared.time;
    sh.uniforms.sway = { value: sway };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float time; uniform float sway;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
#ifdef USE_INSTANCING
  vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
#else
  vec3 ip = vec3(0.0);
#endif
  float hgt = max(0.0, uv.y - 0.25);
  transformed.x += sin(time * 1.6 + ip.x * 0.7 + ip.z * 0.5) * sway * hgt * hgt;`,
      );
  };
  mat.customProgramCacheKey = () => 'sway' + sway;
  return mat;
}

const SWAY = { tree: 0.12, pine: 0.06, bush: 0.05, grass: 0.12, flowers: 0.1 };
// HD-2D exaggerates foliage relative to characters
const SIZE = { tree: 1.75, pine: 1.75, bush: 1.45, grass: 1.5, flowers: 1.45, rock: 1.35, crystal: 1.5, windmill: 1.25, well: 1.25, fence: 1.35, sign: 1.4, barrel: 1.45, crate: 1.45, torch: 1.6, banner: 1.7 };
function sizeFor(name) {
  const k = Object.keys(SIZE).find((k) => name.startsWith(k));
  return k ? SIZE[k] : 1;
}

export class PropField {
  constructor() {
    this.group = new THREE.Group();
    this.types = {};
    this.colliders = [];
    this.lastYaw = null;
  }

  // queue a prop, built later in build()
  add(name, x, y, z, opts = {}) {
    if (!assets.props[name]) {
      console.warn('no prop', name);
      return;
    }
    (this.types[name] ||= []).push({ x, y, z, s: (opts.scale ?? 1) * (opts.raw ? 1 : sizeFor(name)), flip: opts.flip ?? Math.random() < 0.5 });
    if (opts.collide) this.colliders.push({ x, z, r: opts.collide });
  }

  build() {
    for (const [name, list] of Object.entries(this.types)) {
      const meta = assets.props[name];
      const tex = assets.propTex[name];
      const geo = new THREE.PlaneGeometry(meta.w * PX, meta.h * PX);
      // pivot at anchor (ground contact)
      geo.translate((meta.w / 2 - meta.ax) * PX, (meta.ay - meta.h / 2) * PX, 0);
      const n = geo.attributes.normal;
      for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 0.5, 0.86);
      const key = Object.keys(SWAY).find((k) => name.startsWith(k));
      const mat = swayMaterial(tex, key ? SWAY[key] : 0, name.startsWith('crystal') ? 0.4 : 0.18);
      const mesh = new THREE.InstancedMesh(geo, mat, list.length);
      const small = name.startsWith('grass') || name.startsWith('flowers');
      mesh.castShadow = !small;
      mesh.receiveShadow = true;
      mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5 });
      mesh.userData.list = list;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.types[name] = { mesh, list };
    }
  }

  update(camera) {
    const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    const yaw = e.y, pitch = e.x;
    if (this.lastYaw !== null && Math.abs(yaw - this.lastYaw) < 1e-4) return;
    this.lastYaw = yaw;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const eu = new THREE.Euler();
    for (const { mesh, list } of Object.values(this.types)) {
      list.forEach((it, i) => {
        eu.set(pitch * 0.3, yaw, 0, 'YXZ');
        q.setFromEuler(eu);
        s.set(it.flip ? -it.s : it.s, it.s, it.s);
        p.set(it.x, it.y, it.z);
        m.compose(p, q, s);
        mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  blocked(x, z, r = 0.3) {
    for (const c of this.colliders) if (Math.hypot(x - c.x, z - c.z) < c.r + r) return true;
    return false;
  }
}
