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
      if (k >= 1) { this.scene.remove(m.obj); m.obj.traverse?.(o => { if (o.geometry && !o.userData.keepGeo) o.geometry.dispose(); if (o.material && o.material !== this.sharedMat) o.material.dispose?.(); }); m.obj.userData?.tex?.dispose(); return false; }
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
    this.burst(pos, { n: 2, color: c, speed: 1, life: 0.18, size: big ? 0.5 : 0.38, glow: true, g: 0, grow: 0.3 });
    this.flashLight(pos, c, big ? 10 : 5);
  }

  slash(pos, color = 0xffffff, angle = -0.6, scale = 1.4) {
    const mat = new THREE.MeshBasicMaterial({ map: this.arcTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(scale, scale), mat);
    m.position.copy(pos).add(new THREE.Vector3(0, 0.1, 0.3));
    m.rotation.z = angle;
    m.lookAt(this.stage.camera.position); m.rotateZ(angle);
    this.addMesh(m, 0.22, k => { mat.opacity = (1 - k) * 0.8; m.scale.setScalar(0.8 + k * 0.5); m.rotateZ(0.08); });
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
      case 'fire': this.flameBurst(pos); this.stage.addShake(0.15, 0.3); break;
      case 'ice':
        for (let i = 0; i < 12; i++) this.pix.emit({ x: up.clone().add(new THREE.Vector3((Math.random() - 0.5), 2.5 + Math.random(), (Math.random() - 0.5))), v: new THREE.Vector3(0, -8, 0), color: i % 2 ? 0xe8fbff : 0x8ad8ff, life: 0.4, size: 0.18, g: 10, floor: 0.05 });
        this.shards(pos); this.shock(pos, 0xbfefff, 2, 0.5); break;
      case 'bolt': this.bolt(pos); setTimeout(() => this.bolt(pos.clone().add(new THREE.Vector3(0.3, 0, 0))), 90); this.ringV(up, 0xffe45a, 1.8); this.streaks(up, 0xffe45a, 14, 2); this.shock(pos, 0xffe45a, 2.2, 0.35); this.burst(up, { n: 24, color: 0xffe45a, speed: 5, life: 0.35, size: 0.08, g: 4 }); this.flashLight(up, 0xfff080, 16, 25); break;
      case 'wind':
        this.tornado(pos);
        for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 4; this.glow.emit({ x: pos.clone().add(new THREE.Vector3(Math.cos(a) * 0.8, 0.1 + i * 0.06, Math.sin(a) * 0.8)), v: new THREE.Vector3(-Math.sin(a) * 3, 1.5, Math.cos(a) * 3), color: i % 2 ? 0x8ae8a0 : 0xe0ffe8, life: 0.6, size: 0.3, g: 0, drag: 0.95 }); }
        break;
      case 'light':
        this.pillar(pos, 0xfff4c0, 0.8, 0.6, 6); this.lightBlades(pos);
        this.burst(up, { n: 26, color: 0xffffff, colors: [0xfff4c0, 0xffffff], speed: 2, life: 0.9, size: 0.12, g: -2, glow: true });
        this.stage.flash(0xffffff, 0.35); this.flashLight(up, 0xfff0c0, 14, 15); break;
      case 'dark':
        for (let i = 0; i < 30; i++) { const d = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(1.6); this.glow.emit({ x: up.clone().add(d), v: d.clone().multiplyScalar(-2.8), color: i % 3 ? 0x7a4ab0 : 0xe45ac8, life: 0.55, size: 0.35, g: 0, drag: 1 }); }
        this.voidOrb(pos);
        setTimeout(() => this.burst(up, { n: 20, color: 0xb070ff, speed: 3, life: 0.5, size: 0.5, glow: true, g: 0 }), 380);
        this.flashLight(up, 0x9040ff, 10, 12); break;
      default: this.hit(up, [elem], true);
    }
  }

  // ── v3 연출 ─────────────────────────────────────────────
  // 바닥 충격파 고리
  shock(pos, color = 0xffffff, r = 2.2, life = 0.45, y = 0.06, w = 0.18) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const m = new THREE.Mesh(new THREE.RingGeometry(1 - w, 1, 48), mat);
    m.rotation.x = -Math.PI / 2; m.position.copy(pos).setY(pos.y + y);
    this.addMesh(m, life, k => { const e = 1 - Math.pow(1 - k, 3); m.scale.setScalar(0.1 + e * r); mat.opacity = (1 - k) * 0.95; });
  }
  // 화면을 향한 세로 고리 (타격 순간 팽창)
  ringV(pos, color = 0xffffff, r = 1.4, life = 0.3) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const m = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 40), mat);
    m.position.copy(pos); m.lookAt(this.stage.camera.position);
    this.addMesh(m, life, k => { m.scale.setScalar(0.15 + (1 - Math.pow(1 - k, 2)) * r); mat.opacity = (1 - k) * 0.6; });
  }
  // 집중선 (중심에서 바깥으로 뻗는 빛줄기)
  streaks(pos, color = 0xffffff, n = 12, len = 1.6, life = 0.28) {
    const g = new THREE.Group(); g.position.copy(pos); g.lookAt(this.stage.camera.position);
    const mats = [];
    for (let i = 0; i < n; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: i % 3 ? color : 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      const geo = new THREE.PlaneGeometry(1, 0.025 + Math.random() * 0.03); geo.translate(0.5, 0, 0);
      const m = new THREE.Mesh(geo, mat); m.rotation.z = (i / n + Math.random() * 0.06) * Math.PI * 2;
      m.userData.sp = 0.6 + Math.random() * 0.8; g.add(m); mats.push(mat);
    }
    this.addMesh(g, life, k => {
      g.children.forEach(m => { m.position.set(Math.cos(m.rotation.z), Math.sin(m.rotation.z), 0).multiplyScalar(0.2 + k * len * 0.6 * m.userData.sp); m.scale.x = len * m.userData.sp * (1 - k) + 0.05; });
      mats.forEach(mt => mt.opacity = (1 - k) * 0.55);
    });
  }
  // 큰 베기: 두 겹 궤적 + 집중선 + 충격 고리
  bigSlash(pos, color = 0xffffff, angle = -0.6, scale = 2.2) {
    this.slash(pos, color, angle, scale);
    this.slash(pos, color, angle + 0.25, scale * 0.7);
    this.streaks(pos, color, 10, scale * 0.8);
    this.ringV(pos, color, scale * 0.6);
  }
  crossSlash(pos, color = 0xffffff, scale = 2) {
    this.slash(pos, color, -0.75, scale); this.slash(pos, color, 0.75 + Math.PI, scale);
    this.streaks(pos, color, 16, scale);
  }
  // 얼음 결정이 솟아오른 뒤 부서짐
  shards(pos, color = 0x9ae0ff, n = 9, h = 1.5) {
    const g = new THREE.Group(); g.position.copy(pos).setY(pos.y);
    const mat = new THREE.MeshLambertMaterial({ color, emissive: new THREE.Color(color).multiplyScalar(0.55), transparent: true, opacity: 0.92, flatShading: true });
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + Math.random() * 0.3, d = i === 0 ? 0 : 0.35 + Math.random() * 0.4;
      const hh = (i === 0 ? 1.3 : 0.5 + Math.random() * 0.7) * h;
      const geo = new THREE.ConeGeometry(0.13 + Math.random() * 0.1, hh, 5); geo.translate(0, hh / 2, 0);
      const m = new THREE.Mesh(geo, mat); m.position.set(Math.cos(a) * d, 0, Math.sin(a) * d * 0.6);
      m.rotation.set(Math.sin(a) * d * 0.7, 0, -Math.cos(a) * d * 0.7); m.userData.d = Math.random() * 0.08; g.add(m);
    }
    let broke = false;
    this.addMesh(g, 0.75, k => {
      g.children.forEach(m => { const t = Math.min(1, Math.max(0, (k - m.userData.d) / 0.18)); m.scale.set(1, 1 - Math.pow(1 - t, 3), 1); });
      if (k > 0.72 && !broke) { broke = true; g.visible = false; this.shatter(pos.clone().setY(pos.y + 0.7), color); }
    });
    this.flashLight(pos.clone().setY(0.8), 0x80d0ff, 12, 10);
  }
  // 회오리 (초승달 판이 소용돌이치며 상승)
  tornado(pos, color = 0x8ae8a0, life = 0.8, h = 2.6) {
    const g = new THREE.Group(); g.position.copy(pos);
    const mats = [];
    for (let i = 0; i < 7; i++) {
      const mat = new THREE.MeshBasicMaterial({ map: this.arcTex, color: i % 2 ? color : 0xe8fff0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
      const r = 0.5 + i * 0.12;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), mat);
      m.rotation.x = -Math.PI / 2; m.position.y = 0.2 + i * (h / 7); m.userData.r = Math.random() * 6; g.add(m); mats.push(mat);
    }
    this.addMesh(g, life, (k, dt) => {
      g.children.forEach((m, i) => { m.rotation.z += dt * (12 + i); m.position.y = (0.2 + i * (h / 7)) * (0.5 + k * 0.6); });
      mats.forEach(mt => mt.opacity = Math.sin(Math.min(1, k * 1.3) * Math.PI) * 0.9);
    });
    for (let i = 0; i < 30; i++) { const a = Math.random() * Math.PI * 2; this.pix.emit({ x: pos.clone().add(new THREE.Vector3(Math.cos(a) * 0.9, Math.random() * 0.4, Math.sin(a) * 0.9)), v: new THREE.Vector3(-Math.sin(a) * 4, 3 + Math.random() * 3, Math.cos(a) * 4), color: i % 3 ? 0xd8ffe0 : 0x6ac080, life: 0.7, size: 0.08, g: 0, drag: 0.94 }); }
  }
  // 화염 기둥 + 폭발
  flameBurst(pos, scale = 1) {
    const up = pos.clone().setY(pos.y + 0.6);
    for (let i = 0; i < 22 * scale; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 0.45 * scale;
      this.glow.emit({ x: pos.clone().add(new THREE.Vector3(Math.cos(a) * r, 0.1 + Math.random() * 0.3, Math.sin(a) * r * 0.6)), v: new THREE.Vector3(Math.cos(a) * 0.6, 3 + Math.random() * 3.5, Math.sin(a) * 0.4), color: [0xff5a20, 0xffa040, 0xffe080, 0xc82a1a][i % 4], life: 0.5 + Math.random() * 0.4, size: (0.22 + Math.random() * 0.25) * scale, grow: -0.15, g: 0, drag: 0.9 });
    }
    this.burst(up, { n: 24, color: 0xffd070, colors: [0xffd070, 0xff7a30, 0xffffff], speed: 5, life: 0.7, size: 0.09, g: 3, floor: 0.02 });
    this.burst(up, { n: 2, color: 0xc85a20, speed: 0.6, life: 0.3, size: 1.1 * scale, glow: true, g: 0, grow: 0.6 });
    this.shock(pos, 0xff8a40, 2.4 * scale, 0.5);
    this.flashLight(up, 0xff7030, 10, 14);
  }
  // 하늘에서 내리꽂히는 빛의 창
  lightBlades(pos, n = 5) {
    for (let i = 0; i < n; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: i % 2 ? 0xfff4c0 : 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
      const geo = new THREE.ConeGeometry(0.09, 2.4, 4); geo.rotateX(Math.PI);
      const m = new THREE.Mesh(geo, mat);
      const off = new THREE.Vector3((Math.random() - 0.5) * 1.2, 0, (Math.random() - 0.5) * 0.6);
      const d = i * 0.07;
      this.addMesh(m, 0.55 + d, k => {
        const t = Math.max(0, (k * (0.55 + d) - d) / 0.18);
        m.position.copy(pos).add(off).setY(pos.y + 1.2 + (1 - Math.min(1, t)) * 6);
        mat.opacity = t <= 0 ? 0 : t < 1 ? 1 : Math.max(0, 1 - (t - 1) * 0.6);
      });
    }
    this.shock(pos, 0xfff4c0, 2.6, 0.6);
  }
  // 암흑 구체: 수축 후 폭발
  voidOrb(pos, color = 0x9a50ff) {
    const up = pos.clone().setY(pos.y + 0.8);
    const mat = new THREE.MeshBasicMaterial({ color: 0x14081e, transparent: true, depthWrite: false });
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.6, 20, 14), mat); core.position.copy(up);
    const rimMat = new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide, toneMapped: false });
    const rim = new THREE.Mesh(new THREE.SphereGeometry(0.72, 20, 14), rimMat); core.add(rim);
    this.addMesh(core, 0.55, k => { const s = k < 0.7 ? 1.4 - k : 0.7 + (k - 0.7) * 6; core.scale.setScalar(s); mat.opacity = k < 0.7 ? 0.9 : 0.9 * (1 - (k - 0.7) / 0.3); rimMat.opacity = mat.opacity; });
    setTimeout(() => { this.ringV(up, color, 2.2, 0.35); this.streaks(up, 0xe45ac8, 16, 2.2); this.shock(pos, color, 2.4, 0.5); }, 380);
  }
  // 시전자에게 빛이 모여드는 충전
  charge(pos, color = 0x7ef0ff, n = 26, r = 1.6) {
    const c = pos.clone().setY(pos.y + 0.8);
    for (let i = 0; i < n; i++) {
      const d = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(r);
      this.glow.emit({ x: c.clone().add(d), v: d.clone().multiplyScalar(-2.2), color: i % 3 ? color : 0xffffff, life: 0.45, size: 0.22, g: 0, drag: 1, fadeIn: true });
    }
    this.shock(pos, color, 1.4, 0.6, 0.05, 0.1);
  }
  // 잔상 (리그 캐릭터의 현재 프레임을 복사해 남김)
  ghost(sp, color = 0x7ab8ff, life = 0.3) {
    if (!sp.snapshot || !sp.group.visible) return;
    const tex = sp.snapshot(); if (!tex) return;
    const mat = new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const m = new THREE.Mesh(sp.mesh.geometry, mat);
    sp.mesh.updateWorldMatrix(true, false);
    m.matrixAutoUpdate = false; m.matrix.copy(sp.mesh.matrixWorld);
    m.userData.keepGeo = true; m.userData.tex = tex;
    this.addMesh(m, life, k => { mat.opacity = 0.6 * (1 - k); });
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
