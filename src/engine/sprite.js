// Billboarded pixel-art sprite actors living in the 3D scene.
import * as THREE from 'three';
import { assets } from './assets.js';

export const PX = 0.024; // world metres per sprite pixel

const _geo = new THREE.PlaneGeometry(1, 1);
{
  // tilt normals up/forward so the sun lights the billboard from the front
  const n = _geo.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 0.45, 0.89);
}

function patchSpriteMaterial(mat, u) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uFlash; uniform vec3 uFlashColor; uniform float uDissolve; uniform vec3 uTint; uniform float uTintAmt;
float sHash(vec2 p){ return fract(sin(dot(floor(p), vec2(12.9898,78.233))) * 43758.5453); }`,
      )
      .replace(
        '#include <alphatest_fragment>',
        `#include <alphatest_fragment>
if (uDissolve > 0.0 && sHash(vUv * 512.0) < uDissolve) discard;
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * uTint, uTintAmt);`,
      )
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
gl_FragColor.rgb = mix(gl_FragColor.rgb, uFlashColor, uFlash);`,
      );
    // need vUv in fragment: map_pars provides vMapUv
    sh.fragmentShader = sh.fragmentShader.replace('sHash(vUv * 512.0)', 'sHash(vMapUv * 1024.0)');
  };
  mat.customProgramCacheKey = () => 'spriteFX';
}

export class SpriteActor {
  constructor(name, opts = {}) {
    const a = assets.atlas[name];
    if (!a) throw new Error('no atlas ' + name);
    this.name = name;
    this.atlas = a;
    this.tex = a.tex.clone();
    this.tex.needsUpdate = true;
    this.root = new THREE.Group();
    this.pivot = new THREE.Group(); // rotates to face camera
    this.root.add(this.pivot);
    this.uniforms = {
      uFlash: { value: 0 },
      uFlashColor: { value: new THREE.Color(1, 1, 1) },
      uDissolve: { value: 0 },
      uTint: { value: new THREE.Color(1, 1, 1) },
      uTintAmt: { value: 0 },
    };
    this.mat = new THREE.MeshLambertMaterial({
      map: this.tex,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      emissive: new THREE.Color(1, 1, 1),
      emissiveMap: this.tex,
      emissiveIntensity: opts.emissive ?? 0.22,
    });
    patchSpriteMaterial(this.mat, this.uniforms);
    this.mesh = new THREE.Mesh(_geo, this.mat);
    this.mesh.castShadow = opts.shadow !== false;
    this.mesh.receiveShadow = true;
    this.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.tex, alphaTest: 0.5 });
    this.pivot.add(this.mesh);
    this.scale = opts.scale ?? 1;
    this.flip = false;
    this.anim = null;
    this.frame = 0;
    this.t = 0;
    this.speed = 1;
    this.tiltFactor = opts.tilt ?? 0.45;
    this.onEnd = null;
    if (opts.blob !== false) this.addBlobShadow(opts.blobSize ?? 0.55);
    this.ghosts = [];
  }

  addBlobShadow(size) {
    const g = new THREE.CircleGeometry(size, 20);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false });
    m.map = blobTexture();
    this.blob = new THREE.Mesh(g, m);
    this.blob.position.y = 0.02;
    this.blob.scale.set(1.25, 1, 0.75);
    this.blob.renderOrder = 1;
    this.root.add(this.blob);
  }

  has(anim) {
    return !!this.atlas.meta.anims[anim];
  }

  play(anim, opts = {}) {
    const meta = this.atlas.meta.anims[anim];
    if (!meta) {
      console.warn('missing anim', this.name, anim);
      return this;
    }
    if (this.anim === anim && !opts.restart) return this;
    this.anim = anim;
    this.meta = meta;
    this.frame = 0;
    this.t = 0;
    this.loop = opts.loop ?? meta.loop;
    this.fps = opts.fps ?? meta.fps;
    this.onEnd = opts.onEnd || null;
    this.hold = opts.hold ?? false;
    this.applyFrame();
    return this;
  }

  // returns a promise that resolves when a non-looping animation ends
  playOnce(anim, opts = {}) {
    return new Promise((res) => this.play(anim, { ...opts, loop: false, restart: true, onEnd: res }));
  }

  applyFrame() {
    const m = this.meta;
    const [x, y, w, h] = m.frames[this.frame];
    const W = this.atlas.w, H = this.atlas.h;
    const s = PX * this.scale;
    this.mesh.scale.set(w * s, h * s, 1);
    const ox = (w / 2 - m.ax) * s;
    this.mesh.position.set(this.flip ? -ox : ox, (m.ay - h / 2) * s, 0);
    if (this.flip) {
      this.tex.repeat.set(-w / W, h / H);
      this.tex.offset.set((x + w) / W, 1 - (y + h) / H);
    } else {
      this.tex.repeat.set(w / W, h / H);
      this.tex.offset.set(x / W, 1 - (y + h) / H);
    }
    for (const g of this.ghosts) g.sync(this);
  }

  setFlip(f) {
    if (this.flip !== f) {
      this.flip = f;
      if (this.meta) this.applyFrame();
    }
  }

  update(dt, camera) {
    if (this.meta) {
      this.t += dt * this.speed;
      const spf = 1 / this.fps;
      while (this.t >= spf) {
        this.t -= spf;
        if (this.frame < this.meta.frames.length - 1) {
          this.frame++;
          this.applyFrame();
        } else if (this.loop) {
          this.frame = 0;
          this.applyFrame();
        } else {
          if (this.onEnd) {
            const cb = this.onEnd;
            this.onEnd = null;
            cb();
          }
          break;
        }
      }
    }
    if (camera) this.face(camera);
  }

  face(camera) {
    // cylindrical billboard + partial tilt toward the camera pitch
    const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    this.pivot.rotation.set(e.x * this.tiltFactor, e.y, 0, 'YXZ');
  }

  get position() {
    return this.root.position;
  }

  height() {
    if (!this.meta) return 1.5;
    return this.meta.ay * PX * this.scale;
  }

  dispose() {
    this.tex.dispose();
    this.mat.dispose();
  }
}

let _blob = null;
export function blobTexture() {
  if (_blob) return _blob;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.6)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  _blob = new THREE.CanvasTexture(c);
  return _blob;
}

// translucent additive copy of a sprite – used for the "Echo" spirit that
// overlaps a hero in battle
export class GhostSprite {
  constructor(name, color = 0x66ccff) {
    const a = assets.atlas[name];
    this.atlas = a;
    this.tex = a.tex.clone();
    this.tex.needsUpdate = true;
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex, color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(_geo, this.mat);
    this.mesh.renderOrder = 5;
    this.root = new THREE.Group();
    this.root.add(this.mesh);
    this.anim = null;
    this.frame = 0;
    this.t = 0;
  }

  play(anim) {
    const m = this.atlas.meta.anims[anim];
    if (!m) return;
    this.anim = anim;
    this.meta = m;
    this.frame = 0;
    this.t = 0;
    this.apply(false);
  }

  apply(flip) {
    const m = this.meta;
    const [x, y, w, h] = m.frames[this.frame];
    const W = this.atlas.w, H = this.atlas.h;
    const s = PX * 1.04;
    this.mesh.scale.set(w * s, h * s, 1);
    const ox = (w / 2 - m.ax) * s;
    this.mesh.position.set(flip ? -ox : ox, (m.ay - h / 2) * s, 0);
    if (flip) {
      this.tex.repeat.set(-w / W, h / H);
      this.tex.offset.set((x + w) / W, 1 - (y + h) / H);
    } else {
      this.tex.repeat.set(w / W, h / H);
      this.tex.offset.set(x / W, 1 - (y + h) / H);
    }
  }

  update(dt, flip, camera, pulse) {
    if (!this.meta) return;
    this.t += dt;
    if (this.t > 1 / this.meta.fps) {
      this.t = 0;
      this.frame = (this.frame + 1) % this.meta.frames.length;
    }
    this.apply(flip);
    if (camera) {
      const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
      this.root.rotation.set(e.x * 0.45, e.y, 0, 'YXZ');
    }
    this.mat.opacity = 0.2 + 0.07 * Math.sin(pulse * 3);
  }

  sync() {}
}
