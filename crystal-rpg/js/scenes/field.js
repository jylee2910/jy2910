// 필드 씬: 마을/던전 탐색. 그리드 이동(키보드 연속 이동 / 탭 이동 경로탐색), 대화, 상자, 세이브 수정, 인카운터, 보스
import * as THREE from 'three';
import { MAPS, ENCOUNTERS } from '../data/maps.js';
import { buildDiorama, applyTheme, makeCrystal, OCCLUSION } from '../gfx/diorama.js';
import { Billboard } from '../gfx/billboard.js';
import { makeActor, faceDir } from '../gfx/actors.js';
import { charSheet, monsterSheet, textureCanvas } from '../art/assets.js';
import { weaponLook } from '../sys/party.js';
import { CHARACTERS } from '../data/characters.js';
import { ENEMIES } from '../data/enemies.js';
import { itemInfo } from '../data/items.js';
import { G, addItem, flag, recruit, healAll, saveGame } from '../core/state.js';
import * as Q from '../sys/quests.js';
import { input } from '../core/input.js';
import { camZoom, cycleZoom } from '../core/view.js';
import { say, choice, banner, toast, el, root, icon, fade } from '../ui/ui.js';
import { sfx, playBGM } from '../core/audio.js';
import { BattleScene } from './battle.js';
import { openMenu } from '../ui/mainmenu.js';
import { openShop } from '../ui/shop.js';

const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const WALK_SPEED = 4.4;   // 칸/초
const FOLLOW_GAP = 0.78;  // 동료 간격

function chestMesh() {
  const g = new THREE.Group();
  const mk = name => { const t = new THREE.CanvasTexture(textureCanvas(name)); t.magFilter = t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshLambertMaterial({ map: t }); };
  const wood = mk('planks'), trim = new THREE.MeshLambertMaterial({ color: 0xeab84c, emissive: 0x3a2a00 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.38, 0.44), wood); body.position.y = 0.19; body.castShadow = true; g.add(body);
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.06, 0.46), trim); band.position.y = 0.3; g.add(band);
  const lidPivot = new THREE.Group(); lidPivot.position.set(0, 0.38, -0.22); g.add(lidPivot);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.62, 8, 1, false, 0, Math.PI), wood);
  lid.rotation.z = Math.PI / 2; lid.rotation.y = Math.PI / 2; lid.position.set(0, 0, 0.22); lid.castShadow = true; lidPivot.add(lid);
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.04), trim); lock.position.set(0, 0.3, 0.23); g.add(lock);
  g.userData.lid = lidPivot;
  return g;
}

export class FieldScene {
  constructor(app, mapId, spawn) {
    this.app = app; this.stage = app.stage;
    this.mapId = mapId; this.map = MAPS[mapId];
    this.spawn = spawn || this.map.start;
    this.built = false;
    this.busy = false;
    this.t = 0;
  }

  build() {
    const m = this.map;
    const scene = this.scene = new THREE.Scene();
    this.theme = applyTheme(scene, m.theme, Math.max(m.rows.length, m.rows[0].length) * 1.2);
    this.dio = buildDiorama(m);
    scene.add(this.dio.group);
    this.things = new Map(); // "x,y" -> {type, ...}
    // 상자
    for (const c of m.chests) {
      const mesh = chestMesh();
      mesh.position.copy(this.dio.toWorld(c.x, c.y));
      scene.add(mesh);
      const opened = !!G.s.chests[this.mapId + ':' + c.id];
      if (opened) mesh.userData.lid.rotation.x = -1.9;
      this.things.set(c.x + ',' + c.y, { type: 'chest', c, mesh });
    }
    // 세이브 수정
    for (const s of m.saves) {
      const cr = makeCrystal(0.3, 1.3, 0x9af0ff);
      cr.position.copy(this.dio.toWorld(s.x, s.y));
      const pl = new THREE.PointLight(0x9af0ff, 4, 6, 1.6); pl.position.y = 1.2; cr.add(pl);
      scene.add(cr);
      this.things.set(s.x + ',' + s.y, { type: 'save', mesh: cr });
    }
    // 보스
    if (m.boss && !flag(m.boss.flag)) {
      const e = ENEMIES[m.boss.enemy];
      const b = new Billboard(monsterSheet(e.design), { scale: (e.scale || 1) * 0.9 });
      b.group.position.copy(this.dio.toWorld(m.boss.x, m.boss.y));
      scene.add(b.group);
      this.bossSprite = b;
      this.things.set(m.boss.x + ',' + m.boss.y, { type: 'boss', sprite: b });
    }
    // NPC
    this.npcs = [];
    for (const n of m.npcs) {
      if (n.hideIf && flag(n.hideIf)) continue;
      if (n.showIf && !flag(n.showIf)) continue;
      const cs = G.s.roster[n.id];
      const d = CHARACTERS[n.id];
      const b = makeActor(n.design, d ? weaponLook(cs || { equip: { weapon: d.start.weapon } }) : null);
      b.yaw = 0;
      b.group.position.copy(this.dio.toWorld(n.x, n.y));
      b.time = Math.random();
      scene.add(b.group);
      const npc = { def: n, x: n.x, y: n.y, sprite: b, home: { x: n.x, y: n.y }, wanderT: 2 + Math.random() * 3 };
      this.npcs.push(npc);
      this.things.set(n.x + ',' + n.y, { type: 'npc', npc });
    }
    // 플레이어 + 동료
    this.party = [];
    this.buildPartySprites();
    // 탭 마커
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.36, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; scene.add(ring); this.marker = ring;
    this.built = true;
  }

  buildPartySprites() {
    for (const p of this.party) { this.scene.remove(p.sprite.group); p.sprite.dispose?.(); }
    this.party = [];
    const ids = G.s.party.slice(0, 3);
    ids.forEach((id, i) => {
      const cs = G.s.roster[id];
      const b = makeActor(CHARACTERS[id].design, weaponLook(cs));
      b.yaw = 180;
      this.scene.add(b.group);
      this.party.push({ id, sprite: b });
    });
  }

  enter() {
    if (!this.built) {
      this.build();
      this.px = this.spawn.x; this.py = this.spawn.y; this.dir = this.spawn.dir || 'up';
      this.trail = [];
      const back = { up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] }[this.dir];
      for (let i = 1; i <= 3; i++) { const tx = this.px + back[0] * i, ty = this.py + back[1] * i; this.trail.push(this.dio.walkable(tx, ty) ? { x: tx, y: ty } : { x: this.px, y: this.py }); }
      this.snapParty(true);
      this.encCount = this.rollEncounter();
    } else this.buildPartySprites(), this.snapParty(true);
    this.stage.setWorld(this.scene);
    this.stage.setFov(28, 1.3);
    this.stage.focus = 0.46;
    this.stage.applyTilt();
    this.camPos = null;
    input.sceneHandler = k => this.onKey(k);
    this.bindPointer();
    this.hud();
    playBGM(this.map.music);
    if (!this.entered) { banner(this.map.name, 'long'); this.entered = true; }
    G.s.loc = { scene: 'field', map: this.mapId, x: this.px, y: this.py, dir: this.dir };
  }

  exit() {
    OCCLUSION.uOccR.value = 0;
    this.unbindPointer?.();
    this.joyEl?.remove(); this.joyEl = null; this.joy = null;
    input.sceneHandler = null;
  }

  hud() {
    const h = el('div', 'field-hud');
    h.innerHTML = `<div class="loc win">${this.map.name}</div><button class="zoom-btn win" title="줌">🔍</button><button class="menu-btn win">☰ 메뉴</button>`;
    root().appendChild(h);
    h.querySelector('.menu-btn').onclick = e => { e.stopPropagation(); this.openMenu(); };
    h.querySelector('.zoom-btn').onclick = e => { e.stopPropagation(); cycleZoom(); sfx('cursor'); };
    if (!G.s.flags.hintShown) {
      G.s.flags.hintShown = true;
      const t = el('div', 'hint-bar win', matchMedia('(pointer: coarse)').matches ? '드래그: 이동 · 탭: 그곳으로 이동/대화·조사 · 🔍: 줌 · ☰: 메뉴' : '방향키/WASD: 이동(대각선 가능) · Z/Enter: 대화·조사 · X/Esc: 메뉴 · 클릭/드래그 이동');
      root().appendChild(t); setTimeout(() => t.remove(), 6000);
    }
  }

  openMenu() {
    if (this.busy || input.stack.length) return;
    this.busy = true;
    sfx('ok');
    openMenu(this.app, () => { this.busy = false; this.buildPartySprites(); this.snapParty(true); });
  }

  rollEncounter() { const r = this.map.rate; return r ? r[0] + Math.floor(Math.random() * (r[1] - r[0])) : Infinity; }

  snapParty(keepTrail) {
    this.fpos = { x: this.px, y: this.py };
    const p = this.dio.toWorld(this.px, this.py);
    this.crumbs = [p.clone()];
    // 뒤따르는 동료: 기존 자취(타일) 방향으로 늘어서도록 빵부스러기 경로를 미리 깔아 둠
    const back = keepTrail && this.trail?.length ? this.trail.map(t => this.dio.toWorld(t.x, t.y)) : [];
    let last = p;
    for (const b of back) { for (let k = 1; k <= 10; k++) this.crumbs.push(last.clone().lerp(b, k / 10)); last = b; }
    if (this.crumbs.length < 2) for (let k = 1; k <= 30; k++) this.crumbs.push(p.clone().add(new THREE.Vector3(0, 0, 0.05 * k)));
    this.leaderY = p.y;
    this.party.forEach((m, i) => { m.sprite.group.position.copy(i === 0 ? p : this.crumbAt(i * FOLLOW_GAP)); m.sprite.play('idle'); });
  }
  // 자취를 따라 거리 d만큼 뒤의 지점
  crumbAt(d) {
    const c = this.crumbs; let acc = 0;
    for (let i = 1; i < c.length; i++) {
      const seg = c[i - 1].distanceTo(c[i]);
      if (acc + seg >= d) return c[i - 1].clone().lerp(c[i], (d - acc) / (seg || 1));
      acc += seg;
    }
    return c[c.length - 1].clone();
  }
  // 실수 좌표(타일 단위)에 캐릭터가 설 수 있는지: 몸통 사각형 네 귀퉁이가 들어간 칸 검사
  canStand(x, y) {
    const R = 0.24, cx = this.px, cy = this.py;
    for (const [ox, oy] of [[0, 0], [-R, -R], [R, -R], [-R, R], [R, R]]) {
      const tx = Math.round(x + ox), ty = Math.round(y + oy);
      if (tx === cx && ty === cy) continue;
      const fromX = Math.round(x), fromY = Math.round(y);
      if (this.blockedAt(tx, ty, cx, cy)) return false;
      if ((fromX !== cx || fromY !== cy) && (tx !== fromX || ty !== fromY) && this.blockedAt(tx, ty, fromX, fromY)) return false;
    }
    return true;
  }

  blockedAt(x, y, fx, fy) {
    if (!this.dio.walkable(x, y)) return true;
    if (fx !== undefined && !this.dio.canMove(fx, fy, x, y)) return true;
    const th = this.things.get(x + ',' + y);
    return !!th;
  }

  // ── 입력 ──
  onKey(k) {
    if (this.busy) return true;
    if (k === 'menu' || k === 'cancel') { this.openMenu(); return true; }
    if (k === 'ok') {
      const th = this.thingInFront();
      if (th) { this.path = null; this.interact(th); }
      return true;
    }
    if (DIRS[k]) { this.path = null; this.pending = null; }
    return false;
  }

  // 드래그 = 가상 조이스틱, 짧은 탭 = 탭 이동/조사
  bindPointer() {
    const cv = this.stage.renderer.domElement;
    const joy = this.joy = { active: false, x: 0, y: 0, id: null, sx: 0, sy: 0 };
    const base = this.joyEl = el('div', 'joy'); base.innerHTML = '<div class="joy-knob"></div>'; base.hidden = true;
    root().appendChild(base);
    const R = 56;
    const down = e => {
      if (joy.id !== null || this.busy || input.stack.length) return;
      joy.id = e.pointerId; joy.sx = e.clientX; joy.sy = e.clientY; joy.active = false; joy.x = joy.y = 0;
      try { cv.setPointerCapture(e.pointerId); } catch (_) { /* 무시 */ }
    };
    const move = e => {
      if (e.pointerId !== joy.id) return;
      const dx = e.clientX - joy.sx, dy = e.clientY - joy.sy, d = Math.hypot(dx, dy);
      if (!joy.active && d > 14) {
        joy.active = true; base.hidden = false;
        base.style.left = joy.sx + 'px'; base.style.top = joy.sy + 'px';
      }
      if (joy.active) {
        const k = Math.min(1, d / R);
        joy.x = d ? dx / d * k : 0; joy.y = d ? dy / d * k : 0;
        base.firstChild.style.transform = `translate(${joy.x * R}px, ${joy.y * R}px)`;
      }
    };
    const up = e => {
      if (e.pointerId !== joy.id) return;
      const wasJoy = joy.active;
      joy.id = null; joy.active = false; joy.x = joy.y = 0; base.hidden = true;
      if (!wasJoy) this.onPointer(e);
    };
    cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    this.unbindPointer = () => { cv.removeEventListener('pointerdown', down); cv.removeEventListener('pointermove', move); cv.removeEventListener('pointerup', up); cv.removeEventListener('pointercancel', up); };
  }

  onPointer(e) {
    if (this.busy || input.stack.length) return;
    const r = this.stage.renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(v, this.stage.camera);
    // 스프라이트(NPC/보스) 우선 판정
    let target = null, best = 1e9;
    for (const [key, th] of this.things) {
      const obj = th.type === 'npc' ? th.npc.sprite.group : th.type === 'boss' ? th.sprite.group : th.mesh;
      const p = this.stage.project(obj.position.clone().setY(0.6));
      const d = Math.hypot(p.x - (e.clientX - r.left), p.y - (e.clientY - r.top));
      if (d < 38 && d < best) { best = d; target = key; }
    }
    let tx, ty;
    if (target) [tx, ty] = target.split(',').map(Number);
    else {
      const hits = ray.intersectObjects(this.dio.pickables, false);
      if (!hits.length) return;
      const h = hits[0], hp = h.point.clone();
      if (h.face) hp.addScaledVector(h.face.normal, -0.05);
      tx = Math.round(hp.x - this.dio.ox); ty = Math.round(hp.z - this.dio.oz);
    }
    const th = this.things.get(tx + ',' + ty);
    this.marker.position.copy(this.dio.toWorld(tx, ty)).add(new THREE.Vector3(0, 0.03, 0));
    this.marker.material.opacity = 0.9;
    if (th) {
      // 인접 칸까지 이동 후 조사
      const adj = Object.values(DIRS).map(([dx, dy]) => [tx + dx, ty + dy]).filter(([x, y]) => (x === this.px && y === this.py) || !this.blockedAt(x, y));
      if (Math.hypot(tx - this.fpos.x, ty - this.fpos.y) < 1.45) { this.face(tx - this.fpos.x, ty - this.fpos.y); this.interact(th); return; }
      let bestPath = null;
      for (const [x, y] of adj) { const p = this.findPath(x, y); if (p && (!bestPath || p.length < bestPath.length)) bestPath = p; }
      if (bestPath) { this.path = [[this.px, this.py], ...bestPath]; this.pending = { th, x: tx, y: ty }; }
      return;
    }
    const p = this.findPath(tx, ty);
    if (p) { this.path = [[this.px, this.py], ...p]; this.pending = null; }
  }

  findPath(tx, ty) {
    if (tx === this.px && ty === this.py) return [];
    if (this.blockedAt(tx, ty)) return null;
    const key = (x, y) => x + ',' + y;
    const prev = new Map([[key(this.px, this.py), null]]);
    const q = [[this.px, this.py]];
    while (q.length) {
      const [x, y] = q.shift();
      if (x === tx && y === ty) break;
      for (const [dx, dy] of Object.values(DIRS)) {
        const nx = x + dx, ny = y + dy, k = key(nx, ny);
        if (prev.has(k) || this.blockedAt(nx, ny, x, y)) continue;
        prev.set(k, [x, y]); q.push([nx, ny]);
      }
    }
    if (!prev.has(key(tx, ty))) return null;
    const path = [];
    let c = [tx, ty];
    while (c && !(c[0] === this.px && c[1] === this.py)) { path.unshift(c); c = prev.get(key(c[0], c[1])); }
    return path;
  }

  face(dx, dy) {
    if (!dx && !dy) return;
    this.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    this.faceV = { x: dx, y: dy };
    faceDir(this.party[0].sprite, dx, dy);
  }
  thingInFront() {
    const f = this.faceV || { x: DIRS[this.dir][0], y: DIRS[this.dir][1] };
    const fl = Math.hypot(f.x, f.y) || 1;
    let best = null, bs = -1e9;
    for (const [key, th] of this.things) {
      const [tx, ty] = key.split(',').map(Number);
      const dx = tx - this.fpos.x, dy = ty - this.fpos.y, d = Math.hypot(dx, dy);
      if (d > 1.45) continue;
      const dot = (dx * f.x + dy * f.y) / (fl * (d || 1));
      if (d > 0.3 && dot < 0.35) continue;
      const score = dot - d;
      if (score > bs) { bs = score; best = th; }
    }
    return best;
  }

  // 연속 이동 (타일 단위 실수 좌표). 반환: 실제 이동량
  moveBy(vx, vy, dt) {
    const sp = WALK_SPEED * dt;
    const f = this.fpos;
    let moved = 0;
    const nx = f.x + vx * sp;
    if (vx && this.canStand(nx, f.y)) { moved += Math.abs(nx - f.x); f.x = nx; }
    else if (vx && !vy) { const c = Math.round(f.y) - f.y; if (Math.abs(c) > 0.02 && Math.abs(c) < 0.48 && this.canStand(f.x + Math.sign(vx) * 0.5, Math.round(f.y))) { const s2 = Math.sign(c) * Math.min(Math.abs(c), sp); f.y += s2; moved += Math.abs(s2); } }
    const ny = f.y + vy * sp;
    if (vy && this.canStand(f.x, ny)) { moved += Math.abs(ny - f.y); f.y = ny; }
    else if (vy && !vx) { const c = Math.round(f.x) - f.x; if (Math.abs(c) > 0.02 && Math.abs(c) < 0.48 && this.canStand(Math.round(f.x), f.y + Math.sign(vy) * 0.5)) { const s2 = Math.sign(c) * Math.min(Math.abs(c), sp); f.x += s2; moved += Math.abs(s2); } }
    // 칸이 바뀌면 칸 단위 게임 로직 (출구/조우/저장)
    const tx = Math.round(f.x), ty = Math.round(f.y);
    if (tx !== this.px || ty !== this.py) {
      this.trail.unshift({ x: this.px, y: this.py }); this.trail.length = Math.min(this.trail.length, 4);
      this.px = tx; this.py = ty;
      this.arrive();
    }
    return moved;
  }

  async arrive() {
    G.s.steps++;
    G.s.loc = { scene: 'field', map: this.mapId, x: this.px, y: this.py, dir: this.dir };
    if (G.s.steps % 2 === 0) sfx('step');
    const ex = this.map.exits.find(e => e.x === this.px && e.y === this.py);
    if (ex) { this.path = null; await this.leave(ex.to); return; }
    if (this.map.encounter && --this.encCount <= 0) {
      this.encCount = this.rollEncounter();
      this.path = null;
      const list = ENCOUNTERS[this.map.encounter];
      await this.startBattle(list[Math.floor(Math.random() * list.length)], { theme: this.map.theme === 'cave' ? 'cave' : this.map.theme === 'forest' ? 'forest' : 'field' });
      return;
    }
    if (this.path && !this.path.length) {
      this.path = null;
      if (this.pending) { const p = this.pending; this.pending = null; this.face(p.x - this.px, p.y - this.py); this.interact(p.th); }
    }
  }

  async leave(to) {
    this.busy = true;
    sfx('door');
    const { WorldScene } = await import('./world.js');
    await this.app.setScene(new WorldScene(this.app, this.mapId === 'town' ? 'town' : this.mapId));
  }

  startBattle(enemies, opt = {}) {
    return new Promise(resolve => {
      this.busy = true;
      sfx('encounter');
      this.stage.flash(0xffffff, 0.8);
      this.app.setScene(new BattleScene(this.app, {
        enemies, theme: opt.theme || 'field', music: opt.music,
        onEnd: async r => {
          if (r.result === 'lose') { this.app.gameOver(); return; }
          await this.app.setScene(this);
          this.busy = false;
          resolve(r);
        },
      }), { fadeMs: 250 });
    });
  }

  // ── 상호작용 ──
  async interact(th) {
    if (this.busy) return;
    this.busy = true;
    this.path = null;
    try {
      if (th.type === 'npc') await this.talk(th.npc);
      else if (th.type === 'chest') await this.openChest(th);
      else if (th.type === 'save') await this.useSave();
      else if (th.type === 'boss') await this.bossEvent();
    } finally { this.busy = false; }
  }

  ctx(npc) {
    const self = this;
    const name = npc?.def.name, face = npc?.def.face;
    return {
      say: (text, nm) => say(nm === null ? null : (nm || name), text, { face: nm === null ? null : face }),
      ask: opts => choice(opts),
      shop: () => new Promise(r => openShop(r)),
      inn: async price => {
        if (G.s.gold < price) { await say(name, '저런, 돈이 모자라시네요…', { face }); return; }
        G.s.gold -= price;
        await fade(true, 500); sfx('inn');
        healAll(); saveGame();
        await new Promise(r => setTimeout(r, 1200));
        await fade(false, 500);
        await say(name, '안녕히 주무셨어요? 모두 기운이 넘치네요! (HP/MP 회복 · 기록 완료)', { face });
      },
      q: { state: Q.qstate, available: Q.available, accept: Q.accept, progress: Q.progress, turnIn: Q.turnIn },
      flag: (k, v) => flag(k, v),
      recruit: id => { if (recruit(id)) { sfx('learn'); toast(`${icon('star')} <b>${CHARACTERS[id].name}</b>이(가) 동료가 되었다!`); self.buildPartySprites(); self.snapParty(true); } },
      removeNpc: id => {
        const n = self.npcs.find(x => x.def.id === id); if (!n) return;
        self.things.delete(n.x + ',' + n.y); self.scene.remove(n.sprite.group); self.npcs.splice(self.npcs.indexOf(n), 1);
      },
    };
  }

  async talk(npc) {
    const s = npc.sprite;
    faceDir(s, this.px - npc.x, this.py - npc.y); // 플레이어 쪽을 바라봄
    await npc.def.talk(this.ctx(npc));
  }

  async openChest(th) {
    const key = this.mapId + ':' + th.c.id;
    if (G.s.chests[key]) { await say(null, '빈 상자다.'); return; }
    G.s.chests[key] = true;
    sfx('chest');
    const lid = th.mesh.userData.lid;
    const t0 = performance.now();
    await new Promise(r => { const f = () => { const k = Math.min(1, (performance.now() - t0) / 350); lid.rotation.x = -1.9 * k; if (k < 1) requestAnimationFrame(f); else r(); }; f(); });
    addItem(th.c.item, th.c.n);
    const info = itemInfo(th.c.item);
    await say(null, `${info.name}${th.c.n > 1 ? ' ×' + th.c.n : ''}을(를) 손에 넣었다!${info.cat === 'weapon' ? '\n(장비 메뉴에서 장착하면 새 어빌리티를 숙련할 수 있다)' : ''}`);
  }

  async useSave() {
    sfx('save');
    healAll();
    const ok = saveGame();
    this.stage.flash(0x9af0ff, 0.4);
    await say(null, ok ? '수정이 따스하게 빛난다… HP와 MP가 회복되고, 여정이 기록되었다.' : '수정이 빛난다… HP와 MP가 회복되었다. (이 환경에서는 저장할 수 없다)');
  }

  async bossEvent() {
    const b = this.map.boss;
    await say(null, b.pre);
    const c = await choice(['싸운다', '물러난다']);
    if (c !== 0) return;
    const r = await this.startBattle([b.enemy], { theme: b.theme, music: 'boss' });
    if (r.result !== 'win') return;
    flag(b.flag, true);
    this.things.delete(b.x + ',' + b.y);
    if (this.bossSprite) { this.scene.remove(this.bossSprite.group); this.bossSprite = null; }
    if (b.final) { this.app.ending(); return; }
    await say(null, b.post);
    saveGame();
  }

  // ── 매 프레임 ──
  update(dt) {
    this.t += dt;
    const blocked = this.busy || input.stack.length > 0;
    // 입력 벡터: 키보드(대각 포함) / 가상 조이스틱 / 탭 경로
    let vx = 0, vy = 0;
    if (!blocked) {
      if (input.held.has('left')) vx -= 1; if (input.held.has('right')) vx += 1;
      if (input.held.has('up')) vy -= 1; if (input.held.has('down')) vy += 1;
      if (this.joy?.active) { vx = this.joy.x; vy = this.joy.y; }
      const l = Math.hypot(vx, vy); if (l > 1) { vx /= l; vy /= l; }
      if (l > 0.15) { this.path = null; this.pending = null; }
      else { vx = vy = 0; }
      if (!vx && !vy && this.path) {
        if (!this.path.length) {
          this.path = null;
          if (this.pending) { const p = this.pending; this.pending = null; this.face(p.x - this.fpos.x, p.y - this.fpos.y); this.interact(p.th); }
        } else {
          const [tx, ty] = this.path[0];
          const dx = tx - this.fpos.x, dy = ty - this.fpos.y, d = Math.hypot(dx, dy);
          if (d < WALK_SPEED * dt * 1.2 || d < 0.04) { this.path.shift(); if (!this.path.length && !this.pending) this.path = null; }
          else { vx = dx / d; vy = dy / d; }
        }
      }
    }
    let moved = 0;
    if (vx || vy) {
      this.face(vx, vy);
      moved = this.moveBy(vx, vy, dt);
      if (!moved && this.path) this.path = null;
    }
    // 리더 위치 (높이는 부드럽게 따라감 → 계단/턱에서 툭툭 끊기지 않음)
    const leader = this.party[0].sprite;
    const groundY = this.dio.standY ? this.dio.standY(this.px, this.py) : this.dio.toWorld(this.px, this.py).y;
    this.leaderY += (groundY - this.leaderY) * (1 - Math.exp(-dt * 14));
    leader.group.position.set(this.fpos.x + this.dio.ox, this.leaderY, this.fpos.y + this.dio.oz);
    if (moved > 0.0005) {
      const lp = leader.group.position;
      if (lp.distanceTo(this.crumbs[0]) > 0.04) { this.crumbs.unshift(lp.clone()); if (this.crumbs.length > 160) this.crumbs.length = 160; }
      leader.play('walk', { restart: false, speed: 1.15 * Math.min(1, Math.hypot(vx, vy)) + 0.2 });
    } else if (leader.anim === 'walk') leader.play('idle');
    // 동료: 자취를 따라 일정 간격 유지
    this.party.forEach((m, i) => {
      if (!i) return;
      const want = this.crumbAt(i * FOLLOW_GAP);
      const g = m.sprite.group.position;
      const d = want.clone().sub(g);
      if (d.lengthSq() > 0.00002) { faceDir(m.sprite, Math.abs(d.x) > 0.002 ? d.x : 0, Math.abs(d.z) > 0.002 ? d.z : 0); m.sprite.play('walk', { restart: false }); g.copy(want); }
      else if (m.sprite.anim === 'walk') m.sprite.play('idle');
    });
    // NPC 배회
    for (const n of this.npcs) {
      n.sprite.update(dt, this.stage.camera);
      if (!n.def.wander || blocked) continue;
      if (n.walk) {
        n.walk.t += dt / 0.4; const k = Math.min(1, n.walk.t);
        n.sprite.group.position.lerpVectors(n.walk.from, n.walk.to, k);
        if (k >= 1) { n.walk = null; n.sprite.play('idle'); }
        continue;
      }
      if ((n.wanderT -= dt) > 0) continue;
      n.wanderT = 2 + Math.random() * 4;
      const [dx, dy] = Object.values(DIRS)[Math.floor(Math.random() * 4)];
      const nx = n.x + dx, ny = n.y + dy;
      if (Math.abs(nx - n.home.x) > 2 || Math.abs(ny - n.home.y) > 2 || this.blockedAt(nx, ny, n.x, n.y) || (Math.abs(nx - this.fpos.x) < 1 && Math.abs(ny - this.fpos.y) < 1) || this.party.some(m => Math.abs(m.sprite.group.position.x - this.dio.ox - nx) < 0.8 && Math.abs(m.sprite.group.position.z - this.dio.oz - ny) < 0.8) || this.trail.some(t => t.x === nx && t.y === ny)) continue;
      this.things.delete(n.x + ',' + n.y); n.x = nx; n.y = ny; this.things.set(nx + ',' + ny, { type: 'npc', npc: n });
      n.walk = { t: 0, from: n.sprite.group.position.clone(), to: this.dio.toWorld(nx, ny) };
      faceDir(n.sprite, dx, dy);
      n.sprite.play('walk');
    }
    for (const m of this.party) m.sprite.update(dt, this.stage.camera);
    if (this.bossSprite) { this.bossSprite.update(dt, this.stage.camera); }
    for (const th of this.things.values()) if (th.type === 'save') th.mesh.rotation.y += dt * 0.8;
    this.marker.material.opacity = Math.max(0, this.marker.material.opacity - dt * 1.5);
    this.dio.update(this.t);
    this.theme.motes.update(this.t);
    // 카메라 추적
    const p = this.party[0].sprite.group.position;
    const portrait = this.stage.width < this.stage.height;
    const steep = this.map.theme === 'forest';
    const off = (portrait ? new THREE.Vector3(0, steep ? 10 : 8.6, steep ? 9 : 10.2) : new THREE.Vector3(0, steep ? 8.2 : 6.9, steep ? 9 : 10.4)).multiplyScalar(camZoom(portrait));
    const want = p.clone().add(off);
    if (!this.camPos) this.camPos = want.clone();
    this.camPos.lerp(want, 1 - Math.exp(-dt * 5));
    this.stage.camera.position.copy(this.camPos);
    this.stage.camera.lookAt(this.camPos.clone().sub(off).add(new THREE.Vector3(0, 0.4, 0)));
    // 가림 처리 유니폼 (플레이어 가슴 높이의 화면 좌표/깊이)
    this.stage.camera.updateMatrixWorld();
    const c = p.clone().add(new THREE.Vector3(0, 0.7, 0)).project(this.stage.camera);
    const zf = camZoom(portrait);
    this.stage.focusOn(p.clone().add(new THREE.Vector3(0, 0.6, 0)), 2.2 * zf * zf, 0.28 / zf);
    const pr = this.stage.pixelRatio;
    OCCLUSION.uOccPos.value.set((c.x * 0.5 + 0.5) * this.stage.width * pr, (c.y * 0.5 + 0.5) * this.stage.height * pr);
    OCCLUSION.uOccDepth.value = c.z * 0.5 + 0.5 - 0.0005;
    OCCLUSION.uOccR.value = 70 * pr * (portrait ? 0.8 : 1);
  }
}
