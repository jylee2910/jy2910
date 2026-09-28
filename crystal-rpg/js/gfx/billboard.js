// 도트 스프라이트 빌보드: 시트의 프레임을 UV로 잘라 카메라를 향하는 평면에 표시.
// 조명/그림자를 받도록 Lambert + 알파테스트 깊이 재질 사용 (HD-2D 느낌의 핵심)
import * as THREE from 'three';

export const PPU = 1 / 20; // 도트 1px = 0.05 월드 단위

const texCache = new Map();
function sheetTexture(sheet) {
  let t = texCache.get(sheet.key);
  if (!t) {
    t = new THREE.CanvasTexture(sheet.canvas);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
    texCache.set(sheet.key, t);
  }
  return t;
}

export class Billboard {
  constructor(sheet, { scale = 1, shadow = true, lit = true } = {}) {
    this.group = new THREE.Group();
    this.scale = scale;
    this.setSheet(sheet, { shadow, lit });
    this.anim = 'idle'; this.frame = 0; this.time = 0; this.speed = 1;
    this.onEnd = null; this.onHit = null; this.hitFired = false;
    this.flashT = 0; this.flashColor = new THREE.Color(1, 1, 1);
    this.flipped = false; // true면 좌우 반전 (캐릭터 원본=왼쪽, 몬스터 원본=오른쪽을 바라봄)
    this.offset = new THREE.Vector3(); // 넉백/돌진용
    this.alpha = 1;
    this.showFrame();
  }

  setSheet(sheet, { shadow = true, lit = true } = {}) {
    if (this.mesh) { this.group.remove(this.mesh); this.mesh.geometry.dispose(); this.mat.dispose(); }
    this.sheet = sheet;
    const m = sheet.meta;
    const w = m.frameW * PPU * this.scale, h = m.frameH * PPU * this.scale;
    const geo = new THREE.PlaneGeometry(w, h);
    geo.translate(0, h / 2, 0);
    const tex = sheetTexture(sheet);
    const Mat = lit ? THREE.MeshLambertMaterial : THREE.MeshBasicMaterial;
    this.mat = new Mat({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, transparent: false });
    if (lit) { this.mat.emissive = new THREE.Color(0, 0, 0); this.mat.emissiveMap = tex; }
    this.glow = lit ? 0.22 : 0; // 어두운 던전에서도 캐릭터가 보이도록 자체 발광 바닥값
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.castShadow = shadow;
    this.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5 });
    this.group.add(this.mesh);
    this.width = w; this.height = h;
    if (this.anim) this.showFrame();
  }

  play(name, { onEnd = null, onHit = null, speed = 1, restart = true } = {}) {
    if (!this.sheet.meta.anims[name]) name = 'idle';
    if (!restart && this.anim === name) return;
    this.anim = name; this.frame = 0; this.time = 0; this.speed = speed;
    this.onEnd = onEnd; this.onHit = onHit; this.hitFired = false;
    this.showFrame();
  }

  flash(dur = 0.12, color = 0xffffff) { this.flashT = dur; this.flashColor.set(color); }

  showFrame() {
    const m = this.sheet.meta, a = m.anims[this.anim];
    const u0 = this.frame / m.cols, u1 = (this.frame + 1) / m.cols;
    const v1 = 1 - a.row / m.rows, v0 = 1 - (a.row + 1) / m.rows;
    const uv = this.mesh.geometry.attributes.uv;
    // PlaneGeometry uv 순서: (0,1)(1,1)(0,0)(1,0)
    uv.setXY(0, u0, v1); uv.setXY(1, u1, v1); uv.setXY(2, u0, v0); uv.setXY(3, u1, v0);
    uv.needsUpdate = true;
  }

  update(dt, camera) {
    const m = this.sheet.meta, a = m.anims[this.anim];
    this.time += dt * this.speed;
    const f = Math.floor(this.time * a.fps);
    if (f !== this.frame) {
      if (f >= a.frames) {
        if (a.loop) { this.time = 0; this.frame = 0; }
        else { this.frame = a.frames - 1; const cb = this.onEnd; this.onEnd = null; if (cb) cb(); }
      } else this.frame = f;
      if (a.hit !== undefined && !this.hitFired && this.frame >= a.hit) { this.hitFired = true; const h = this.onHit; this.onHit = null; if (h) h(); }
      this.showFrame();
    }
    // 원통형 빌보드
    if (camera) {
      const wp = this.group.getWorldPosition(_v);
      this.mesh.rotation.y = Math.atan2(camera.position.x - wp.x, camera.position.z - wp.z) - (this.group.parent ? 0 : 0);
    }
    this.mesh.scale.x = this.flipped ? -1 : 1;
    this.mesh.position.copy(this.offset);
    if (this.mat.emissive) {
      if (this.flashT > 0) { this.flashT -= dt; this.mat.emissive.copy(this.flashColor).multiplyScalar(3); }
      else this.mat.emissive.setScalar(this.glow);
    }
  }

  setAlpha(a) {
    this.alpha = a;
    this.mat.transparent = a < 1; this.mat.opacity = a;
    this.mat.alphaTest = a < 1 ? 0.01 : 0.5;
    this.mat.depthWrite = a >= 1;
    this.mat.needsUpdate = true;
  }

  dispose() { this.mesh.geometry.dispose(); this.mat.dispose(); }
}
const _v = new THREE.Vector3();
