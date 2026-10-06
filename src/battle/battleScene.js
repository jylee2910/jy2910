// Battle scene: stages the logic from battle/logic.js in 3D with
// camera direction, sprite animation, FX and the HUD.
import * as THREE from 'three';
import { ECHOES, SKILLS, expForLevel } from '../data/db.js';
import { audio } from '../engine/audio.js';
import { FXLayer } from '../engine/fx.js';
import { input } from '../engine/input.js';
import { GhostSprite, PX, SpriteActor } from '../engine/sprite.js';
import { updatePropsTime } from '../world/props.js';
import { BattleUI } from '../ui/battleUI.js';
import { sleep } from '../ui/dom.js';
import { buildArena } from './arena.js';
import { Battle } from './logic.js';
import { TUTORIALS } from '../data/story.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

class BattleActor {
  constructor(unit, scene) {
    this.unit = unit;
    const hero = unit.side === 'hero';
    this.sprite = new SpriteActor(unit.sprite, { blobSize: unit.boss ? 2.2 : hero ? 0.5 : 0.9, emissive: 0.25, tilt: 0.3 });
    this.sprite.play('battle.idle');
    this.sprite.setFlip(false);
    this.root = this.sprite.root;
    scene.add(this.root);
    this.home = new THREE.Vector3();
    this.ghost = null;
    this.flash = 0;
  }
  get position() {
    return this.root.position;
  }
  headY() {
    const m = this.sprite.atlas.meta.anims['battle.idle'];
    const h = m.frames[0][3];
    // approximate the top of the drawn body (≈ 82% of frame height above anchor for heroes)
    return (this.unit.boss ? m.ay * 0.82 : this.unit.side === 'hero' ? m.ay * 0.62 : m.ay * 0.62) * PX;
  }
  center() {
    return this.position.clone().add(V(0, this.headY() * 0.55, 0));
  }
}

export class BattleScene {
  constructor(game, troopId, opts = {}) {
    this.game = game;
    this.opts = opts;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.3, 500);
    this.time = 0;
    this.speed = 1;
    this.timers = [];
    this.tweens = [];
    this.troopId = troopId;
    this.battle = new Battle(game, troopId, this.hooks());
    this.arena = buildArena(this.battle.troop.arena, this.scene);
    this.fx = new FXLayer(this.scene);
    this.actors = new Map();
    this.ui = null;
    this.camPos = V(0.0, 3.3, 12.2);
    this.camLook = V(-0.2, 1.1, -0.4);
    this.shake = 0;
    this.boss = !!this.battle.troop.boss;
    this.K = this.boss ? 1.55 : 1;
    if (this.boss) {
      this.camPos = V(0.4, 4.4, 17);
      this.camLook = V(-0.9, 2.2, -0.6);
    }
    this.placeUnits();
    this.onPick = null;
    this._click = (e) => this.onPick?.(e.clientX, e.clientY);
    window.addEventListener('pointerdown', this._click);
  }

  placeUnits() {
    const g = this.arena.ground;
    const heroes = this.battle.heroes;
    heroes.forEach((u, i) => {
      const a = new BattleActor(u, this.scene);
      const n = heroes.length;
      const x = 1.9 + i * 0.8, z = -1.5 + i * 1.0 + (4 - n) * 0.3;
      a.home.set(x, g(x, z), z);
      a.position.copy(a.home);
      if (u.echo) this.attachGhost(a, u.echo);
      if (!u.alive) a.sprite.play('battle.ko');
      else if (u.hp / u.maxhp < 0.25) a.sprite.play('battle.weak');
      this.actors.set(u, a);
    });
    const enemies = this.battle.enemies;
    const slots = enemies.length === 1 ? [[this.boss ? -4.4 : -3.2, this.boss ? -1.4 : -0.9]] : enemies.length === 2 ? [[-2.6, -1.6], [-3.4, 0.7]] : [[-2.3, -2.2], [-4.0, -0.5], [-2.5, 1.3]];
    enemies.forEach((u, i) => {
      const a = new BattleActor(u, this.scene);
      const [x, z] = slots[i] || [-3 - i, 0];
      a.home.set(x, g(x, z), z);
      a.position.copy(a.home);
      this.actors.set(u, a);
    });
  }

  attachGhost(a, echoId) {
    const e = ECHOES[echoId];
    if (!this.game.assets.atlas[e.sprite]) return;
    const gs = new GhostSprite(e.sprite, e.color);
    gs.play('battle.idle');
    a.ghost = gs;
    this.scene.add(gs.root);
  }

  // ----------------------------------------------------------------- lifecycle
  enter() {
    const post = this.game.renderer.post;
    post.dof.enabled.value = 1;
    post.dof.maxBlur.value = 6;
    post.dof.focusRange.value = 7;
    post.dof.tilt.value = 0.0;
    post.bloom.strength = 0.55;
    post.bloom.threshold = 0.82;
    post.grade.vignette.value = 0.55;
    post.grade.tint.value = 0;
    post.grade.flash.value = 0;
    this.ui = new BattleUI(this);
    this.ui.buildParty(this.battle.heroes);
    this.ui.buildGauges(this.battle.enemies);
    this.applyCamera(true);
    audio.play(this.battle.troop.boss ? 'boss' : 'battle');
    this.offKeys = input.on((a) => {
      if (a === 'fast') this.toggleSpeed();
    });
    this.run();
  }

  exit() {
    this.ui?.destroy();
    this.offKeys?.();
    window.removeEventListener('pointerdown', this._click);
  }

  toggleSpeed() {
    this.speed = this.speed === 1 ? 2 : 1;
    const s = this.ui?.footer.querySelector('.spd');
    if (s) s.innerHTML = this.speed === 1 ? '▶<b>▷▷</b>' : '<b>▶▶</b>▷';
  }

  async run() {
    const result = await this.battle.run();
    this.battle.commit();
    await this.finish(result);
  }

  // ----------------------------------------------------------------- time helpers
  wait(s) {
    return new Promise((res) => this.timers.push({ t: s, res }));
  }

  tween(dur, fn) {
    return new Promise((res) => this.tweens.push({ d: dur, t: 0, fn, res }));
  }

  moveCam(pos, look, dur = 0.8) {
    const p0 = this.camPos.clone(), l0 = this.camLook.clone();
    return this.tween(dur, (k) => {
      const e = ease(k);
      this.camPos.lerpVectors(p0, pos, e);
      this.camLook.lerpVectors(l0, look, e);
    });
  }

  defaultCam(dur = 0.8) {
    if (this.boss) return this.moveCam(V(0.4, 4.4, 17), V(-0.9, 2.2, -0.6), dur);
    return this.moveCam(V(0.0, 3.3, 12.2), V(-0.2, 1.1, -0.4), dur);
  }

  moveActor(a, to, dur) {
    const from = a.position.clone();
    return this.tween(dur, (k) => {
      const e = ease(k);
      a.position.lerpVectors(from, to, e);
      a.position.y = this.arena.ground(a.position.x, a.position.z) + Math.sin(k * Math.PI) * 0.0;
    });
  }

  applyCamera(snap = false) {
    const p = this.camPos.clone();
    if (this.shake > 0) p.add(V((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake, 0));
    this.camera.position.copy(p);
    this.camera.lookAt(this.camLook);
    this.game.renderer.post.dof.focusDist.value = p.distanceTo(this.camLook);
  }

  highlight(units) {
    for (const [u, a] of this.actors) {
      a.sprite.uniforms.uTintAmt.value = 0;
      a.hl = units.includes(u);
    }
  }

  update(dt0) {
    const dt = dt0 * this.speed;
    this.time += dt;
    for (const t of this.timers) t.t -= dt;
    const done = this.timers.filter((t) => t.t <= 0);
    this.timers = this.timers.filter((t) => t.t > 0);
    done.forEach((t) => t.res());
    for (const tw of this.tweens) {
      tw.t += dt;
      tw.fn(Math.min(1, tw.t / tw.d));
    }
    const fin = this.tweens.filter((t) => t.t >= t.d);
    this.tweens = this.tweens.filter((t) => t.t < t.d);
    fin.forEach((t) => t.res());
    this.shake = Math.max(0, this.shake - dt * 1.6);
    this.applyCamera();
    for (const [u, a] of this.actors) {
      a.sprite.update(dt, this.camera);
      a.flash = Math.max(0, a.flash - dt * 5);
      a.sprite.uniforms.uFlash.value = a.flash + (a.hl ? 0.18 + 0.12 * Math.sin(this.time * 10) : 0);
      if (u.broken) {
        a.sprite.uniforms.uTint.value.setRGB(0.75, 0.7, 0.55);
        a.sprite.uniforms.uTintAmt.value = 0.5;
      } else if (!a.dying) a.sprite.uniforms.uTintAmt.value = 0;
      if (a.ghost) {
        a.ghost.root.position.copy(a.position).add(V(0.5, 0.05, -0.7));
        const anim = a.sprite.anim;
        if (a.ghost.anim !== anim && a.ghost.atlas.meta.anims[anim]) a.ghost.play(anim);
        a.ghost.update(dt, false, this.camera, this.time);
        a.ghost.root.visible = u.alive;
      }
    }
    this.fx.update(dt, this.camera);
    this.arena.particles?.update(dt);
    this.arena.sky?.update(this.time, this.camera.position);
    this.arena.props?.update(this.camera);
    updatePropsTime(this.time);
    this.arena.lights.follow(V(0, 0, 0));
    if (this.ui) {
      this.ui.updateGauges(this.battle.enemies, this.camera);
      this.ui.tick();
    }
  }

  // ----------------------------------------------------------------- hooks for logic
  hooks() {
    return {
      intro: () => this.intro(),
      chooseCommand: (u, ctx) => this.chooseCommand(u, ctx),
      present: (u, a, r) => this.present(u, a, r),
      update: () => this.refresh(),
      breakUnit: (u) => this.onBreak(u),
      ko: (u) => this.onKO(u),
      recover: (u) => this.onRecover(u),
      fullBreak: (single) => this.onFullBreak(single),
      extraTurn: (h) => this.onExtraTurn(h),
      extraEnd: () => this.onExtraEnd(),
    };
  }

  refresh(active = null) {
    this.ui.updateParty(this.battle.heroes, active);
  }

  async intro() {
    const post = this.game.renderer.post.grade;
    post.radial.value = 1.2;
    this.camPos.set(-6, 2.6, 7);
    this.camLook.set(-3, 1.2, -0.5);
    this.applyCamera();
    for (const [u, a] of this.actors) if (u.side === 'enemy') a.position.x -= 3;
    const enemies = [...this.actors].filter(([u]) => u.side === 'enemy');
    await Promise.all([
      this.tween(0.6, (k) => (post.radial.value = 1.2 * (1 - k))),
      ...enemies.map(([u, a]) => this.moveActor(a, a.home.clone(), 0.7)),
    ]);
    await this.defaultCam(1.1);
    const tut = this.battle.troop.tutorial;
    if (tut && TUTORIALS[tut] && !this.game.state.flags['tut_' + tut]) {
      this.game.state.flags['tut_' + tut] = true;
      await this.ui.tutorial(TUTORIALS[tut]);
    }
  }

  async chooseCommand(u, ctx) {
    const a = this.actors.get(u);
    const upcoming = this.battle.predict(11);
    this.ui.updateTimeline(u, upcoming);
    this.refresh(u);
    a.sprite.flash = 0;
    // step forward a little like modern JRPGs do for the active hero
    const fwd = a.home.clone().add(V(-0.35, 0, 0));
    this.moveActor(a, fwd, 0.18);
    if (this.game.auto) {
      await this.wait(0.4);
      return this.autoPick(u);
    }
    const act = await this.ui.chooseCommand(u, this.battle, ctx);
    return act;
  }

  autoPick(u) {
    const foes = this.battle.enemies.filter((e) => e.alive);
    if (u.echo && u.res >= 100) {
      const r = ECHOES[u.echo].resonance;
      return { kind: 'resonance', targets: r.target === 'enemies' ? foes : r.target === 'allies' ? this.battle.heroes.filter((h) => h.alive) : [foes[0]] };
    }
    const hurt = this.battle.heroes.filter((h) => h.alive && h.hp / h.maxhp < 0.45);
    const all = [...u.skills, ...u.echoSkills].filter((k) => SKILLS[k].mp <= u.mp);
    if (hurt.length) {
      const h = all.find((k) => SKILLS[k].type === 'heal');
      if (h) return { kind: 'skill', skill: h, targets: SKILLS[h].target === 'allies' ? this.battle.heroes.filter((x) => x.alive) : [hurt[0]], delay: SKILLS[h].delay };
    }
    const t = foes.find((e) => !e.broken) || foes[0];
    let best = 'attack', score = 1;
    for (const k of all) {
      const s = SKILLS[k];
      if (s.type !== 'phys' && s.type !== 'mag') continue;
      const w = s.el && t.data.weak?.includes(s.el) ? 2.2 : s.el && t.data.resist?.includes(s.el) ? 0.4 : 1;
      const sc = ((s.brk || 0) / 12) * w + s.power * (s.hits || 1) * 0.5 + (s.target === 'enemies' ? foes.length * 0.3 : 0);
      if (sc > score) {
        score = sc;
        best = k;
      }
    }
    const s = SKILLS[best];
    return { kind: 'skill', skill: best, targets: s.target === 'enemies' ? foes : [t], delay: s.delay };
  }

  async present(u, act, results) {
    const a = this.actors.get(u);
    const hero = u.side === 'hero';
    if (!hero) {
      const upcoming = this.battle.predict(11);
      this.ui.updateTimeline(u, upcoming);
      this.refresh();
    }
    const skill = act.skillDef || (act.kind === 'skill' ? SKILLS[act.skill] : null);
    const name = act.kind === 'resonance' ? ECHOES[u.echo].resonance.name : act.kind === 'item' ? act.name : act.kind === 'guard' ? '막기' : act.kind === 'escape' ? '도주' : skill?.name;
    if (act.kind === 'guard') {
      a.sprite.play('battle.guard');
      audio.sfx('buff');
      this.ui.banner(name);
      await this.wait(0.6);
      this.ui.hideBanner();
      await this.moveActor(a, a.home.clone(), 0.15);
      return;
    }
    if (act.kind === 'escape') {
      this.ui.banner('도주');
      audio.sfx('run');
      if (results[0]?.escaped) {
        for (const h of this.battle.heroes) {
          const ha = this.actors.get(h);
          ha.sprite.setFlip(true);
          ha.sprite.play('battle.run');
          this.moveActor(ha, ha.position.clone().add(V(8, 0, 0)), 1.0);
        }
        await this.wait(1.0);
      } else {
        await this.wait(0.6);
        this.ui.banner('도망칠 수 없었다!');
        await this.wait(0.8);
      }
      this.ui.hideBanner();
      return;
    }
    if (act.kind === 'skill' && act.skill === 'attack') {
      // plain attack: no banner
    } else this.ui.banner(name, !hero);

    if (act.kind === 'resonance') await this.resonanceIntro(u, a);

    const type = skill?.type || (act.kind === 'item' ? 'item' : 'phys');
    const targets = [...new Set(results.map((r) => r.target).filter(Boolean))];
    const fxName = act.fx || skill?.fx || 'hit';

    if (type === 'phys') await this.physAction(u, a, targets, results, fxName, act);
    else await this.magicAction(u, a, targets, results, fxName, type, act);

    this.ui.hideBanner();
    this.refresh();
    if (hero) await this.moveActor(a, a.home.clone(), 0.2);
  }

  async physAction(u, a, targets, results, fxName, act) {
    const hero = u.side === 'hero';
    const big = act.kind === 'resonance';
    const t0 = this.actors.get(targets[0]);
    const multi = targets.length > 1;
    if (hero) {
      // camera follows the hero's dash
      const mid = a.position.clone().lerp(t0.position, 0.5);
      this.moveCam(V(mid.x + 1.2, 2.6 * this.K, mid.z + 7.5 * this.K), V(mid.x - 0.4, 1.1 * this.K, mid.z - 0.4), 0.55);
      a.sprite.play('battle.run');
      const dest = multi ? V(-0.6, 0, 0) : t0.position.clone().add(V(1.55 + (targets[0].boss ? 2.6 : 0), 0, 0.6));
      await this.moveActor(a, dest, 0.38);
    } else {
      // enemy lunge
      const dir = t0.position.clone().sub(a.position).setY(0).normalize();
      this.moveActor(a, a.home.clone().add(dir.multiplyScalar(u.boss ? 0.8 : 1.6)), 0.25);
      this.moveCam(V(a.position.x + 3 * this.K, 2.8 * this.K, a.position.z + 8.5 * this.K), V(a.position.x + 1.2 * this.K, 1.2 * this.K, -0.4), 0.5);
    }
    const hitsPer = Math.max(1, Math.round(results.length / targets.length));
    for (let h = 0; h < hitsPer; h++) {
      a.sprite.play('battle.attack', { restart: true, loop: false });
      await this.wait(hero ? 0.2 : 0.22);
      audio.sfx(big ? 'bighit' : fxName.startsWith('slash') ? 'slash' : 'hit');
      for (const t of targets) {
        const r = results.find((x) => x.target === t && x.hit === h) || results.find((x) => x.target === t);
        const ta = this.actors.get(t);
        const scale = (t.boss ? 3.2 : 1.8) * (big ? 1.8 : 1);
        this.fx.play(fxName === 'holy' || fxName === 'thunder' || fxName === 'dark' ? 'slash_x' : fxName, ta.center(), { scale, flip: !hero, depthTest: false });
        if (fxName === 'thunder') this.fx.play('thunder', ta.position.clone().add(V(0, 1.4, 0)), { scale: 1.4, depthTest: false }), audio.sfx('thunder');
        if (fxName === 'holy') this.fx.play('holy', ta.position.clone(), { scale: 1.8, anchorBottom: true }), audio.sfx('holy');
        if (fxName === 'dark') this.fx.play('dark', ta.center(), { scale: 1.6, depthTest: false }), audio.sfx('dark');
        this.fx.play(t.boss ? 'hit' : 'hit', ta.center().add(V(0.2, 0.2, 0.3)), { scale: 1.4, depthTest: false });
        this.applyHit(t, r, big);
      }
      this.shake = big ? 0.5 : 0.18;
      await this.wait(hitsPer > 1 ? 0.22 : 0.42);
    }
    if (hero) {
      a.sprite.setFlip(true);
      a.sprite.play('battle.run');
      this.defaultCam(0.5);
      await this.moveActor(a, a.home.clone().add(V(-0.35, 0, 0)), 0.32);
      a.sprite.setFlip(false);
    } else {
      this.defaultCam(0.5);
      await this.moveActor(a, a.home.clone(), 0.25);
    }
    this.restAnim(u, a);
  }

  async magicAction(u, a, targets, results, fxName, type, act) {
    const hero = u.side === 'hero';
    const big = act.kind === 'resonance';
    a.sprite.play(a.sprite.has('battle.cast') ? 'battle.cast' : 'battle.attack', { restart: true, loop: false });
    const col = { heal: 0x7aff9a, buff: 0xffd070, revive: 0xfff0a0, item: 0x9affb0 }[type] || (fxName === 'fire' ? 0xff9a50 : fxName === 'ice' ? 0x8ae0ff : fxName === 'thunder' ? 0xc0a0ff : fxName === 'dark' ? 0xd080ff : 0xbfe8ff);
    this.fx.circle(a.position.clone(), { size: u.boss ? 5 : 2.2, life: 1.4, color: col, gold: type === 'heal' || type === 'buff' });
    audio.sfx(type === 'heal' || type === 'revive' || type === 'item' ? 'heal' : type === 'buff' ? 'buff' : 'magic');
    // camera favours the caster then swings to the targets
    if (hero) this.moveCam(V(a.position.x - 1.5, 2.4, a.position.z + 7), V(a.position.x - 1, 1.2, a.position.z - 0.6), 0.5);
    else this.moveCam(V(a.position.x + 2.6 * this.K, 2.8 * this.K, a.position.z + 8.5 * this.K), V(a.position.x + this.K, 1.3 * this.K, -0.4), 0.5);
    this.fx.play('sparkle_gold', a.position.clone(), { scale: 1.2, anchorBottom: true });
    await this.wait(big ? 0.4 : 0.6);
    const allies = targets.every((t) => t.side === u.side);
    const center = targets.reduce((s, t) => s.add(this.actors.get(t).position), V(0, 0, 0)).multiplyScalar(1 / targets.length);
    const bossT = targets.some((t) => t.boss);
    const kk = bossT ? 1.7 : 1;
    await this.moveCam(V(center.x + (allies === hero ? 0.6 : -0.6), 2.9 * kk, center.z + 8.6 * kk), V(center.x, 1.1 * kk, center.z - 0.4), 0.45);
    const sound = { fire: 'fire', ice: 'ice', thunder: 'thunder', holy: 'holy', dark: 'dark', heal: 'heal', buff: 'buff', debuff: 'dark' }[fxName];
    if (sound) audio.sfx(sound);
    for (const t of targets) {
      const ta = this.actors.get(t);
      const sc = (t.boss ? 3.0 : 1.6) * (big ? 2.0 : 1);
      if (fxName === 'holy') this.fx.play('holy', ta.position.clone(), { scale: sc, anchorBottom: true });
      else if (fxName === 'thunder') this.fx.play('thunder', ta.position.clone().add(V(0, 1.4 * sc / 1.6, 0)), { scale: sc * 0.9, depthTest: false });
      else if (fxName === 'ice') this.fx.play('ice', ta.position.clone().add(V(0, 0.9, 0.3)), { scale: sc });
      else if (fxName === 'heal' || fxName === 'buff' || fxName === 'debuff') this.fx.play(fxName, ta.position.clone(), { scale: sc * 0.9, anchorBottom: true });
      else this.fx.play(fxName, ta.center(), { scale: sc, depthTest: false });
      if (fxName === 'holy' || type === 'heal') this.fx.ray(ta.position.clone(), { color: type === 'heal' ? 0xb0ffc8 : 0xfff2c0, life: 1.2 });
    }
    await this.wait(0.35);
    for (const r of results) this.applyHit(r.target, r, big);
    if (type !== 'heal' && type !== 'buff' && type !== 'revive' && type !== 'item') this.shake = big ? 0.6 : 0.15;
    await this.wait(0.65);
    this.defaultCam(0.5);
    this.restAnim(u, a);
  }

  applyHit(t, r, big) {
    if (!r) return;
    const ta = this.actors.get(t);
    const at = ta.position.clone().add(V(0, ta.headY() * 0.85, 0));
    const ui = this.ui;
    if (r.heal != null && r.heal >= 0 && !r.dmg) {
      ui.damage(at, this.camera, r.heal, 'heal', r.absorb ? '흡수' : '');
      if (t.side === 'hero' && t.alive) this.restAnim(t, ta);
    }
    if (r.mpHeal != null) ui.damage(at, this.camera, r.mpHeal, 'mp', 'MP');
    if (r.revive != null) {
      ui.damage(at, this.camera, r.revive, 'heal', '부활');
      ta.sprite.play('battle.idle');
    }
    if (r.buff) ui.damage(at, this.camera, { atk: '공격력 UP', def: '방어력 UP' }[r.buff] || 'UP', 'weak');
    if (r.dmg != null) {
      const kind = r.crit ? 'crit' : r.weak ? 'weak' : '';
      ui.damage(at, this.camera, r.dmg, kind, r.weak ? 'WEAK' : r.resist ? 'RESIST' : r.crit ? 'CRITICAL' : '');
      ta.flash = 1;
      if (!r.koNow) {
        ta.sprite.play('battle.hurt', { restart: true, loop: false, onEnd: () => this.restAnim(t, ta) });
        // knockback
        const dir = t.side === 'hero' ? 1 : -1;
        const p0 = ta.position.clone();
        this.tween(0.25, (k) => {
          const s = Math.sin(k * Math.PI) * (big ? 0.4 : 0.18) * dir;
          ta.position.x = p0.x + s;
        });
      }
    }
    this.refresh();
  }

  restAnim(u, a) {
    if (!u.alive) return;
    if (u.side === 'hero' && u.hp / u.maxhp < 0.25) a.sprite.play('battle.weak');
    else if (u.guard) a.sprite.play('battle.guard');
    else a.sprite.play('battle.idle');
  }

  async onBreak(u) {
    const a = this.actors.get(u);
    audio.sfx('break');
    this.fx.play('shatter', a.center(), { scale: u.boss ? 3.4 : 2.0, depthTest: false });
    this.fx.glow(a.center(), { color: 0xffd060, size: u.boss ? 6 : 3, life: 0.5 });
    this.ui.damage(a.position.clone().add(V(0, a.headY() + 0.3, 0)), this.camera, 'BREAK', 'weak');
    this.shake = 0.3;
    await this.wait(0.6);
    this.ui.updateTimeline(this.battle.living[0], this.battle.predict(11));
  }

  async onRecover(u) {
    const a = this.actors.get(u);
    this.ui.updateTimeline(u, this.battle.predict(11));
    this.ui.banner('브레이크 회복', true);
    a.flash = 0.6;
    await this.wait(0.7);
    this.ui.hideBanner();
  }

  async onKO(u) {
    const a = this.actors.get(u);
    if (u.side === 'hero') {
      audio.sfx('ko');
      a.sprite.play('battle.ko');
      return;
    }
    a.dying = true;
    audio.sfx('ko');
    a.sprite.uniforms.uTint.value.setRGB(1.0, 0.4, 0.6);
    a.sprite.uniforms.uTintAmt.value = 0.8;
    this.fx.play('smoke', a.center(), { scale: u.boss ? 4 : 2 });
    await this.tween(u.boss ? 1.6 : 0.7, (k) => {
      a.sprite.uniforms.uDissolve.value = k;
      a.sprite.uniforms.uFlash.value = k * 0.6;
    });
    a.root.visible = false;
    a.dying = false;
  }

  async onFullBreak(single) {
    const post = this.game.renderer.post.grade;
    audio.sfx('fullbreak');
    this.fx.glow(V(-3, 1.4, -0.5), { color: 0xffd060, size: 12, life: 0.9, grow: 2 });
    await this.tween(0.15, (k) => (post.flash.value = k * 0.8));
    post.flashColor.value.setRGB(1, 0.95, 0.75);
    this.tween(0.5, (k) => (post.flash.value = 0.8 * (1 - k)));
    await this.ui.announce(single ? 'FULL BREAK' : 'FULL BREAK', '', false, 1700);
    await this.tween(0.4, (k) => (post.tint.value = k * 0.35));
    post.tintColor.value.setRGB(1.0, 0.82, 0.45);
    await this.ui.announce('EXTRA PHASE', '파티 전원 추가 행동', false, 1700);
    if (!this.game.state.flags.tut_extra) {
      this.game.state.flags.tut_extra = true;
      await this.ui.tutorial(TUTORIALS.extra);
    }
  }

  async onExtraTurn(h) {
    const a = this.actors.get(h);
    a.flash = 0.8;
    audio.sfx('buff');
    await this.wait(0.15);
  }

  async onExtraEnd() {
    const post = this.game.renderer.post.grade;
    await this.tween(0.6, (k) => (post.tint.value = 0.35 * (1 - k)));
  }

  async resonanceIntro(u, a) {
    const post = this.game.renderer.post.grade;
    this.ui.hideBanner();
    audio.sfx('resonance');
    this.moveCam(V(a.position.x - 1.2, 1.9, a.position.z + 4.2), V(a.position.x, 1.3, a.position.z), 0.6);
    this.fx.circle(a.position.clone(), { size: 4.5, life: 3.2, color: 0xffe0a0, gold: true, spin: 2.4 });
    this.fx.ray(a.position.clone(), { w: 2.4, h: 14, life: 2.6, color: 0xbfe8ff, opacity: 0.9 });
    if (a.ghost) a.ghost.mat.color.setHex(0xffffff);
    await this.tween(0.5, (k) => (post.desat.value = k * 0.6));
    await this.ui.cutin(u, u.echo, ECHOES[u.echo].resonance.name);
    post.desat.value = 0;
    this.ui.banner(ECHOES[u.echo].resonance.name);
    post.flashColor.value.setRGB(1, 1, 1);
    await this.tween(0.25, (k) => (post.flash.value = 1 - k));
  }

  // ----------------------------------------------------------------- end
  async finish(result) {
    const st = this.game.state;
    if (result === 'win') {
      audio.play('victory');
      for (const h of this.battle.heroes) {
        const a = this.actors.get(h);
        if (h.alive) a.sprite.play('battle.win');
      }
      await this.moveCam(V(4.2, 2.3, 7.2), V(3.2, 1.2, -0.2), 1.2);
      const rew = this.battle.rewards();
      st.gold += rew.gold;
      const lv = [];
      for (const h of this.battle.heroes) {
        const m = h.member;
        m.exp += rew.exp;
        let up = false;
        while (m.exp >= expForLevel(m.level)) {
          m.level++;
          up = true;
        }
        if (up) {
          const s = m.stats;
          m.hp = Math.min(s.hp, m.hp + 80);
          m.mp = Math.min(s.mp, m.mp + 10);
        }
        lv.push({ name: m.name, level: m.level, up });
      }
      await this.ui.results(rew, lv);
    } else if (result === 'lose') {
      await this.ui.announce('DEFEATED', '파티가 전멸했다…', true, 2200);
    }
    this.opts.onEnd?.(result);
  }
}
