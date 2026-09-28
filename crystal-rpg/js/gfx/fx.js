// 전투 연출: 파티클, 베기 궤적, 마법 효과, 마법진, 순간 조명, 데미지 팝업
import * as THREE from 'three';
import { glowTexture } from './diorama.js';
import { ELEMENTS } from '../data/elements.js';

const MAX = 1400;

function squareTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 8;
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(1, 1, 6, 6);
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; return t;
}

function makePointsMat(tex, additive) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, scale: { value: 300 } },
    vertexShader: `
      attribute float size; attribute float alpha; attribute vec3 color;
      varying float vA; varying vec3 vC; uniform float scale;
      void main(){ vA = alpha; vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0);
        gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `
      uniform sampler2D map; varying float vA; varying vec3 vC;
      void main(){ vec4 t = texture2D(map, gl_PointCoord); if (t.a * vA < 0.02) discard; gl_FragColor = vec4(vC * (${additive ? '1.6' : '1.0'}), t.a * vA); }`,
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

class Particles {
  constructor(scene, tex, additive) {
    this.pos = new Float32Array(MAX * 3); this.col = new Float32Array(MAX * 3);
    this.size = new Float32Array(MAX); this.alpha = new Float32Array(MAX);
    this.p = [];
    const g = this.geo = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    this.mat = makePointsMat(tex, additive);
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    scene.add(this.points);
  }
  emit(o) { if (this.p.length < MAX) this.p.push({ drag: 0.9, g: 0, life: 0.6, age: 0, size: 0.2, grow: 0, ...o, col: new THREE.Color(o.color ?? 0xffffff) }); }
  update(dt, h) {
    const alive = [];
    for (const p of this.p) {
      p.age += dt;
      if (p.age >= p.life) continue;
      const d = Math.pow(p.drag, dt * 60);
      p.v.multiplyScalar(d); p.v.y -= p.g * dt;
      p.x.addScaledVector(p.v, dt);
      if (p.floor !== undefined && p.x.y < p.floor) { p.x.y = p.floor; p.v.y *= -0.35; p.v.x *= 0.7; p.v.z *= 0.7; }
      alive.push(p);
    }
    this.p = alive;
    const n = alive.length;
    for (let i = 0; i < n; i++) {
      const p = alive[i], k = p.age / p.life;
      this.pos[i * 3] = p.x.x; this.pos[i * 3 + 1] = p.x.y; this.pos[i * 3 + 2] = p.x.z;
      this.col[i * 3] = p.col.r; this.col[i * 3 + 1] = p.col.g; this.col[i * 3 + 2] = p.col.b;
      this.size[i] = Math.max(0, p.size + p.grow * k);
      this.alpha[i] = p.fadeIn ? Math.min(1, k * 5) * (1 - k) : 1 - k * k;
    }
    this.geo.setDrawRange(0, n);
    for (const a of ['position', 'color', 'size', 'alpha']) this.geo.attributes[a].needsUpdate = true;
    this.mat.uniforms.scale.value = h * 0.9;
  }
}

// 베기 궤적 텍스처 (초승달)
function arcTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 30, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.7, 'rgba(255,255,255,0.9)'); g.addColorStop(0.85, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.beginPath(); x.arc(64, 64, 62, Math.PI * 0.9, Math.PI * 2.1); x.arc(58, 70, 44, Math.PI * 2.1, Math.PI * 0.9, true); x.fill();
  return new THREE.CanvasTexture(c);
}
function circleTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'); x.strokeStyle = '#fff'; x.lineWidth = 3;
  x.beginPath(); x.arc(64, 64, 60, 0, 7); x.stroke();
  x.lineWidth = 2; x.beginPath(); x.arc(64, 64, 48, 0, 7); x.stroke();
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, b = a + Math.PI * 2 / 3; x.beginPath(); x.moveTo(64 + Math.cos(a) * 48, 64 + Math.sin(a) * 48); x.lineTo(64 + Math.cos(b) * 48, 64 + Math.sin(b) * 48); x.stroke(); }
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; x.fillStyle = '#fff'; x.fillRect(64 + Math.cos(a) * 54 - 2, 64 + Math.sin(a) * 54 - 2, 4, 4); }
  return new THREE.CanvasTexture(c);
}

const ELEM_COL = { slash: 0xffffff, pierce: 0xe0f0ff, strike: 0xfff0d0, fire: 0xff7a30, ice: 0x8ad8ff, bolt: 0xffe45a, wind: 0x8ae8a0, light: 0xfff4c0, dark: 0xb070ff };

export class FX {
  constructor(scene, stage) {
    this.scene = scene; this.stage = stage;
    this.pix = new Particles(scene, squareTexture(), false);
    this.glow = new Particles(scene, glowTexture(), true);
    this.meshes = [];
    this.arcTex = arcTexture();
    this.circleTex = circleTexture();
    this.lights = [];
    for (let i = 0; i < 2; i++) { const l = new THREE.PointLight(0xffffff, 0, 8, 1.5); l.userData.decay = 10; scene.add(l); this.lights.push(l); }
    this.lightI = 0;
  }
  update(dt) {
    this.pix.update(dt, this.stage.height);
    this.glow.update(dt, this.stage.height);
    this.meshes = this.meshes.filter(m => {
      m.age += dt; const k = m.age / m.life;
      if (k >= 1) { this.scene.remove(m.obj); m.obj.geometry?.dispose(); return false; }
      m.fn(k, dt);
      return true;
    });
    for (const l of this.lights) l.intensity = Math.max(0, l.intensity - dt * l.userData.decay);
  }
  addMesh(obj, life, fn) { this.scene.add(obj); this.meshes.push({ obj, life, age: 0, fn }); }

  flashLight(pos, color, intensity = 8, decay = 30) {
    const l = this.lights[this.lightI++ % this.lights.length];
    l.position.copy(pos).add(new THREE.Vector3(0, 0.6, 0.6)); l.color.set(color); l.intensity = intensity; l.userData.decay = decay;
  }

  burst(pos, { n = 16, color = 0xffffff, speed = 3, life = 0.5, size = 0.12, g = 6, glow = false, up = 1, spread = 1, floor, colors, grow = 0, drag = 0.9 } = {}) {
    const sys = glow ? this.glow : this.pix;
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 2 * spread, Math.random() * up + (up > 0 ? 0.2 : 0), (Math.random() - 0.5) * 2 * spread).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.8));
      sys.emit({ x: pos.clone(), v, color: colors ? colors[i % colors.length] : color, life: life * (0.6 + Math.random() * 0.6), size: size * (0.7 + Math.random() * 0.6), g, floor, grow, drag });
    }
  }

  // 타격 스파크
  hit(pos, elems = ['strike'], big = false) {
    const c = ELEM_COL[elems[elems.length - 1]] ?? 0xffffff;
    this.burst(pos, { n: big ? 26 : 14, color: c, colors: [c, 0xffffff], speed: big ? 5 : 3.5, life: 0.45, size: 0.11, g: 8, floor: 0.02 });
    this.burst(pos, { n: big ? 8 : 4, color: c, speed: 1.2, life: 0.25, size: big ? 1.1 : 0.7, glow: true, g: 0, grow: 0.6 });
    this.flashLight(pos, c, big ? 10 : 5);
  }

  slash(pos, color = 0xffffff, angle = -0.6, scale = 1.4) {
    const mat = new THREE.MeshBasicMaterial({ map: this.arcTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(scale, scale), mat);
    m.position.copy(pos).add(new THREE.Vector3(0, 0.1, 0.3));
    m.rotation.z = angle;
    m.lookAt(this.stage.camera.position); m.rotateZ(angle);
    this.addMesh(m, 0.22, k => { mat.opacity = 1 - k; m.scale.setScalar(0.8 + k * 0.5); m.rotateZ(0.08); });
  }

  magicCircle(pos, color = 0x7ef0ff, life = 1.0, r = 0.9) {
    const mat = new THREE.MeshBasicMaterial({ map: this.circleTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), mat);
    m.rotation.x = -Math.PI / 2; m.position.copy(pos).setY(0.03);
    this.addMesh(m, life, (k, dt) => { mat.opacity = Math.sin(k * Math.PI); m.rotation.z += dt * 2; m.scale.setScalar(0.6 + Math.min(1, k * 4) * 0.4); });
    this.burst(pos.clone().setY(0.1), { n: 18, color, speed: 0.4, life: 1, size: 0.1, g: -2.5, glow: true, spread: 0.8 });
  }

  pillar(pos, color, life = 0.7, r = 0.5, h = 5) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 12, 1, true), mat);
    m.position.copy(pos).setY(h / 2);
    this.addMesh(m, life, k => { mat.opacity = (1 - k) * 0.8; m.scale.set(1 - k * 0.7, 1, 1 - k * 0.7); });
  }

  bolt(pos) {
    const pts = [];
    let p = pos.clone().add(new THREE.Vector3(0, 6, 0));
    for (let i = 0; i < 10; i++) { pts.push(p.clone()); p = p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, -0.62, (Math.random() - 0.5) * 0.3)); }
    pts.push(pos.clone().setY(0.4));
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: 0xfffbd0, transparent: true, blending: THREE.AdditiveBlending });
    const line = new THREE.Line(geo, mat);
    this.addMesh(line, 0.3, k => { mat.opacity = k < 0.5 ? 1 : 2 - k * 2; });
    this.pillar(pos, 0xffe45a, 0.25, 0.25, 6);
    this.stage.flash(0xfff6c0, 0.45);
  }

  orb(from, to, color, life = 0.35) {
    const mat = new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const s = new THREE.Sprite(mat); s.scale.setScalar(0.7);
    const a = from.clone(), b = to.clone();
    this.addMesh(s, life, k => { s.position.lerpVectors(a, b, k); s.position.y += Math.sin(k * Math.PI) * 0.8; this.glow.emit({ x: s.position.clone(), v: new THREE.Vector3(), color, life: 0.3, size: 0.4 }); });
    s.geometry = s.geometry.clone();
  }

  // 원소 마법 연출 (대상 위치)
  spell(elem, pos) {
    const c = ELEM_COL[elem] ?? 0xffffff;
    const up = pos.clone().setY(0.6);
    switch (elem) {
      case 'fire':
        this.burst(up, { n: 30, color: 0xff7a30, colors: [0xff7a30, 0xffd070, 0xc83a2a], speed: 2.2, life: 0.8, size: 0.5, glow: true, g: -3, grow: 0.4 });
        this.burst(up, { n: 16, color: 0xffd070, speed: 3, life: 0.6, size: 0.1, g: -1 });
        this.flashLight(up, 0xff7030, 14, 18); break;
      case 'ice':
        for (let i = 0; i < 12; i++) this.pix.emit({ x: up.clone().add(new THREE.Vector3((Math.random() - 0.5), 2.5 + Math.random(), (Math.random() - 0.5))), v: new THREE.Vector3(0, -8, 0), color: i % 2 ? 0xe8fbff : 0x8ad8ff, life: 0.4, size: 0.18, g: 10, floor: 0.05 });
        this.burst(up, { n: 18, color: 0xe8fbff, speed: 2.5, life: 0.5, size: 0.3, glow: true, g: 0 });
        this.flashLight(up, 0x80d0ff, 10, 18); break;
      case 'bolt': this.bolt(pos); this.burst(up, { n: 24, color: 0xffe45a, speed: 5, life: 0.35, size: 0.08, g: 4 }); this.flashLight(up, 0xfff080, 16, 25); break;
      case 'wind':
        for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 4; this.glow.emit({ x: pos.clone().add(new THREE.Vector3(Math.cos(a) * 0.8, 0.1 + i * 0.06, Math.sin(a) * 0.8)), v: new THREE.Vector3(-Math.sin(a) * 3, 1.5, Math.cos(a) * 3), color: i % 2 ? 0x8ae8a0 : 0xe0ffe8, life: 0.6, size: 0.3, g: 0, drag: 0.95 }); }
        break;
      case 'light':
        this.pillar(pos, 0xfff4c0, 0.8, 0.6, 6);
        this.burst(up, { n: 26, color: 0xffffff, colors: [0xfff4c0, 0xffffff], speed: 2, life: 0.9, size: 0.12, g: -2, glow: true });
        this.stage.flash(0xffffff, 0.35); this.flashLight(up, 0xfff0c0, 14, 15); break;
      case 'dark':
        for (let i = 0; i < 30; i++) { const d = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(1.6); this.glow.emit({ x: up.clone().add(d), v: d.clone().multiplyScalar(-2.8), color: i % 3 ? 0x7a4ab0 : 0xe45ac8, life: 0.55, size: 0.35, g: 0, drag: 1 }); }
        setTimeout(() => this.burst(up, { n: 20, color: 0xb070ff, speed: 3, life: 0.5, size: 0.5, glow: true, g: 0 }), 380);
        this.flashLight(up, 0x9040ff, 10, 12); break;
      default: this.hit(up, [elem], true);
    }
  }

  heal(pos, color = 0x9dffb0) {
    for (let i = 0; i < 22; i++) this.glow.emit({ x: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.9, Math.random() * 0.4, (Math.random() - 0.5) * 0.6)), v: new THREE.Vector3(0, 1.5 + Math.random() * 1.5, 0), color: i % 3 ? color : 0xffffff, life: 0.9, size: 0.25, g: 0, drag: 0.97, fadeIn: true });
    this.flashLight(pos.clone().setY(0.8), color, 5, 8);
  }

  shatter(pos, color = 0x7ef0ff) {
    this.burst(pos, { n: 40, colors: [color, 0xffffff, 0xe8ffff], speed: 7, life: 0.9, size: 0.14, g: 9, floor: 0.02, spread: 1.2 });
    this.burst(pos, { n: 6, color: 0xffffff, speed: 0.5, life: 0.35, size: 2.4, glow: true, g: 0, grow: 1 });
  }

  dissolve(pos, h, color = 0xffffff) {
    for (let i = 0; i < 50; i++) this.pix.emit({ x: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, Math.random() * h, (Math.random() - 0.5) * 0.3)), v: new THREE.Vector3((Math.random() - 0.5), 1 + Math.random() * 2, (Math.random() - 0.5)), color: i % 3 ? color : 0xffffff, life: 0.9 + Math.random() * 0.5, size: 0.09, g: -0.5, drag: 0.96 });
  }

  dust(pos) { this.burst(pos.clone().setY(0.05), { n: 10, color: 0xd8c8a8, speed: 1.2, life: 0.5, size: 0.14, g: -0.5, up: 0.3 }); }

  aura(pos, color, h = 2) {
    for (let i = 0; i < 3; i++) this.glow.emit({ x: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.6, Math.random() * h * 0.3, (Math.random() - 0.5) * 0.6)), v: new THREE.Vector3(0, 1.2 + Math.random(), 0), color, life: 1.0, size: 0.35, g: 0, drag: 0.98, fadeIn: true });
  }
}

export function elemColorCSS(e) { return ELEMENTS[e]?.color || '#fff'; }
