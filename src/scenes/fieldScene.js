// Overworld exploration scene: diorama camera, free movement, symbol
// encounters, event triggers, HUD (chapter / objective / minimap).
import * as THREE from 'three';
import { audio } from '../engine/audio.js';
import { FXLayer } from '../engine/fx.js';
import { input } from '../engine/input.js';
import { SpriteActor } from '../engine/sprite.js';
import { setupLights, setFog } from '../world/env.js';
import { buildField, PATH, SPOTS } from '../world/fieldmap.js';
import { ambientMotes, fireflies, ParticleSystem } from '../world/particles.js';
import { updatePropsTime } from '../world/props.js';
import { Sky } from '../world/sky.js';
import { el, icon, toScreen } from '../ui/dom.js';
import { EventRunner } from './events.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

const ROAMERS = [
  { sprite: 'm_wolf', troop: 'plains_mix', x: 8, z: 22, r: 4 },
  { sprite: 'm_ember', troop: 'embers', x: -28, z: 10, r: 3 },
  { sprite: 'm_crawler', troop: 'crawler', x: 45, z: -6, r: 3 },
  { sprite: 'm_imp', troop: 'plains_mix', x: -12, z: 24, r: 4 },
  { sprite: 'm_wolf', troop: 'wolves', x: 48, z: 16, r: 4 },
];

const TRIGGERS = [
  { id: 'imp_ambush', x: -4, z: -12, r: 3.6, need: [] },
  { id: 'meet', x: 26.5, z: 9.5, r: 5.5, need: ['imp_ambush'] },
];

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
    this.groundAt = (x, z) => this.map.groundAt(x, z);
    this.particles = new ParticleSystem(1500, { soft: true });
    this.scene.add(this.particles.points);
    ambientMotes(this.particles, V(0, 0, 0), 60, { rate: 10, color: [1, 0.97, 0.85, 0.5], size: 0.07 });
    fireflies(this.particles, V(38, 2.5, 32), 14);
    this.fx = new FXLayer(this.scene);
    // crystal glow light at the shrine
    this.crystalLight = new THREE.PointLight(0x7ad8ff, 18, 14, 1.8);
    this.crystalLight.position.set(SPOTS.crystal[0], 5.5, SPOTS.crystal[1]);
    this.scene.add(this.crystalLight);
    this.crystalPulse = 0;

    this.player = new SpriteActor(game.state.leaderSprite());
    this.player.play('down.idle');
    const [sx, sz] = game.state.fieldPos || SPOTS.start;
    this.player.position.set(sx, this.map.groundAt(sx, sz), sz);
    this.scene.add(this.player.root);
    this.facing = 'down';
    this.camYaw = 0;
    this.camDist = 26;
    this.camHeight = 13;
    this.camTarget = this.player.position.clone();
    this.camPos = V(0, 0, 0);
    this.camLook = V(0, 0, 0);
    this.cinematic = false;
    this.shakeAmt = 0;
    this.actors = [];
    this.time = 0;
    this.control = true;
    this.events = new EventRunner(this);
    this.roamers = [];
    this.spawnRoamers();
    this.stepT = 0;
  }

  // ----------------------------------------------------------------- actors
  spawn(name, x, z, anim = 'down.idle') {
    const a = new SpriteActor(name, { blobSize: 0.45 });
    a.play(anim);
    a.position.set(x, this.groundAt(x, z), z);
    this.scene.add(a.root);
    this.actors.push(a);
    return a;
  }

  spawnMonster(name, x, z, big = false) {
    const a = new SpriteActor(name, { blobSize: big ? 2.0 : 0.8, emissive: 0.25, tilt: 0.3 });
    a.play('battle.idle');
    a.position.set(x, this.groundAt(x, z), z);
    this.scene.add(a.root);
    this.actors.push(a);
    return a;
  }

  removeActor(a) {
    this.scene.remove(a.root);
    this.actors = this.actors.filter((x) => x !== a);
  }

  spawnRoamers() {
    for (const r of ROAMERS) {
      const a = this.spawnMonster(r.sprite, r.x, r.z);
      a.root.scale.setScalar(0.85);
      this.roamers.push({ ...r, a, tx: r.x, tz: r.z, wait: Math.random() * 2, cool: 0, alive: true });
    }
  }

  // ----------------------------------------------------------------- lifecycle
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
    post.grade.tint.value = 0;
    post.grade.flash.value = 0;
    this.buildHUD();
    this.updateCamera(1);
    audio.play(this.game.state.flags.shrine && !this.game.state.flags.chapter1 ? 'shrine' : 'field');
    if (!this.game.state.flags.field_start) this.events.run('field_start');
  }

  exit() {
    this.hud?.root.remove();
    this.hud = null;
  }

  resume() {
    this.enter();
  }

  // ----------------------------------------------------------------- HUD
  buildHUD() {
    const root = el('div', 'field-hud np');
    document.getElementById('ui').appendChild(root);
    const ch = el('div', 'chapter');
    root.appendChild(ch);
    const mm = el('div', 'minimap panel thin');
    root.appendChild(mm);
    const cv = document.createElement('canvas');
    cv.width = 220;
    cv.height = 170;
    mm.appendChild(cv);
    const prompt = el('div', 'prompt');
    prompt.style.display = 'none';
    root.appendChild(prompt);
    const help = el('div', 'footer', `<span><span class="k">WASD</span>이동</span><span><span class="k">Shift</span>달리기</span><span><span class="k">Z</span>조사</span><span><span class="k">M</span>메뉴</span>`);
    root.appendChild(help);
    this.hud = {
      root, ch, cv, prompt,
      update: () => {
        ch.innerHTML = `<div class="c1">${icon('echo')}제${this.game.state.chapter}장 공명의 시작</div><div class="c2">${this.game.state.objective}</div>`;
      },
    };
    this.hud.update();
    this.mapImg = this.mapImg || this.renderMinimapBase();
  }

  renderMinimapBase() {
    const t = this.map.terrain;
    const c = document.createElement('canvas');
    const W = 132, H = 116;
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    const img = g.createImageData(W, H);
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++) {
        const x = -66 + i, z = -58 + j;
        const h = t.heightAt(x, z);
        const s = t.slopeAt(x, z);
        let col = [86, 140, 70];
        if (h < -0.5) col = [60, 130, 190];
        else if (s > 0.8) col = [120, 104, 96];
        else col = [70 + h * 12, 120 + h * 10, 62 + h * 6];
        const k = (j * W + i) * 4;
        img.data[k] = col[0];
        img.data[k + 1] = col[1];
        img.data[k + 2] = col[2];
        img.data[k + 3] = 255;
      }
    g.putImageData(img, 0, 0);
    g.strokeStyle = 'rgba(210,170,110,0.9)';
    g.lineWidth = 1.6;
    g.beginPath();
    PATH.forEach(([x, z], i) => (i ? g.lineTo(x + 66, z + 58) : g.moveTo(x + 66, z + 58)));
    g.stroke();
    g.fillStyle = '#c8d0e0';
    g.fillRect(66 - 18, 58 - 46, 36, 14);
    return c;
  }

  drawMinimap() {
    const cv = this.hud.cv, g = cv.getContext('2d');
    const p = this.player.position;
    const s = 2.2; // px per metre
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#0a1426';
    g.fillRect(0, 0, cv.width, cv.height);
    g.save();
    g.translate(cv.width / 2 - (p.x + 66) * s, cv.height / 2 - (p.z + 58) * s);
    g.scale(s, s);
    g.drawImage(this.mapImg, 0, 0);
    g.restore();
    const toMap = (x, z) => [cv.width / 2 + (x - p.x) * s, cv.height / 2 + (z - p.z) * s];
    // objective marker
    const obj = this.objectivePos();
    if (obj) {
      const [ox, oy] = toMap(obj[0], obj[1]);
      const cx = Math.max(8, Math.min(cv.width - 8, ox)), cy = Math.max(8, Math.min(cv.height - 8, oy));
      g.fillStyle = 'rgba(255,90,110,0.35)';
      g.beginPath();
      g.arc(cx, cy, 9 + Math.sin(this.time * 4) * 2, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#ff5a6e';
      g.beginPath();
      g.arc(cx, cy, 4, 0, Math.PI * 2);
      g.fill();
    }
    for (const r of this.roamers) {
      if (!r.alive) continue;
      const [rx, ry] = toMap(r.a.position.x, r.a.position.z);
      g.fillStyle = '#ff9a3a';
      g.fillRect(rx - 2, ry - 2, 4, 4);
    }
    // player arrow
    g.save();
    g.translate(cv.width / 2, cv.height / 2);
    const ang = { down: 0, up: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 }[this.facing];
    g.rotate(ang);
    g.fillStyle = '#fff';
    g.strokeStyle = '#1a2a4a';
    g.beginPath();
    g.moveTo(0, 6);
    g.lineTo(-4.5, -4);
    g.lineTo(4.5, -4);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  }

  objectivePos() {
    const f = this.game.state.flags;
    if (!f.imp_ambush) return [-4, -12];
    if (!f.meet) return [27, 10];
    if (!f.shrine) return SPOTS.crystal;
    return null;
  }

  // ----------------------------------------------------------------- update
  updateCamera(k = 0.08) {
    const p = this.player.position;
    if (!this.cinematic) {
      this.camTarget.lerp(V(p.x, p.y + 1.0, p.z), k);
      const off = V(Math.sin(this.camYaw) * this.camDist, this.camHeight, Math.cos(this.camYaw) * this.camDist);
      this.camPos.copy(this.camTarget).add(off);
      this.camLook.copy(this.camTarget);
    }
    const sh = this.shakeAmt;
    this.camera.position.copy(this.camPos).add(V((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh, 0));
    this.camera.lookAt(this.camLook);
    this.game.renderer.post.dof.focusDist.value = this.camera.position.distanceTo(this.cinematic ? this.camLook : p);
    this.lights.follow(V(this.camLook.x, 0, this.camLook.z));
  }

  update(dt) {
    this.time += dt;
    this.events.update(dt);
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 1.2);
    const free = this.control && !this.events.busy && !this.game.modal;
    if (free) this.handleMove(dt);
    else if (!this.events.busy) this.player.play((this.facing === 'right' ? 'left' : this.facing) + '.idle');
    this.player.update(dt, this.camera);
    for (const a of this.actors) a.update(dt, this.camera);
    this.updateRoamers(dt, free);
    if (free) this.checkTriggers();
    this.updateCamera(1 - Math.pow(0.001, dt));
    this.map.water.update(this.time);
    for (const f of this.map.falls) f.update(this.time);
    this.map.props.update(this.camera);
    updatePropsTime(this.time);
    this.sky.update(this.time, this.camera.position);
    this.particles.update(dt);
    this.fx.update(dt, this.camera);
    const glow = this.game.state.flags.chapter1 ? 1 : 0.35;
    this.crystalLight.intensity = 10 * glow + Math.sin(this.time * 2) * 2 + this.crystalPulse * 25;
    this.crystalPulse = Math.max(0, this.crystalPulse - dt * 0.6);
    if (this.hud) {
      this.drawMinimap();
      this.updatePrompt(free);
    }
    if (free && input.pressed('menu')) this.game.openMenu();
  }

  updatePrompt(free) {
    const p = this.player.position;
    const c = SPOTS.crystal;
    const near = Math.hypot(p.x - c[0], p.z - c[1]) < 5.8;
    const pr = this.hud.prompt;
    if (free && near) {
      const s = toScreen(V(c[0], p.y + 4.2, c[1]), this.camera);
      pr.style.display = 'block';
      pr.style.left = s.x + 'px';
      pr.style.top = s.y + 'px';
      pr.innerHTML = `<span class="k">Z</span>크리스탈을 조사한다`;
      if (input.pressed('ok')) {
        if (this.game.state.flags.meet && !this.game.state.flags.shrine) this.events.run('shrine');
        else if (this.game.state.flags.chapter1) {
          this.game.state.healAll();
          this.game.state.save();
          audio.sfx('heal');
          this.fx.play('heal', this.player.position.clone(), { scale: 1.4, anchorBottom: true });
          import('../ui/dialogue.js').then((m) => m.toast('크리스탈의 빛이 파티를 치유했다. <b>기록 완료.</b>'));
        } else import('../ui/dialogue.js').then((m) => m.toast('크리스탈이 희미하게 깜빡이고 있다…'));
      }
    } else pr.style.display = 'none';
  }

  checkTriggers() {
    const p = this.player.position;
    const f = this.game.state.flags;
    for (const t of TRIGGERS) {
      if (f[t.id] || !t.need.every((n) => f[n])) continue;
      if (Math.hypot(p.x - t.x, p.z - t.z) < t.r) {
        this.events.run(t.id);
        return;
      }
    }
  }

  updateRoamers(dt, free) {
    const p = this.player.position;
    for (const r of this.roamers) {
      const a = r.a;
      if (!r.alive) {
        r.cool -= dt;
        if (r.cool <= 0 && Math.hypot(p.x - r.x, p.z - r.z) > 18) {
          r.alive = true;
          a.root.visible = true;
          a.position.set(r.x, this.groundAt(r.x, r.z), r.z);
        }
        continue;
      }
      const d = Math.hypot(p.x - a.position.x, p.z - a.position.z);
      let tx = r.tx, tz = r.tz, sp = 1.2;
      if (free && d < 6.5 && this.game.state.flags.imp_ambush) {
        tx = p.x;
        tz = p.z;
        sp = 3.4;
      } else if (Math.hypot(tx - a.position.x, tz - a.position.z) < 0.3) {
        r.wait -= dt;
        if (r.wait <= 0) {
          const ang = Math.random() * Math.PI * 2, rr = Math.random() * r.r;
          r.tx = r.x + Math.cos(ang) * rr;
          r.tz = r.z + Math.sin(ang) * rr;
          r.wait = 1 + Math.random() * 2.5;
        }
        continue;
      }
      if (!free) continue;
      const dx = tx - a.position.x, dz = tz - a.position.z;
      const l = Math.hypot(dx, dz) || 1;
      const nx = a.position.x + (dx / l) * sp * dt, nz = a.position.z + (dz / l) * sp * dt;
      if (this.map.walk(nx, nz, 0.4)) {
        a.position.x = nx;
        a.position.z = nz;
        a.position.y = this.groundAt(nx, nz);
      }
      a.setFlip(dx < 0);
      if (free && d < 1.3) this.encounter(r);
    }
  }

  async encounter(r) {
    r.alive = false;
    r.cool = 40;
    r.a.root.visible = false;
    this.control = false;
    audio.sfx('encounter');
    const res = await this.game.battle(r.troop);
    this.control = true;
    if (res === 'lose') this.game.gameOver();
    else if (res === 'escape') r.cool = 6;
  }

  handleMove(dt) {
    const a = input.axis();
    const running = input.held('run');
    const sp = (running ? 7.5 : 4.6) * dt;
    if (Math.hypot(a.x, a.y) > 0.1) {
      const cs = Math.cos(this.camYaw), sn = Math.sin(this.camYaw);
      const dx = a.x * cs + a.y * sn, dz = -a.x * sn + a.y * cs;
      const p = this.player.position;
      const nx = p.x + dx * sp, nz = p.z + dz * sp;
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
      this.player.speed = running ? 1.6 : 1;
      this.game.state.fieldPos = [p.x, p.z];
      this.stepT += dt * (running ? 1.6 : 1);
      if (this.stepT > 0.3) {
        this.stepT = 0;
        audio.sfx('step');
      }
    } else {
      const view = this.facing === 'right' ? 'left' : this.facing;
      this.player.play(view + '.idle');
      this.player.speed = 1;
    }
  }
}
