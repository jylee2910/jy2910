// 전투 씬: 전투 모델의 이벤트를 받아 연출한다 (카메라, 타격감, 파티클, UI)
import * as THREE from 'three';
import { Battle } from '../sys/battle.js';
import { gainExp, gainAP, weaponLook } from '../sys/party.js';
import { buildDiorama, applyTheme, arenaMap } from '../gfx/diorama.js';
import { Billboard } from '../gfx/billboard.js';
import { FX } from '../gfx/fx.js';
import { charSheet, monsterSheet, iconURL } from '../art/assets.js';
import { Clock, ease } from '../core/clock.js';
import { BattleUI } from '../ui/battleui.js';
import { banner, win, el, ListMenu, esc } from '../ui/ui.js';
import { sfx, playBGM } from '../core/audio.js';
import { G, addItem, recordKill } from '../core/state.js';
import { ABILITIES } from '../data/abilities.js';
import { CHARACTERS } from '../data/characters.js';
import { ELEMENTS } from '../data/elements.js';
import { itemInfo } from '../data/items.js';
import { ENEMIES } from '../data/enemies.js';

const ELEM_HEX = { fire: 0xff7a30, ice: 0x8ad8ff, bolt: 0xffe45a, wind: 0x8ae8a0, light: 0xfff4c0, dark: 0xb070ff };

export class BattleScene {
  constructor(app, { enemies, theme = 'field', music, onEnd }) {
    this.app = app; this.stage = app.stage;
    this.enemyIds = enemies; this.themeName = theme; this.music = music; this.onEnd = onEnd;
    this.game = G.s;
    this.clock = new Clock();
    this.speed = app.battleSpeed || 1;
    this.sprites = new Map();
  }

  enter() {
    const scene = this.scene = new THREE.Scene();
    this.theme = applyTheme(scene, this.themeName, 18);
    this.dio = buildDiorama(arenaMap(this.themeName));
    scene.add(this.dio.group);
    this.fx = new FX(scene, this.stage);
    this.stage.setWorld(scene);
    this.stage.setFov(30);
    this.stage.focus = 0.5;
    const boss = this.enemyIds.some(id => ENEMIES[id].boss);
    this.battle = new Battle(this.game, this.enemyIds, { noEscape: boss });
    this.boss = boss;

    // 파티 배치 (오른쪽). 세로 화면에서는 간격을 좁힌다
    const portrait = this.portrait = this.stage.width < this.stage.height;
    const sx = portrait ? 0.62 : 1;
    const ppos = [[2.1 * sx, -1.25], [2.65 * sx, 0.05], [3.2 * sx, 1.35]];
    this.battle.party.forEach((u, i) => {
      const b = new Billboard(charSheet(CHARACTERS[u.id].design, weaponLook(u.cs)));
      b.home = new THREE.Vector3(ppos[i][0], 0, ppos[i][1]);
      b.group.position.copy(b.home);
      scene.add(b.group);
      this.sprites.set(u, b);
      if (!u.alive) b.play('ko');
    });
    // 적 배치 (왼쪽)
    const n = this.battle.enemies.length;
    const epos = { 1: [[-2.5, 0]], 2: [[-2.2, -0.95], [-2.7, 0.95]], 3: [[-2.0, -1.4], [-2.9, 0.05], [-2.2, 1.45]], 4: [[-1.9, -1.5], [-2.9, -0.5], [-2.0, 0.6], [-3.0, 1.5]] }[n];
    this.battle.enemies.forEach((u, i) => {
      const d = ENEMIES[u.id];
      const b = new Billboard(monsterSheet(u.design), { scale: d.scale || 1 });
      const [x, z] = d.boss ? [-3.0, -0.2] : epos[i];
      b.home = new THREE.Vector3(x * sx, d.flying ? 0.5 : 0, z * (portrait ? 1.15 : 1));
      b.group.position.copy(b.home);
      b.speedJitter = 0.85 + Math.random() * 0.3;
      scene.add(b.group);
      this.sprites.set(u, b);
    });

    this.ui = new BattleUI(this);
    this.ui.setSpeedLabel(this.speed);
    this.setupCamera();
    this.pointer = e => this.onPointer(e);
    this.stage.renderer.domElement.addEventListener('pointerdown', this.pointer);
    playBGM(this.music || (boss ? 'boss' : 'battle'));
    this.run();
  }

  setupCamera() {
    const portrait = this.stage.width < this.stage.height;
    this.camHome = portrait
      ? { pos: new THREE.Vector3(0.0, 5.4, 11.8), look: new THREE.Vector3(-0.1, -1.6, 0) }
      : { pos: new THREE.Vector3(0.3, 5.0, 12.2), look: new THREE.Vector3(0, -0.35, 0) };
    if (this.boss && !portrait) this.camHome.pos.add(new THREE.Vector3(-0.3, 0.3, 0.8));
    this.cam = { pos: this.camHome.pos.clone(), look: this.camHome.look.clone() };
    this.camTarget = { pos: this.camHome.pos.clone(), look: this.camHome.look.clone(), k: 3 };
    // 인트로: 옆에서 스윕
    this.cam.pos.set(-6, 3, 7); this.cam.look.set(-2, 0.8, 0);
  }
  camTo(pos, look, k = 4) { this.camTarget = { pos: pos.clone(), look: look.clone(), k }; }
  camHomeGo(k = 3) { this.camTo(this.camHome.pos, this.camHome.look, k); }
  camFocus(worldPos, zoom = 0.35, k = 4) {
    const look = this.camHome.look.clone().lerp(worldPos.clone().setY(this.camHome.look.y + 0.3), zoom);
    const pos = this.camHome.pos.clone().lerp(worldPos.clone().add(new THREE.Vector3(0.2, 2.6, 5.2)), zoom);
    this.camTo(pos, look, k);
  }

  toggleSpeed() { this.speed = this.speed > 1 ? 1 : 2; this.app.battleSpeed = this.speed; this.ui.setSpeedLabel(this.speed); }
  wait(s) { return this.clock.wait(s); }

  exit() {
    this.stage.renderer.domElement.removeEventListener('pointerdown', this.pointer);
    this.ui.destroy();
    this.clock.clear();
    this.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }

  update(realDt) {
    const dt = this.clock.update(realDt * this.speed);
    for (const [u, s] of this.sprites) {
      s.update(dt * (s.speedJitter || 1), this.stage.camera);
      if (u.side === 'enemy' && u.alive && ENEMIES[u.id].flying) s.offset.y = Math.sin(this.clock.t * 3 + u.idx) * 0.12;
      if (u.boss && u.alive && u.phase > 0 && Math.random() < 0.5) this.fx.aura(s.group.position, 0xc050ff, s.height);
      if (u.broken && u.alive && Math.random() < 0.15) this.fx.burst(s.group.position.clone().setY(s.height * 0.9), { n: 1, color: 0xffe45a, speed: 0.6, life: 0.6, size: 0.1, g: -1, glow: true });
    }
    this.fx.update(dt);
    this.dio.update(this.clock.t);
    this.theme.motes.update(this.clock.t);
    // 카메라 보간
    const k = 1 - Math.exp(-realDt * this.camTarget.k);
    this.cam.pos.lerp(this.camTarget.pos, k); this.cam.look.lerp(this.camTarget.look, k);
    this.stage.camera.position.copy(this.cam.pos); this.stage.camera.lookAt(this.cam.look);
    this.ui.positionTags();
  }

  highlight(units) {
    for (const [u, s] of this.sprites) s.glow = units.includes(u) ? 0.6 + Math.sin(performance.now() / 120) * 0.1 : 0.22;
  }

  onPointer(e) {
    if (!this.onPick) return;
    const r = this.stage.renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(v, this.stage.camera);
    // 스프라이트 박스 근사 판정 (화면 거리)
    let best = null, bd = 1e9;
    for (const [u, s] of this.sprites) {
      if (!u.alive && u.side === 'enemy') continue;
      const p = this.stage.project(s.group.position.clone().setY(s.height * 0.45));
      const d = Math.hypot(p.x - (e.clientX - r.left), (p.y - (e.clientY - r.top)) * 0.7);
      const lim = Math.max(40, s.width / 0.05 * 1.6);
      if (d < lim && d < bd) { bd = d; best = u; }
    }
    this.onPick(best);
  }

  // ─────────────────────────────────────────────────────────────
  async run() {
    const b = this.battle;
    // 인트로
    this.camHomeGo(1.6);
    for (const u of b.enemies) {
      const s = this.sprites.get(u);
      s.offset.y = 3; s.setAlpha(0);
    }
    sfx('encounter');
    await this.wait(0.3);
    for (const u of b.enemies) {
      const s = this.sprites.get(u);
      this.clock.tween(0.45, k => { s.offset.y = 3 * (1 - k); s.setAlpha(Math.min(1, k * 2)); }, ease.in).then(() => { s.setAlpha(1); s.offset.y = 0; this.fx.dust(s.group.position); sfx('step'); });
      await this.wait(0.12);
    }
    await this.wait(0.5);
    banner(this.boss ? `${esc(b.enemies[0].name)}` : '몬스터가 나타났다!', this.boss ? 'boss long' : '');
    if (this.boss) { this.stage.addShake(0.2, 0.8); sfx('phase'); }
    await this.wait(this.boss ? 1.4 : 0.6);

    while (!b.over) {
      const { unit: u, events, skip, auto } = b.next();
      this.ui.refreshOrder();
      this.ui.setActive(u);
      await this.play(events);
      if (b.over) break;
      if (skip) { this.ui.refreshOrder(); continue; }
      if (auto === 'land') { await this.play(b.autoLand(u)); continue; }
      if (u.side === 'enemy') {
        await this.wait(0.25);
        await this.play(b.enemyAction(u));
      } else {
        const s = this.sprites.get(u);
        this.clock.tween(0.15, k => { s.offset.x = -0.35 * k; });
        const action = await this.ui.chooseCommand(u);
        this.clock.tween(0.12, k => { s.offset.x = -0.35 * (1 - k); });
        await this.play(b.act(u, action));
      }
      this.ui.setActive(null);
    }
    this.ui.refreshOrder();
    await this.wait(0.3);
    if (b.over === 'win') await this.victory();
    else if (b.over === 'lose') { b.writeBack(); this.onEnd({ result: 'lose' }); }
    else if (b.over === 'escape') { b.writeBack(); this.onEnd({ result: 'escape' }); }
  }

  async play(events) {
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (ev.e === 'act' || ev.e === 'land') {
        const group = [];
        let j = i + 1;
        while (j < events.length && !(events[j].e === 'end' && events[j].u === ev.u)) group.push(events[j++]);
        if (ev.e === 'land') await this.playLand(ev, group);
        else await this.playAct(ev, group);
        i = j;
        await this.afterDeaths();
        continue;
      }
      await this.playMisc(ev);
    }
    await this.afterDeaths();
    this.ui.refreshOrder();
  }

  spr(u) { return this.sprites.get(u); }
  chest(u) { const s = this.spr(u); return s.group.position.clone().add(s.offset).setY(s.group.position.y + s.offset.y + s.height * 0.42); }

  async playMisc(ev) {
    const s = ev.t && this.spr(ev.t);
    switch (ev.e) {
      case 'dot': this.ui.popup(this.chest(ev.t), ev.dmg, 'dmg psn'); s.flash(0.1, 0xb060ff); this.ui.updateUnit(ev.t, ev.hpAfter); await this.wait(0.4); break;
      case 'hot': this.fx.heal(s.group.position); this.ui.popup(this.chest(ev.t), ev.heal, 'heal'); this.ui.updateUnit(ev.t, ev.hpAfter); sfx('heal'); await this.wait(0.4); break;
      case 'mp': if (!ev.quiet) { this.ui.popup(this.chest(ev.t), 'MP+' + ev.amount, 'mpn'); await this.wait(0.2); } this.ui.updateUnit(ev.t, undefined, ev.mpAfter); break;
      case 'status': this.ui.popup(this.chest(ev.t).add(new THREE.Vector3(0, 0.35, 0)), ev.text, 'stat'); this.ui.popups?.(); if (ev.cover) await this.coverMove(ev); await this.wait(0.3); this.ui.updateUnit(ev.t); break;
      case 'buffs': this.ui.updateUnit(ev.t); break;
      case 'recover':
        s.play('idle'); this.ui.updateTag(ev.t);
        this.ui.popup(this.chest(ev.t), '실드 회복', 'stat'); sfx('guard');
        this.fx.burst(this.chest(ev.t), { n: 16, color: 0x7ef0ff, speed: 1.5, life: 0.6, size: 0.3, glow: true, g: 0 });
        await this.wait(0.5); break;
      case 'guard': s.play('guard'); sfx('guard'); this.fx.burst(this.chest(ev.u), { n: 10, color: 0x8ad8ff, speed: 1, life: 0.5, size: 0.35, glow: true, g: 0 }); await this.wait(0.4); break;
      case 'escape':
        if (ev.ok) {
          banner('무사히 도망쳤다!'); sfx('wind');
          for (const u of this.battle.party) { const sp = this.spr(u); if (u.alive) { sp.flipped = true; sp.play('walk'); this.clock.tween(0.8, k => { sp.offset.x = 6 * k; }, ease.in); } }
          await this.wait(0.9);
        } else { banner('도망칠 수 없었다!'); sfx('buzz'); await this.wait(0.7); }
        break;
      case 'revive': s.play('idle'); this.fx.pillar(s.group.position, 0xfff4c0, 0.8, 0.5, 4); this.fx.heal(s.group.position, 0xfff4c0); sfx('light'); this.ui.popup(this.chest(ev.t), '소생!', 'heal'); this.ui.updateUnit(ev.t, ev.hpAfter); await this.wait(0.6); break;
      case 'scan': this.ui.updateTag(ev.t); this.ui.popup(this.chest(ev.t), '간파!', 'stat'); this.fx.burst(this.chest(ev.t), { n: 20, color: 0x7ef0ff, speed: 2, life: 0.6, size: 0.2, glow: true, g: 0 }); await this.wait(0.4); break;
      case 'enchant': {
        this.ui.popup(this.chest(ev.u).add(new THREE.Vector3(0, 0.3, 0)), `마법검: ${ELEMENTS[ev.elem].name}`, 'stat'); sfx('buff');
        this.fx.burst(this.chest(ev.u), { n: 20, color: ELEM_HEX[ev.elem] || 0xffffff, speed: 1.5, life: 0.7, size: 0.3, glow: true, g: -1 });
        this.ui.updateUnit(ev.u); await this.wait(0.35); break;
      }
      case 'jumpUp': break;
      case 'phase': await this.playPhase(ev); break;
      case 'hit': await this.showHit(ev); break;
    }
  }

  async coverMove(ev) {
    const s = this.spr(ev.t), from = this.spr(ev.from);
    const target = from.home.clone().add(new THREE.Vector3(-0.6, 0, 0));
    const start = s.group.position.clone();
    sfx('guard'); s.play('guard');
    await this.clock.tween(0.15, k => s.group.position.lerpVectors(start, target, k));
    s.coverReturn = start;
  }

  async playAct(ev, group) {
    const u = ev.u, s = this.spr(u);
    if (ev.name) {
      const elem = ev.ab.elem && ELEMENTS[ev.ab.elem];
      banner(`${elem ? `<img src="${iconURL(elem.icon)}"> ` : ''}${esc(ev.name)}`, u.side === 'enemy' ? 'enemy' : '');
    }
    this.ui.updateUnit(u, u.hp, u.mp + 0); // MP 소비 반영은 모델 기준
    if (u.side === 'party') this.ui.updateUnit(u);
    // 선행 상태 이벤트 (수호 등)
    while (group.length && group[0].e === 'status') await this.playMisc(group.shift());
    const targets = ev.targets.filter(Boolean);
    const t0 = targets[0];
    const phys = ev.anim === 'attack';
    const dirX = u.side === 'party' ? 1 : -1;

    if (ev.jump) {
      s.play('cast'); sfx('jump'); this.fx.dust(s.group.position);
      this.camFocus(s.group.position, 0.2);
      await this.clock.tween(0.35, k => { s.offset.y = k * 9; }, ease.in);
      s.group.visible = false; s.offset.y = 0;
      this.camHomeGo();
      this.ui.updateUnit(u);
      return;
    }
    if (ev.item) {
      s.play('cast'); sfx('cast');
      await this.wait(0.35);
      for (const h of group) await this.playMisc(h);
      s.play('idle');
      return;
    }

    let hitP;
    if (phys && t0 && t0 !== u) {
      // 돌진
      const ts = this.spr(t0);
      const from = s.group.position.clone();
      const dest = t0.side === u.side ? from : ts.group.position.clone().add(new THREE.Vector3(dirX * (0.95 + (ts.width * 0.25)), 0, 0.05));
      if (u.side === 'enemy') dest.lerpVectors(from, dest, 0.7);
      dest.y = from.y;
      if (u.side === 'party') s.play('walk', { speed: 2 });
      this.camFocus(dest.clone().lerp(ts.group.position, 0.5), 0.3, 5);
      if (!ev.counter) sfx('step');
      await this.clock.tween(u.side === 'party' ? 0.22 : 0.18, k => s.group.position.lerpVectors(from, dest, k), ease.inOut);
      hitP = new Promise(r => s.play('attack', { onHit: r }));
      await hitP;
      if (ev.ab.fx !== 'hit' && u.side === 'party') sfx('slash');
      await this.showHits(ev, group);
      await this.wait(0.18);
      s.play('idle');
      await this.clock.tween(0.2, k => s.group.position.lerpVectors(dest, from, k), ease.inOut);
      s.group.position.copy(s.home);
      this.camHomeGo();
    } else if (phys) {
      hitP = new Promise(r => s.play('attack', { onHit: r }));
      await hitP; await this.showHits(ev, group); s.play('idle');
    } else {
      // 시전
      const elemCol = ELEM_HEX[ev.ab.elem] || (ev.ab.type === 'heal' ? 0x9dffb0 : 0x7ef0ff);
      this.fx.magicCircle(s.group.position, elemCol, 1.1, u.boss ? 1.8 : 0.9);
      sfx('cast');
      if (u.boss) this.camFocus(s.group.position, 0.25);
      hitP = new Promise(r => s.play(ev.anim === 'guard' ? 'guard' : 'cast', { onHit: r }));
      await hitP;
      await this.wait(0.3);
      if (ev.ab.type === 'mag' && t0 && targets.length === 1) {
        this.fx.orb(this.chest(u), this.chest(t0), elemCol, 0.28);
        await this.wait(0.26);
      }
      // 광역 마법은 대상마다 효과
      if (ev.ab.type === 'mag' || (ev.ab.fx && ['fire', 'ice', 'bolt', 'wind', 'light', 'dark', 'quake', 'poison', 'roar'].includes(ev.ab.fx))) {
        for (const t of targets) this.spellFx(ev.ab, t);
        if (targets.length > 1) this.stage.addShake(0.12, 0.3);
      }
      await this.showHits(ev, group);
      await this.wait(0.15);
      if (ev.anim !== 'guard') s.play('idle');
      this.camHomeGo();
    }
    // 수호 이동 복귀
    for (const [, sp] of this.sprites) if (sp.coverReturn) { const a = sp.group.position.clone(), b = sp.coverReturn; sp.coverReturn = null; this.clock.tween(0.2, k => sp.group.position.lerpVectors(a, b, k)); sp.play('idle'); }
  }

  spellFx(ab, t) {
    const pos = this.spr(t).group.position.clone();
    const fx = ab.fx;
    if (fx === 'quake') { this.fx.burst(pos.setY(0.1), { n: 20, color: 0xb08a5a, colors: [0xb08a5a, 0x8c6a44, 0xd4b07c], speed: 4, life: 0.8, size: 0.16, g: 10, floor: 0.02, up: 2 }); sfx('land'); this.stage.addShake(0.2, 0.4); }
    else if (fx === 'poison') { this.fx.burst(pos.setY(0.6), { n: 20, color: 0xa060ff, colors: [0xa060ff, 0x60c040], speed: 1.2, life: 1, size: 0.4, glow: true, g: -0.5 }); sfx('dark'); }
    else if (fx === 'roar') { this.stage.addShake(0.25, 0.6); sfx('dark'); this.fx.burst(pos.setY(0.8), { n: 10, color: 0xff5060, speed: 2, life: 0.6, size: 0.6, glow: true, g: 0 }); }
    else if (ab.type === 'heal' || fx === 'heal') { /* showHit에서 처리 */ }
    else if (ab.elem && ELEM_HEX[ab.elem]) { this.fx.spell(ab.elem, pos); sfx(ab.elem); }
  }

  async showHits(ev, group) {
    let first = true;
    for (const h of group) {
      if (h.e === 'hit') {
        if (!first && h.index !== undefined) await this.wait(0.13);
        first = false;
        await this.showHit(h, ev);
      } else await this.playMisc(h);
    }
  }

  async showHit(h, act) {
    const t = h.t, ts = this.spr(t);
    const pos = this.chest(t);
    if (h.miss) { this.ui.popup(pos, 'MISS', 'miss'); sfx('miss'); return; }
    if (h.heal !== undefined && !h.absorb) {
      this.fx.heal(ts.group.position); sfx('heal');
      this.ui.popup(pos, h.heal, 'heal');
      this.ui.updateUnit(t, h.hpAfter);
      return;
    }
    if (h.absorb) {
      this.fx.heal(ts.group.position, 0x9dffb0); sfx('resist');
      this.ui.popup(pos, h.heal, 'heal'); this.ui.popup(pos.clone().add(new THREE.Vector3(0, 0.4, 0)), '흡수', 'stat');
      this.ui.updateTag(t, h.hpAfter); return;
    }
    const u = h.u;
    const elems = h.elems || [];
    const mainElem = elems[elems.length - 1];
    const phys = act?.anim === 'attack' || (h.ab && h.ab.type === 'phys');
    // 타격 연출
    if (phys) {
      const col = ELEM_HEX[mainElem] || 0xffffff;
      if (mainElem === 'pierce' || h.ab?.fx === 'thrust') this.fx.burst(pos, { n: 8, color: 0xffffff, speed: 5, life: 0.2, size: 0.1, g: 0, spread: 0.3 });
      else this.fx.slash(pos, col, u.side === 'party' ? -0.7 : 0.7, h.crit ? 2 : 1.4);
      if (ELEM_HEX[mainElem] && mainElem !== 'slash') this.fx.spell(mainElem, this.spr(t).group.position);
    }
    this.fx.hit(pos, elems, h.crit || h.weak);
    // 흔들림/히트스톱 (크리티컬·약점일수록 강하게)
    const heavy = h.crit || h.broke || h.kill;
    this.stage.addShake(h.crit ? 0.32 : h.weak ? 0.18 : 0.08, h.crit ? 0.35 : 0.2);
    this.clock.stop(h.broke ? 0.2 : h.crit ? 0.13 : h.weak ? 0.07 : 0.035);
    if (h.crit) { this.stage.flash(0xffffff, 0.35); sfx('crit'); } else sfx(heavy ? 'heavy' : 'hit');
    if (h.weak) sfx('weak'); if (h.resist) sfx('resist');
    // 경직 + 넉백
    ts.flash(0.12);
    if (t.alive || !h.kill) ts.play('hurt', { onEnd: () => { if (t.alive) ts.play(t.side === 'party' && t.hp < t.maxhp * 0.25 ? 'guard' : 'idle'); } });
    const kb = (t.side === 'enemy' ? -1 : 1) * (h.crit ? 0.45 : 0.22);
    this.clock.tween(0.25, k => { ts.offset.x = kb * Math.sin(k * Math.PI) * (1 - k * 0.3); });
    // 숫자
    const cls = 'dmg' + (h.crit ? ' crit' : '') + (h.weak ? ' weak' : '') + (h.resist ? ' resist' : '') + (t.side === 'party' ? ' hurt' : '');
    this.ui.popup(pos, h.dmg, cls);
    if (h.crit) this.ui.popup(pos.clone().add(new THREE.Vector3(0, 0.45, 0)), 'CRITICAL!', 'tag crit');
    else if (h.weak) this.ui.popup(pos.clone().add(new THREE.Vector3(0, 0.45, 0)), 'WEAK', 'tag weak');
    else if (h.resist) this.ui.popup(pos.clone().add(new THREE.Vector3(0, 0.45, 0)), 'RESIST', 'tag resist');
    if (h.drain) { this.ui.popup(this.chest(u), h.drain, 'heal'); this.ui.updateUnit(u, h.uHpAfter); }
    if (t.side === 'party') this.ui.updateUnit(t, h.hpAfter); else this.ui.updateTag(t, h.hpAfter);
    if (h.broke) await this.playBreak(t);
    if (h.kill) t._dying = true;
  }

  async playBreak(t) {
    const s = this.spr(t);
    const pos = this.chest(t);
    sfx('break');
    this.fx.shatter(pos, 0x7ef0ff);
    this.stage.flash(0xbff4ff, 0.55);
    this.stage.addShake(0.4, 0.5);
    banner('BREAK!!', 'break');
    this.ui.updateTag(t);
    this.camFocus(s.group.position, 0.35, 8);
    await this.wait(0.45);
    s.play('hurt');
    this.camHomeGo();
  }

  // 사망 처리 + 막타 연출
  async afterDeaths() {
    const dying = this.battle.units.filter(u => u._dying);
    if (!dying.length) return;
    const lastEnemy = !this.battle.enemies.some(e => e.alive);
    for (const u of dying) {
      u._dying = false;
      const s = this.spr(u);
      if (u.side === 'party') { s.play('ko'); sfx('ko'); this.ui.updateUnit(u, 0); continue; }
      if (lastEnemy && u === dying[dying.length - 1]) {
        // 막타: 슬로모션 + 줌인 + 섬광
        this.clock.scale = 0.22;
        this.camFocus(s.group.position, 0.55, 10);
        this.stage.flash(0xffffff, 0.8);
        this.stage.addShake(0.5, 0.6);
        banner(u.boss ? '격파!!' : 'FINISH!', 'finish');
        await this.wait(0.35);
        this.clock.scale = 1;
      }
      sfx('enemyDie');
      s.flash(0.4);
      this.fx.dissolve(s.group.position, s.height * 0.8, 0xffffff);
      if (u.boss) { this.fx.shatter(this.chest(u), 0xe45ac8); this.stage.addShake(0.5, 1.2); }
      this.clock.tween(u.boss ? 1.2 : 0.5, k => { s.setAlpha(1 - k); s.offset.y = k * 0.3; }).then(() => { s.group.visible = false; });
      this.ui.updateTag(u, 0);
    }
    await this.wait(0.55);
    if (lastEnemy) this.camHomeGo(2);
  }

  async playLand(ev, group) {
    const u = ev.u, s = this.spr(u);
    const ts = ev.t && this.spr(ev.t);
    s.group.visible = true;
    const dest = ts ? ts.group.position.clone().add(new THREE.Vector3(0.6, 0, 0.05)) : s.home.clone();
    dest.y = 0;
    s.group.position.copy(dest);
    s.play('attack');
    this.camFocus(dest, 0.35, 6);
    sfx('jump');
    await this.clock.tween(0.22, k => { s.offset.y = (1 - k) * 9; }, ease.in);
    s.offset.y = 0;
    sfx('land'); this.fx.dust(dest); this.stage.addShake(0.35, 0.4);
    this.fx.pillar(dest, 0xe0f0ff, 0.35, 0.35, 5);
    await this.showHits({ anim: 'attack', ab: ABILITIES.jump }, group);
    await this.wait(0.3);
    s.play('idle');
    await this.clock.tween(0.25, k => s.group.position.lerpVectors(dest, s.home, k));
    this.camHomeGo();
    this.ui.updateUnit(u);
  }

  async playPhase(ev) {
    const t = ev.t, s = this.spr(t);
    this.ui.clearCmd?.();
    this.camFocus(s.group.position, 0.5, 2);
    sfx('phase');
    this.stage.addShake(0.3, 2.2);
    for (let i = 0; i < 6; i++) {
      s.flash(0.12, i % 2 ? 0xffffff : 0xe45ac8);
      this.fx.burst(this.chest(t), { n: 14, color: 0xe45ac8, speed: 3, life: 0.7, size: 0.4, glow: true, g: 0 });
      await this.wait(0.22);
    }
    this.stage.flash(0xffffff, 1);
    this.fx.shatter(this.chest(t), 0x7ef0ff);
    if (ev.phase.design) s.setSheet(monsterSheet(ev.phase.design));
    t.design = ev.phase.design || t.design;
    if (ev.phase.tint) s.glow = 0.4;
    await this.wait(0.3);
    banner(esc(t.name), 'boss long');
    await this.wait(1.0);
    const w = win('phase-text');
    w.innerHTML = esc(ev.phase.text) + '<div class="sub">약점이 바뀌었다!</div>';
    await this.wait(2.2);
    w.remove();
    this.ui.tagEls.get(t)?.remove(); this.ui.tagEls.delete(t); this.ui.buildTagFor?.(t);
    const tag = el('div', 'etag'); this.ui.tags.appendChild(tag); this.ui.tagEls.set(t, tag); this.ui.updateTag(t);
    this.camHomeGo();
    playBGM('boss');
  }

  // ── 승리/보상 ──
  async victory() {
    const b = this.battle;
    b.writeBack();
    const rw = b.rewards();
    for (const e of b.enemies) recordKill(e.id);
    for (const u of b.party) if (u.alive) this.spr(u).play('victory');
    playBGM('victory');
    this.camTo(new THREE.Vector3(3.6, 2.4, 6.5), new THREE.Vector3(2.6, 0.8, 0), 2);
    await this.wait(0.6);
    const g = this.game;
    g.gold += rw.gold;
    for (const d of rw.drops) addItem(d);
    const lines = [];
    const learned = [];
    for (const id of Object.keys(g.roster)) {
      const cs = g.roster[id];
      const inParty = g.party.includes(id);
      const unit = b.party.find(p => p.id === id);
      const exp = inParty ? rw.exp : Math.floor(rw.exp / 2);
      const ups = cs.hp > 0 || !inParty ? gainExp(cs, exp) : gainExp(cs, exp);
      if (ups.length) lines.push({ id, lv: cs.lv, ups });
      if (unit && unit.alive && rw.ap) {
        const r = gainAP(cs, rw.ap);
        for (const a of r.learned) learned.push({ id, ab: a });
        unit.apGain = r.amount;
      }
    }
    const w = win('result');
    const drops = rw.drops.map(d => itemInfo(d)?.name).filter(Boolean);
    w.innerHTML = `<div class="wtitle">승리!</div>
      <div class="rrow"><span>경험치</span><b class="num">${rw.exp}</b></div>
      <div class="rrow"><span>골드</span><b class="num">${rw.gold} G</b></div>
      <div class="rrow"><span>숙련 포인트</span><b class="num">${rw.ap} AP</b></div>
      ${drops.length ? `<div class="rrow"><span>획득</span><b>${drops.map(esc).join(', ')}</b></div>` : ''}
      <div class="rchars">${b.party.map(u => {
        const cs = u.cs, wab = (cs.equip.weapon && weaponAbilitiesProgress(cs)) || '';
        return `<div class="rc"><img class="face" src="${iconURL('face_' + u.id)}"><div><b>${esc(u.name)}</b> Lv ${cs.lv}${lines.find(l => l.id === u.id) ? ' <span class="lvup">LEVEL UP!</span>' : ''}<div class="apl">${wab}</div></div></div>`;
      }).join('')}</div>
      <div class="hint">▼ 확인</div>`;
    if (lines.length) sfx('levelup');
    await this.waitOk(w);
    w.remove();
    for (const l of learned) {
      sfx('learn');
      const ww = win('result learn');
      const ab = ABILITIES[l.ab];
      ww.innerHTML = `<img class="face" src="${iconURL('face_' + l.id)}"><div><b>${CHARACTERS[l.id].name}</b>이(가) <span class="abn">${ab.kind === 'passive' ? '◆' : '★'} ${esc(ab.name)}</span>을(를) 습득했다!<div class="sub">${esc(ab.desc)}<br>이제 무기를 바꿔도 등록해 두면 계속 사용할 수 있다.</div></div>`;
      await this.waitOk(ww);
      ww.remove();
    }
    this.onEnd({ result: 'win', rewards: rw });
  }

  waitOk(w) {
    return new Promise(res => {
      const m = new ListMenu(w, [], { onCancel: () => {} });
      m.handler.onKey = k => { if (k === 'ok' || k === 'cancel') { m.destroy(); res(); } return true; };
      setTimeout(() => { w.addEventListener('click', () => { m.destroy(); res(); }, { once: true }); }, 300);
    });
  }
}

function weaponAbilitiesProgress(cs) {
  const w = cs.equip.weapon;
  if (!w) return '';
  const list = (ABILITIES && itemInfo(w)?.abilities) || [];
  return list.map(id => {
    const a = ABILITIES[id];
    const cur = cs.learned.includes(id) ? a.ap : (cs.ap[id] || 0);
    const pct = Math.round(cur / a.ap * 100);
    return `<div class="apbar${cs.learned.includes(id) ? ' done' : ''}"><span>${esc(a.name)}</span><i><em style="width:${pct}%"></em></i><small>${cur}/${a.ap}</small></div>`;
  }).join('');
}
