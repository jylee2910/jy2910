// Height-field terrain with pixel-art splat texturing and automatic cliffs.
import * as THREE from 'three';
import { assets } from '../engine/assets.js';
import { fbm } from '../engine/noise.js';

export const TILE = 1.28; // metres per 64px texture tile (matches sprite density)

// layer order in the shader
export const LAYERS = ['grass', 'grass2', 'dirt', 'sand', 'cobble', 'forest', 'dirt_dark', 'castle_floor'];

export class Terrain {
  /**
   * @param {object} o
   *  width, depth, step   – size in metres and vertex spacing
   *  height(x,z)          – height function
   *  paint(x,z,h,slope)   – returns array of 8 weights (LAYERS)
   *  cliff                – texture name for steep faces
   */
  constructor(o) {
    this.o = o;
    const step = o.step ?? 0.5;
    const nx = Math.round(o.width / step) + 1;
    const nz = Math.round(o.depth / step) + 1;
    this.nx = nx;
    this.nz = nz;
    this.step = step;
    this.x0 = o.x0 ?? -o.width / 2;
    this.z0 = o.z0 ?? -o.depth / 2;
    const H = new Float32Array(nx * nz);
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) H[j * nx + i] = o.height(this.x0 + i * step, this.z0 + j * step);
    this.H = H;

    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(nx * nz * 3);
    const sa = new Float32Array(nx * nz * 4);
    const sb = new Float32Array(nx * nz * 4);
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        const x = this.x0 + i * step, z = this.z0 + j * step;
        pos[k * 3] = x;
        pos[k * 3 + 1] = H[k];
        pos[k * 3 + 2] = z;
        const sl = this.slopeAt(x, z);
        const w = o.paint(x, z, H[k], sl);
        for (let c = 0; c < 4; c++) {
          sa[k * 4 + c] = w[c] || 0;
          sb[k * 4 + c] = w[c + 4] || 0;
        }
      }
    // large-scale colour variation + cavity occlusion baked into vertex colour
    const col = new Float32Array(nx * nz * 3);
    const R = 6;
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        const x = this.x0 + i * step, z = this.z0 + j * step;
        let sum = 0, cnt = 0;
        for (let dj = -R; dj <= R; dj += 2)
          for (let di = -R; di <= R; di += 2) {
            const ii = Math.min(nx - 1, Math.max(0, i + di)), jj = Math.min(nz - 1, Math.max(0, j + dj));
            sum += H[jj * nx + ii];
            cnt++;
          }
        const cav = Math.min(1.08, Math.max(0.72, 1 + (H[k] - sum / cnt) * 0.22));
        const f = fbm(x * 0.03, z * 0.03, 77, 3);
        const g = fbm(x * 0.11, z * 0.11, 78, 2);
        const warm = Math.min(1, Math.max(0, (f - 0.35) * 2.2));
        const r = (0.92 + warm * 0.14) * (0.95 + g * 0.1);
        const gg = 0.98 + warm * 0.04;
        const b = 1.02 - warm * 0.12;
        col[k * 3] = r * cav;
        col[k * 3 + 1] = gg * cav;
        col[k * 3 + 2] = b * cav;
      }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const idx = [];
    for (let j = 0; j < nz - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    geo.setIndex(idx);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('splatA', new THREE.BufferAttribute(sa, 4));
    geo.setAttribute('splatB', new THREE.BufferAttribute(sb, 4));
    geo.computeVertexNormals();
    this.geo = geo;
    this.mesh = new THREE.Mesh(geo, makeTerrainMaterial(o.cliff ?? 'cliff', o.cliffTop ?? 0.42));
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true;
  }

  heightAt(x, z) {
    const fx = (x - this.x0) / this.step, fz = (z - this.z0) / this.step;
    const i = Math.max(0, Math.min(this.nx - 2, Math.floor(fx)));
    const j = Math.max(0, Math.min(this.nz - 2, Math.floor(fz)));
    const tx = Math.min(1, Math.max(0, fx - i)), tz = Math.min(1, Math.max(0, fz - j));
    const H = this.H, nx = this.nx;
    const a = H[j * nx + i], b = H[j * nx + i + 1], c = H[(j + 1) * nx + i], d = H[(j + 1) * nx + i + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  }

  slopeAt(x, z) {
    const e = this.step;
    const hx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
    const hz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    return Math.hypot(hx, hz) / (2 * e);
  }
}

export function makeTerrainMaterial(cliffName = 'cliff', cliffTop = 0.42) {
  const T = assets.tex;
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
  const uniforms = {
    tL0: { value: T[LAYERS[0]] }, tL1: { value: T[LAYERS[1]] }, tL2: { value: T[LAYERS[2]] }, tL3: { value: T[LAYERS[3]] },
    tL4: { value: T[LAYERS[4]] }, tL5: { value: T[LAYERS[5]] }, tL6: { value: T[LAYERS[6]] }, tL7: { value: T[LAYERS[7]] },
    tCliff: { value: T[cliffName] }, tNoise: { value: T.noise },
    uTile: { value: TILE }, uCliff: { value: cliffTop },
    uScale: { value: LAYERS.map((n) => 64 / (T[n]?.image?.width || 64)) },
    uCliffScale: { value: 64 / (T[cliffName]?.image?.width || 64) },
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec4 splatA; attribute vec4 splatB;
varying vec4 vSA; varying vec4 vSB; varying vec3 vWP; varying vec3 vWN;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vSA = splatA; vSB = splatB;
vWP = (modelMatrix * vec4(position, 1.0)).xyz;
vWN = normalize(mat3(modelMatrix) * normal);`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform sampler2D tL0, tL1, tL2, tL3, tL4, tL5, tL6, tL7, tCliff, tNoise;
uniform float uTile, uCliff; uniform float uScale[8]; uniform float uCliffScale;
varying vec4 vSA; varying vec4 vSB; varying vec3 vWP; varying vec3 vWN;`,
      )
      .replace(
        '#include <map_fragment>',
        `
  // pixel-quantised world position (1 texel = tile/64)
  float px = uTile / 64.0;
  vec3 qp = floor(vWP / px) * px + px * 0.5;
  vec2 uv = qp.xz / uTile;
  float n1 = texture2D(tNoise, qp.xz * 0.045).r;
  float n2 = texture2D(tNoise, qp.xz * 0.21).g;
  float jitter = (n1 - 0.5) * 0.55 + (n2 - 0.5) * 0.35;
  float w[8];
  w[0] = vSA.x; w[1] = vSA.y; w[2] = vSA.z; w[3] = vSA.w;
  w[4] = vSB.x; w[5] = vSB.y; w[6] = vSB.z; w[7] = vSB.w;
  int best = 0; float bw = -10.0;
  for (int i = 0; i < 8; i++) {
    float ww = w[i] + (w[i] > 0.02 ? jitter * (0.5 + 0.5 * float(i == 2 || i == 6)) : -1.0);
    if (ww > bw) { bw = ww; best = i; }
  }
  vec3 tc;
  if (best == 0) tc = texture2D(tL0, uv * uScale[0]).rgb;
  else if (best == 1) tc = texture2D(tL1, uv * uScale[1]).rgb;
  else if (best == 2) tc = texture2D(tL2, uv * uScale[2]).rgb;
  else if (best == 3) tc = texture2D(tL3, uv * uScale[3]).rgb;
  else if (best == 4) tc = texture2D(tL4, uv * uScale[4]).rgb;
  else if (best == 5) tc = texture2D(tL5, uv * uScale[5]).rgb;
  else if (best == 6) tc = texture2D(tL6, uv * uScale[6]).rgb;
  else tc = texture2D(tL7, uv * uScale[7]).rgb;
  // cliffs on steep faces, tri-planar on the dominant axis
  vec3 nn = normalize(vWN);
  float steep = 1.0 - nn.y;
  float cl = steep + (n2 - 0.5) * 0.12;
  if (cl > uCliff) {
    vec2 cuv = abs(nn.x) > abs(nn.z) ? qp.zy : qp.xy;
    vec3 cc = texture2D(tCliff, cuv / uTile * uCliffScale).rgb;
    // grass lip shading at the top edge of a cliff
    tc = cc;
  } else if (cl > uCliff - 0.06) {
    tc *= 0.72; // dark rim where grass rolls over the edge
  }
  diffuseColor.rgb *= tc;
`,
      );
  };
  mat.customProgramCacheKey = () => 'terrain-' + cliffName;
  return mat;
}
