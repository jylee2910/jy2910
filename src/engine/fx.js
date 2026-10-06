// Sprite-sheet effects (additive billboards) from the fx atlas, plus
// helper meshes: magic circles, light rays, flashes.
import * as THREE from 'three';
import { assets } from './assets.js';
import { PX } from './sprite.js';

export class FXLayer {
  constructor(scene) {
    this.scene = scene;
    this.live = [];
    const meta = assets.json['fx/fx.json'];
    this.meta = meta;
    this.tex = assets.images['fx/fx.json'];
  }

  frameTex(rect) {
    const t = this.tex.clone();
    t.needsUpdate = true;
    this.setRect(t, rect);
    return t;
  }

  setRect(t, [x, y, w, h], flip = false) {
    const [W, H] = this.meta.size;
    if (flip) {
      t.repeat.set(-w / W, h / H);
      t.offset.set((x + w) / W, 1 - (y + h) / H);
    } else {
      t.repeat.set(w / W, h / H);
      t.offset.set(x / W, 1 - (y + h) / H);
    }
  }

  // play an animated effect at a world position
  play(name, pos, o = {}) {
    const a = this.meta?.anims[name];
    if (!a) return Promise.resolve();
    const [, , w, h] = a.frames[0];
    const t = this.frameTex(a.frames[0]);
    const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: o.depthTest ?? true, color: o.color ?? 0xffffff, side: THREE.DoubleSide, fog: false });
    const s = (o.scale ?? 1.6) * PX;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w * s, h * s), mat);
    mesh.position.copy(pos);
    if (o.anchorBottom) mesh.geometry.translate(0, (h * s) / 2, 0);
    mesh.renderOrder = 20;
    if (o.rot) mesh.userData.rot = o.rot;
    this.scene.add(mesh);
    return new Promise((res) => {
      this.live.push({ mesh, a, t, k: 0, time: 0, fps: (o.fps ?? a.fps) * (o.speed ?? 1), flip: !!o.flip, res, light: o.light, ry: o.ry });
    });
  }

  // a flat ground decal (magic circle) that spins and fades
  circle(pos, o = {}) {
    const rect = this.meta?.single[o.gold ? 'circle_gold' : 'circle'];
    if (!rect) return null;
    const t = this.frameTex(rect);
    const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: o.color ?? 0xffffff, opacity: 0, fog: false });
    const size = o.size ?? 2.4;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(pos).add(new THREE.Vector3(0, 0.04, 0));
    mesh.renderOrder = 4;
    this.scene.add(mesh);
    const obj = { mesh, life: o.life ?? 1.6, time: 0, spin: o.spin ?? 1.2, decal: true };
    this.live.push(obj);
    return obj;
  }

  // vertical light shaft
  ray(pos, o = {}) {
    const rect = this.meta?.single.ray;
    if (!rect) return null;
    const t = this.frameTex(rect);
    const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: o.color ?? 0xfff2c0, opacity: 0, fog: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(o.w ?? 1.4, o.h ?? 9), mat);
    mesh.geometry.translate(0, (o.h ?? 9) / 2, 0);
    mesh.position.copy(pos);
    mesh.renderOrder = 6;
    this.scene.add(mesh);
    const obj = { mesh, life: o.life ?? 1.5, time: 0, ray: true, peak: o.opacity ?? 0.8, billboard: true };
    this.live.push(obj);
    return obj;
  }

  glow(pos, o = {}) {
    const rect = this.meta?.single.glow;
    if (!rect) return null;
    const t = this.frameTex(rect);
    const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: o.color ?? 0xffffff, opacity: o.opacity ?? 1, fog: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(o.size ?? 2, o.size ?? 2), mat);
    mesh.position.copy(pos);
    mesh.renderOrder = 21;
    this.scene.add(mesh);
    const obj = { mesh, life: o.life ?? 0.6, time: 0, glow: true, peak: o.opacity ?? 1, billboard: true, grow: o.grow ?? 1.5 };
    this.live.push(obj);
    return obj;
  }

  update(dt, camera) {
    const keep = [];
    for (const f of this.live) {
      if (f.decal) {
        f.time += dt;
        const k = f.time / f.life;
        f.mesh.rotation.z += dt * f.spin;
        f.mesh.material.opacity = Math.min(1, k * 5) * Math.min(1, (1 - k) * 3) * 0.9;
        if (k >= 1) {
          this.dispose(f);
          continue;
        }
        keep.push(f);
        continue;
      }
      if (f.billboard) {
        f.time += dt;
        const k = f.time / f.life;
        f.mesh.quaternion.copy(camera.quaternion);
        if (f.ray) {
          const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
          f.mesh.rotation.set(0, e.y, 0);
          f.mesh.material.opacity = Math.sin(Math.min(1, k) * Math.PI) * f.peak;
        } else {
          f.mesh.material.opacity = (1 - k) * f.peak;
          const s = 1 + k * (f.grow - 1);
          f.mesh.scale.setScalar(s);
        }
        if (k >= 1) {
          this.dispose(f);
          continue;
        }
        keep.push(f);
        continue;
      }
      f.time += dt;
      f.mesh.quaternion.copy(camera.quaternion);
      if (f.mesh.userData.rot) f.mesh.rotateZ(f.mesh.userData.rot);
      const spf = 1 / f.fps;
      let done = false;
      while (f.time >= spf) {
        f.time -= spf;
        f.k++;
        if (f.k >= f.a.frames.length) {
          done = true;
          break;
        }
        this.setRect(f.t, f.a.frames[f.k], f.flip);
      }
      if (done) {
        this.dispose(f);
        f.res();
        continue;
      }
      keep.push(f);
    }
    this.live = keep;
  }

  dispose(f) {
    this.scene.remove(f.mesh);
    f.mesh.geometry.dispose();
    f.mesh.material.map?.dispose();
    f.mesh.material.dispose();
  }

  clear() {
    for (const f of this.live) {
      this.dispose(f);
      f.res?.();
    }
    this.live = [];
  }
}
