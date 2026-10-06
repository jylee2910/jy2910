// Overworld exploration scene.
import * as THREE from 'three';
import { input } from '../engine/input.js';
import { SpriteActor } from '../engine/sprite.js';
import { setupLights, setFog } from '../world/env.js';
import { buildField, SPOTS } from '../world/fieldmap.js';
import { ambientMotes, ParticleSystem } from '../world/particles.js';
import { updatePropsTime } from '../world/props.js';
import { Sky } from '../world/sky.js';

export class FieldScene {
  constructor(game) {
    this.game = game;
    this.scene = new THREE.Scene();
    setFog(this.scene, 0xb8d6ec, 40, 120);
    this.camera = new THREE.PerspectiveCamera(26, 16 / 9, 0.5, 600);
    this.sky = new Sky('day');
    this.scene.add(this.sky.mesh);
    this.lights = setupLights(this.scene, { sunDir: [-18, 26, 10], shadowSize: 34, hemi: 0.75, sunI: 2.1, sky: 0xbcd4f4, ground: 0x6a5a48 });
    this.map = buildField();
    this.scene.add(this.map.group);
    this.particles = new ParticleSystem(1500, { soft: true });
    this.scene.add(this.particles.points);
    ambientMotes(this.particles, new THREE.Vector3(0, 0, 0), 60, { rate: 10, color: [1, 0.97, 0.85, 0.5], size: 0.07 });
    // leader
    this.player = new SpriteActor(game.party.leaderSprite());
    this.player.play('down.idle');
    const [sx, sz] = game.state.fieldPos || SPOTS.start;
    this.player.position.set(sx, this.map.groundAt(sx, sz), sz);
    this.scene.add(this.player.root);
    this.facing = 'down';
    this.camYaw = 0;
    this.camDist = 26;
    this.camHeight = 13;
    this.camTarget = new THREE.Vector3().copy(this.player.position);
    this.actors = [];
    this.time = 0;
    this.control = true;
  }

  enter() {
    const post = this.game.renderer.post;
    post.dof.enabled.value = 1;
    post.dof.maxBlur.value = 8;
    post.dof.focusRange.value = 9;
    post.dof.tilt.value = 0.35;
    post.dof.tiltWidth.value = 0.25;
    post.dof.tiltCenter.value = 0.45;
    post.bloom.strength = 0.45;
    post.bloom.threshold = 0.85;
    post.grade.vignette.value = 0.5;
    post.grade.letterbox.value = 0;
    this.updateCamera(1);
  }

  updateCamera(k = 0.08) {
    const p = this.player.position;
    this.camTarget.lerp(new THREE.Vector3(p.x, p.y + 1.0, p.z), k);
    const off = new THREE.Vector3(Math.sin(this.camYaw) * this.camDist, this.camHeight, Math.cos(this.camYaw) * this.camDist);
    this.camera.position.copy(this.camTarget).add(off);
    this.camera.lookAt(this.camTarget);
    this.game.renderer.post.dof.focusDist.value = this.camera.position.distanceTo(p);
    this.lights.follow(new THREE.Vector3(p.x, 0, p.z));
  }

  update(dt) {
    this.time += dt;
    if (this.control) this.handleMove(dt);
    this.player.update(dt, this.camera);
    for (const a of this.actors) a.update(dt, this.camera);
    this.updateCamera(1 - Math.pow(0.001, dt));
    this.map.water.update(this.time);
    for (const f of this.map.falls) f.update(this.time);
    this.map.props.update(this.camera);
    updatePropsTime(this.time);
    this.sky.update(this.time, this.camera.position);
    this.particles.update(dt);
  }

  handleMove(dt) {
    const a = input.axis();
    const sp = (input.held('run') ? 7.5 : 4.6) * dt;
    if (Math.hypot(a.x, a.y) > 0.1) {
      // camera-relative movement
      const cs = Math.cos(this.camYaw), sn = Math.sin(this.camYaw);
      const dx = a.x * cs + a.y * sn, dz = -a.x * sn + a.y * cs;
      const p = this.player.position;
      let nx = p.x + dx * sp, nz = p.z + dz * sp;
      if (this.map.walk(nx, nz)) {
        p.x = nx;
        p.z = nz;
      } else if (this.map.walk(nx, p.z)) p.x = nx;
      else if (this.map.walk(p.x, nz)) p.z = nz;
      p.y = this.map.groundAt(p.x, p.z);
      if (Math.abs(a.x) > Math.abs(a.y) * 0.8) this.facing = a.x < 0 ? 'left' : 'right';
      else this.facing = a.y < 0 ? 'up' : 'down';
      const view = this.facing === 'right' ? 'left' : this.facing;
      this.player.setFlip(this.facing === 'right');
      this.player.play(view + '.walk');
      this.player.speed = input.held('run') ? 1.6 : 1;
    } else {
      const view = this.facing === 'right' ? 'left' : this.facing;
      this.player.play(view + '.idle');
      this.player.speed = 1;
    }
  }
}
