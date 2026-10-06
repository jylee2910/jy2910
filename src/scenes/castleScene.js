// Throne room of Castle Granvale – opening audience with the King.
import * as THREE from 'three';
import { audio } from '../engine/audio.js';
import { FXLayer } from '../engine/fx.js';
import { SpriteActor } from '../engine/sprite.js';
import { box, cylinder, texMat } from '../world/buildings.js';
import { ambientMotes, ParticleSystem } from '../world/particles.js';
import { PropField, updatePropsTime } from '../world/props.js';
import { TILE } from '../world/terrain.js';
import { EventRunner } from './events.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export class CastleScene {
  constructor(game, opts = {}) {
    this.game = game;
    this.opts = opts;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05060c);
    this.scene.fog = new THREE.Fog(0x0a0c18, 18, 60);
    this.camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.3, 200);
    this.time = 0;
    this.build();
    this.fx = new FXLayer(this.scene);
    this.actors = [];
    this.events = new EventRunner(this);
    this.camPos = V(0, 3.6, 9.5);
    this.camLook = V(0, 1.6, -4);
  }

  build() {
    const s = this.scene;
    const hemi = new THREE.HemisphereLight(0x8a94c8, 0x2a1a14, 0.55);
    s.add(hemi);
    // cool moonlit window light
    const dir = new THREE.DirectionalLight(0xc8d8ff, 1.4);
    dir.position.set(-14, 16, 4);
    dir.target.position.set(0, 0, -8);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    Object.assign(dir.shadow.camera, { left: -16, right: 16, top: 20, bottom: -20, near: 1, far: 60 });
    dir.shadow.bias = -0.0005;
    s.add(dir, dir.target);

    const W = 18, L = 34, H = 10;
    const z0 = 7, z1 = z0 - L;
    // floor
    const floor = box(W, 0.2, L, 'marble', 'marble');
    floor.position.set(0, -0.2, (z0 + z1) / 2);
    s.add(floor);
    // carpet runner
    const carpetTex = texMat('carpet');
    const cg = new THREE.PlaneGeometry(3.0, L - 9);
    const uv = cg.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), (uv.getY(i) * (L - 9)) / (TILE * 1.4));
    const carpet = new THREE.Mesh(cg, carpetTex);
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.set(0, 0.012, z0 - (L - 9) / 2);
    carpet.receiveShadow = true;
    s.add(carpet);
    // walls
    for (const sx of [-1, 1]) {
      const w = box(1, H, L, 'castle_wall', 'castle_floor');
      w.position.set(sx * (W / 2 + 0.5), 0, (z0 + z1) / 2);
      s.add(w);
    }
    const back = box(W + 2, H, 1, 'castle_wall', 'castle_floor');
    back.position.set(0, 0, z1 - 0.5);
    s.add(back);
    const ceil = box(W + 2, 0.5, L, 'castle_wall', 'castle_wall');
    ceil.position.set(0, H, (z0 + z1) / 2);
    s.add(ceil);
    // dais with steps
    const daisZ = z1 + 6.5;
    const dais = box(12, 1.25, 7, 'castle_floor', 'marble');
    dais.position.set(0, 0, daisZ - 3.5 + 0.5);
    s.add(dais);
    for (let i = 0; i < 5; i++) {
      const st = box(6 - i * 0.2, 0.25 * (i + 1), 0.45, 'castle_floor', 'marble');
      st.position.set(0, 0, daisZ + 0.4 + (4 - i) * 0.45);
      s.add(st);
    }
    const dcarpet = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 5.6), carpetTex);
    dcarpet.rotation.x = -Math.PI / 2;
    dcarpet.position.set(0, 1.27, daisZ - 2.8 + 0.5);
    s.add(dcarpet);
    this.daisZ = daisZ;

    // pillars + arched windows with light shafts
    const props = new PropField();
    this.props = props;
    for (let k = 0; k < 6; k++) {
      const z = z0 - 3 - k * 4.2;
      for (const sx of [-1, 1]) {
        const p = cylinder(0.55, H, 'marble', 'marble', 14);
        p.position.set(sx * 5.4, 0, z);
        s.add(p);
        const b = box(1.6, 0.6, 1.6, 'castle_floor', 'marble');
        b.position.set(sx * 5.4, 0, z);
        s.add(b);
        const cap = box(1.5, 0.5, 1.5, 'castle_floor', 'marble');
        cap.position.set(sx * 5.4, H - 0.5, z);
        s.add(cap);
        // window between pillars
        if (k < 5) {
          const wz = z - 2.1;
          const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 4.6), new THREE.MeshBasicMaterial({ color: 0x9ab8ff, fog: false }));
          win.position.set(sx * (W / 2 - 0.01), 5.2, wz);
          win.rotation.y = -sx * Math.PI / 2;
          s.add(win);
          const top = new THREE.Mesh(new THREE.CircleGeometry(0.8, 16, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0x9ab8ff, fog: false }));
          top.position.set(sx * (W / 2 - 0.01), 7.5, wz);
          top.rotation.y = -sx * Math.PI / 2;
          s.add(top);
          if (sx < 0) this.addShaft(V(sx * (W / 2 - 0.2), 7.2, wz), sx);
        }
        // banners hang on pillars
        if (k % 2 === 1) props.add(k === 3 ? 'banner_blue' : 'banner_red', sx * 4.75, 2.6, z, { flip: false, scale: 1.0 });
      }
    }
    // braziers along the carpet with warm point lights
    this.lights = [];
    for (const [x, z] of [[-3.6, -1], [3.6, -1], [-3.6, -11], [3.6, -11], [-3.2, z1 + 7.5], [3.2, z1 + 7.5]]) {
      props.add('torch', x, 0, z, { flip: false, scale: 1.0 });
      const l = new THREE.PointLight(0xffa050, 7, 8, 1.8);
      l.position.set(x, 2.5, z);
      s.add(l);
      this.lights.push(l);
    }
    props.add('throne', 0, 1.25, daisZ - 4.6, { flip: false, scale: 1.9 });
    props.add('banner_blue', -2.6, 4.2, z1 + 0.6, { flip: false, scale: 1.6 });
    props.add('banner_blue', 2.6, 4.2, z1 + 0.6, { flip: false, scale: 1.6 });
    props.add('banner_red', 0, 6.4, z1 + 0.6, { flip: false, scale: 2.0 });
    props.build();
    s.add(props.group);
    const tl = new THREE.PointLight(0xffe0b0, 12, 12, 1.6);
    tl.position.set(0, 5, daisZ - 2);
    s.add(tl);

    this.particles = new ParticleSystem(800, { soft: true });
    s.add(this.particles.points);
    ambientMotes(this.particles, V(0, 0, -8), 14, { rate: 10, size: 0.05, h: 7, color: [0.85, 0.9, 1.0, 0.45] });
  }

  addShaft(pos, sx) {
    // slanted volumetric light shaft (additive plane)
    const g = new THREE.PlaneGeometry(1.8, 11);
    g.translate(0, -5.5, 0);
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 128;
    const x = c.getContext('2d');
    const gr = x.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, 'rgba(200,220,255,0.55)');
    gr.addColorStop(1, 'rgba(200,220,255,0)');
    x.fillStyle = gr;
    x.fillRect(0, 0, 32, 128);
    const hg = x.createLinearGradient(0, 0, 32, 0);
    hg.addColorStop(0, 'rgba(0,0,0,1)');
    hg.addColorStop(0.5, 'rgba(0,0,0,0)');
    hg.addColorStop(1, 'rgba(0,0,0,1)');
    x.globalCompositeOperation = 'destination-out';
    x.fillStyle = hg;
    x.fillRect(0, 0, 32, 128);
    const t = new THREE.CanvasTexture(c);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: t, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5, side: THREE.DoubleSide, fog: false }));
    m.position.copy(pos);
    m.rotation.set(0, Math.PI / 2, -sx * 0.62);
    this.scene.add(m);
    const m2 = m.clone();
    m2.rotation.y = Math.PI / 2 + 0.6;
    m2.material = m.material.clone();
    m2.material.opacity = 0.25;
    this.scene.add(m2);
  }

  spawn(name, x, z, anim = 'down.idle', opts = {}) {
    const a = new SpriteActor(name, { blobSize: 0.45, emissive: 0.3, ...opts });
    a.play(anim);
    a.position.set(x, opts.y ?? 0, z);
    this.scene.add(a.root);
    this.actors.push(a);
    return a;
  }

  enter() {
    const post = this.game.renderer.post;
    post.dof.enabled.value = 1;
    post.dof.maxBlur.value = 7;
    post.dof.focusRange.value = 8;
    post.dof.tilt.value = 0.25;
    post.dof.tiltWidth.value = 0.28;
    post.dof.tiltCenter.value = 0.5;
    post.bloom.strength = 0.5;
    post.bloom.threshold = 0.86;
    post.grade.vignette.value = 0.7;
    post.grade.letterbox.value = 0;
    audio.play('castle');
    // cast
    this.king = this.spawn('king', 0, this.daisZ - 4.1, 'down.idle', { y: 1.55 });
    this.argen = this.spawn('argen', -2.4, this.daisZ + 3.2, 'down.idle');
    this.soldiers = [];
    for (let k = 0; k < 4; k++) {
      for (const sx of [-1, 1]) {
        const s = this.spawn('soldier', sx * 2.4, 2 - k * 3.6, 'left.idle');
        s.setFlip(sx < 0);
        this.soldiers.push(s);
      }
    }
    this.player = this.spawn('kael', 0, 6, 'up.idle');
    this.applyCamera();
    this.events.run(this.opts.script || 'audience');
  }

  exit() {}

  applyCamera() {
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    const tgt = this.player ? this.player.position : this.camLook;
    this.game.renderer.post.dof.focusDist.value = this.camera.position.distanceTo(tgt);
  }

  update(dt) {
    this.time += dt;
    this.events.update(dt);
    for (const a of this.actors) a.update(dt, this.camera);
    this.applyCamera();
    this.props.update(this.camera);
    updatePropsTime(this.time);
    this.fx.update(dt, this.camera);
    this.particles.update(dt);
    // torch flicker
    this.lights.forEach((l, i) => (l.intensity = 6.5 + Math.sin(this.time * 9 + i * 2) * 0.8 + Math.sin(this.time * 23 + i) * 0.5));
  }
}
