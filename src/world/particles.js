// Pixel particles (square points) – ambient motes, fireflies, leaves,
// sparkles, and burst emitters used by battle effects.
import * as THREE from 'three';

const VERT = /* glsl */ `
attribute float size; attribute vec4 color;
varying vec4 vColor;
uniform float pxScale;
void main(){
  vColor = color;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * pxScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */ `
varying vec4 vColor;
uniform float soft;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  float a = soft > 0.5 ? smoothstep(0.5, 0.0, r) : step(max(abs(d.x), abs(d.y)), 0.5);
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor.rgb, vColor.a * a);
}`;

export class ParticleSystem {
  constructor(max = 2000, { additive = true, soft = false } = {}) {
    this.max = max;
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.siz = new Float32Array(max);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4));
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.siz, 1));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { pxScale: { value: window.innerHeight * 0.9 }, soft: { value: soft ? 1 : 0 } },
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    this.parts = [];
    this.emitters = [];
  }

  spawn(p) {
    if (this.parts.length >= this.max) this.parts.shift();
    const q = {
      x: p.x, y: p.y, z: p.z,
      vx: p.vx || 0, vy: p.vy || 0, vz: p.vz || 0,
      ax: p.ax || 0, ay: p.ay ?? 0, az: p.az || 0,
      drag: p.drag ?? 0,
      life: p.life ?? 1, age: 0,
      size: p.size ?? 0.06, size1: p.size1 ?? p.size ?? 0.06,
      c0: p.color || [1, 1, 1, 1], c1: p.color1 || p.color || [1, 1, 1, 0],
      wobble: p.wobble || 0, ph: Math.random() * 6.28,
    };
    this.parts.push(q);
    return q;
  }

  burst(n, f) {
    for (let i = 0; i < n; i++) this.spawn(f(i));
  }

  addEmitter(e) {
    this.emitters.push({ acc: 0, ...e });
    return e;
  }

  update(dt) {
    for (const e of this.emitters) {
      if (e.active === false) continue;
      e.acc += dt * e.rate;
      while (e.acc >= 1) {
        e.acc -= 1;
        this.spawn(e.make());
      }
    }
    const P = this.parts;
    let w = 0;
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      p.age += dt;
      if (p.age >= p.life) continue;
      p.vx += p.ax * dt; p.vy += p.ay * dt; p.vz += p.az * dt;
      const dr = Math.max(0, 1 - p.drag * dt);
      p.vx *= dr; p.vy *= dr; p.vz *= dr;
      p.x += p.vx * dt + (p.wobble ? Math.sin(p.age * 2 + p.ph) * p.wobble * dt : 0);
      p.y += p.vy * dt;
      p.z += p.vz * dt + (p.wobble ? Math.cos(p.age * 1.7 + p.ph) * p.wobble * dt : 0);
      P[w++] = p;
    }
    P.length = w;
    const n = Math.min(P.length, this.max);
    for (let i = 0; i < n; i++) {
      const p = P[i];
      const t = p.age / p.life;
      this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
      for (let c = 0; c < 4; c++) this.col[i * 4 + c] = p.c0[c] + (p.c1[c] - p.c0[c]) * t;
      // fade in quickly
      this.col[i * 4 + 3] *= Math.min(1, t * 8);
      this.siz[i] = p.size + (p.size1 - p.size) * t;
    }
    this.geo.setDrawRange(0, n);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
    this.mat.uniforms.pxScale.value = window.innerHeight * 0.9;
  }

  clear() {
    this.parts.length = 0;
  }
}

// ambient presets -------------------------------------------------------------
export function ambientMotes(ps, center, area = 30, opts = {}) {
  const col = opts.color || [1, 0.95, 0.8, 0.55];
  return ps.addEmitter({
    rate: opts.rate ?? 12,
    make: () => ({
      x: center.x + (Math.random() - 0.5) * area,
      y: (opts.y0 ?? 0.3) + Math.random() * (opts.h ?? 4),
      z: center.z + (Math.random() - 0.5) * area,
      vx: (Math.random() - 0.5) * 0.2, vy: 0.05 + Math.random() * 0.1, vz: (Math.random() - 0.5) * 0.2,
      life: 5 + Math.random() * 4,
      size: opts.size ?? 0.05,
      color: col, color1: [col[0], col[1], col[2], 0],
      wobble: 0.3,
    }),
  });
}

export function fireflies(ps, center, area = 20) {
  return ps.addEmitter({
    rate: 4,
    make: () => ({
      x: center.x + (Math.random() - 0.5) * area,
      y: 0.4 + Math.random() * 2,
      z: center.z + (Math.random() - 0.5) * area,
      vy: 0.05,
      life: 4 + Math.random() * 3,
      size: 0.08,
      color: [0.7, 1.0, 0.5, 1], color1: [0.4, 1.0, 0.3, 0],
      wobble: 0.8,
    }),
  });
}
