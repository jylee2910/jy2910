// 월드맵 씬: 미니어처 대륙 디오라마 + 노드 선택 이동 + 이동 중 인카운터
import * as THREE from 'three';
import { WORLD } from '../data/world.js';
import { ENCOUNTERS } from '../data/maps.js';
import { buildDiorama, applyTheme, makeHouse, makeCrystal } from '../gfx/diorama.js';
import { Billboard } from '../gfx/billboard.js';
import { makeActor, faceDir } from '../gfx/actors.js';
import { charSheet } from '../art/assets.js';
import { weaponLook } from '../sys/party.js';
import { CHARACTERS } from '../data/characters.js';
import { G, flag } from '../core/state.js';
import { input } from '../core/input.js';
import { win, el, ListMenu, root, say, banner, esc } from '../ui/ui.js';
import { sfx, playBGM } from '../core/audio.js';
import { BattleScene } from './battle.js';
import { FieldScene } from './field.js';
import { openMenu } from '../ui/mainmenu.js';

function hash(x, y) { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); }

// 경로 타일: 노드 사이를 L자 + 약간의 굴곡으로 잇는다
function routeTiles(a, b) {
  const pts = [[a.x, a.y]];
  let x = a.x, y = a.y;
  const midX = Math.round((a.x + b.x) / 2);
  while (x !== midX) { x += Math.sign(midX - x); pts.push([x, y]); }
  while (y !== b.y) { y += Math.sign(b.y - y); pts.push([x, y]); }
  while (x !== b.x) { x += Math.sign(b.x - x); pts.push([x, y]); }
  return pts;
}

function worldRows() {
  const [W, H] = WORLD.size;
  const grid = [], lv = [];
  for (let y = 0; y < H; y++) {
    const row = [], lr = [];
    for (let x = 0; x < W; x++) {
      const cx = (x - W / 2) / (W / 2), cy = (y - H / 2) / (H / 2);
      const d = Math.sqrt(cx * cx * 0.9 + cy * cy) + (hash(x, y) - 0.5) * 0.12 + Math.sin(x * 0.7) * 0.04;
      let t = d > 1.02 ? '~' : d > 0.93 ? '_' : '.';
      let h = d > 0.93 ? 0 : 1;
      if (t === '.') {
        const n = hash(x * 3, y * 7);
        if (n < 0.1) t = 'T'; else if (n < 0.16) t = ','; else if (n < 0.19) t = 'o';
        // 북쪽 산악: 높이 언덕 + 침엽수/바위
        const m = Math.max(0, 1 - Math.hypot((x - 17) / 8, (y - 2) / 5));
        if (m > 0.05) { h = 1 + Math.round(m * 5 + (hash(x, y * 3) - 0.5) * 1.2); if (n < 0.35) t = 't'; else if (n < 0.5) t = 'o'; }
        if (x > 20 && y > 10 && n < 0.55) t = 't';            // 동쪽 숲
        // 서쪽 낮은 언덕
        if (x < 9 && y < 9 && hash(x + 4, y) < 0.5) h = 2;
      }
      row.push(t); lr.push(Math.max(0, Math.min(9, h)));
    }
    grid.push(row); lv.push(lr);
  }
  const routes = WORLD.routes.map(r => ({ ...r, tiles: routeTiles(WORLD.nodes[r.a], WORLD.nodes[r.b]) }));
  const flat = (x, y, c) => { if (!grid[y] || grid[y][x] === undefined) return; if (c) grid[y][x] = c; lv[y][x] = 1; };
  for (const r of routes) for (const [x, y] of r.tiles) { flat(x, y, ':'); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { if (grid[y + dy]?.[x + dx] && grid[y + dy][x + dx] !== ':' && grid[y + dy][x + dx] !== '~') flat(x + dx, y + dy, grid[y + dy][x + dx] === 't' || grid[y + dy][x + dx] === 'T' || grid[y + dy][x + dx] === 'o' ? ',' : null); } }
  for (const n of Object.values(WORLD.nodes)) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const c = grid[n.y + dy]?.[n.x + dx]; if (c && c !== ':' && c !== '~') { grid[n.y + dy][n.x + dx] = n.kind === 'cave' ? '_' : '.'; lv[n.y + dy][n.x + dx] = 1; } }
  return { rows: grid.map(r => r.join('')), heights: lv.map(r => r.join('')), routes };
}

export class WorldScene {
  constructor(app, node) {
    this.app = app; this.stage = app.stage;
    this.node = node || 'town';
    this.t = 0;
  }

  build() {
    const scene = this.scene = new THREE.Scene();
    this.theme = applyTheme(scene, 'world', 34);
    const { rows, heights, routes } = worldRows();
    this.routes = routes;
    this.dio = buildDiorama({ rows, heights, objects: [], theme: 'world' }, { grass: 1 });
    scene.add(this.dio.group);
    // 넓은 바다
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshLambertMaterial({ color: 0x2a70c0 }));
    sea.rotation.x = -Math.PI / 2; sea.position.y = -0.16; scene.add(sea);
    // 노드 랜드마크
    this.markers = {};
    for (const [id, n] of Object.entries(WORLD.nodes)) {
      const g = new THREE.Group();
      g.position.copy(this.dio.toWorld(n.x, n.y));
      if (n.kind === 'town') {
        for (const [dx, dz, r] of [[-0.5, -0.3, 'roofRed'], [0.5, -0.4, 'roofBlue'], [0, 0.4, 'roofRed']]) { const h = makeHouse({ w: 2, d: 2, roof: r }); h.scale.setScalar(0.38); h.position.set(dx, 0, dz); g.add(h); }
      } else if (n.kind === 'hill') {
        const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 1.3, 6), new THREE.MeshLambertMaterial({ color: 0xf0e4c8 }));
        tower.position.y = 0.65; tower.castShadow = true; g.add(tower);
        const blades = new THREE.Group(); blades.position.set(0, 1.2, 0.25);
        for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.02), new THREE.MeshLambertMaterial({ color: 0xb44c3c })); b.position.y = 0.35; const p = new THREE.Group(); p.rotation.z = i * Math.PI / 2; p.add(b); blades.add(p); }
        g.add(blades); this.blades = blades;
      } else if (n.kind === 'forest') {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 6), new THREE.MeshLambertMaterial({ color: 0x2e6a40, flatShading: true }));
        c.position.set(0, 0.9, -0.2); c.castShadow = true; g.add(c);
      } else if (n.kind === 'cave') {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8, 0), new THREE.MeshLambertMaterial({ color: 0x6c6490, flatShading: true }));
        rock.scale.set(1.2, 0.8, 0.8); rock.position.set(0, 0.4, -0.4); rock.castShadow = true; g.add(rock);
        const hole = new THREE.Mesh(new THREE.CircleGeometry(0.3, 8), new THREE.MeshBasicMaterial({ color: 0x080818 }));
        hole.position.set(0, 0.3, 0.25); g.add(hole);
        const cr = makeCrystal(0.2, 0.7, flag('forestBoss') ? 0x7ef0ff : 0x6a5a80); cr.position.set(0.55, 0, 0.1); g.add(cr);
      }
      // 노드 발판 (빛나는 링)
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 24), new THREE.MeshBasicMaterial({ color: 0xffe8a0, transparent: true, opacity: 0.8, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; g.add(ring);
      g.userData.ring = ring;
      scene.add(g);
      this.markers[id] = g;
    }
    const leader = G.s.party[0];
    this.token = makeActor(CHARACTERS[leader].design, weaponLook(G.s.roster[leader]));
    this.token.yaw = 0;
    scene.add(this.token.group);
    this.token.group.position.copy(this.dio.toWorld(WORLD.nodes[this.node].x, WORLD.nodes[this.node].y)).add(new THREE.Vector3(0, 0, 0.5));
    this.labels = el('div', 'wlabels');
    this.built = true;
  }

  enter() {
    if (!this.built) this.build();
    this.stage.setWorld(this.scene);
    this.stage.setFov(30, 1.4);
    this.stage.focus = 0.45; this.stage.applyTilt();
    root().appendChild(this.labels);
    this.labels.innerHTML = '';
    this.labelEls = {};
    for (const [id, n] of Object.entries(WORLD.nodes)) {
      const d = el('div', 'wlabel' + (n.lock && !flag(n.lock) ? ' locked' : ''), esc(n.name));
      d.onclick = e => { e.stopPropagation(); this.clickNode(id); };
      this.labels.appendChild(d); this.labelEls[id] = d;
    }
    playBGM('world');
    G.s.loc = { scene: 'world', node: this.node };
    if (this.resume) { const r = this.resume; this.resume = null; this.travel(r.route, r.from, r.idx); }
    else this.panel();
  }
  exit() { this.closePanel(); this.labels.remove(); }

  closePanel() { if (this.menu) { this.menu.destroy(); this.menu = null; } if (this.pw) { this.pw.remove(); this.pw = null; } }

  panel() {
    this.closePanel();
    const n = WORLD.nodes[this.node];
    const w = this.pw = win('world-panel');
    w.appendChild(el('div', 'wtitle', esc(n.name)));
    w.appendChild(el('div', 'wdesc', esc(n.desc)));
    const items = [];
    if (n.enter) items.push({ label: `${n.kind === 'town' ? '마을로 들어간다' : '안으로 들어간다'}`, data: { t: 'enter' }, disabled: !!(n.lock && !flag(n.lock)) });
    for (const r of this.routes) {
      const other = r.a === this.node ? r.b : r.b === this.node ? r.a : null;
      if (!other) continue;
      items.push({ label: `→ ${WORLD.nodes[other].name}`, data: { t: 'go', to: other } });
    }
    items.push({ label: '메뉴', data: { t: 'menu' } });
    this.menu = new ListMenu(w, items, {
      onSelect: it => this.select(it.data),
      onDisabled: () => say(null, n.lockText),
      onMenu: () => this.select({ t: 'menu' }),
      onCancel: () => this.select({ t: 'menu' }),
    });
  }

  clickNode(id) {
    if (!this.menu || this.traveling) return;
    if (id === this.node) { const n = WORLD.nodes[id]; if (n.enter) this.select({ t: 'enter' }); return; }
    if (this.routes.some(r => (r.a === this.node && r.b === id) || (r.b === this.node && r.a === id))) this.select({ t: 'go', to: id });
    else { sfx('buzz'); banner('길이 이어져 있지 않다'); }
  }

  async select(d) {
    if (d.t === 'menu') { this.closePanel(); openMenu(this.app, () => { const pos = this.token.group.position.clone(); this.scene.remove(this.token.group); this.token.dispose?.(); this.token = makeActor(CHARACTERS[G.s.party[0]].design, weaponLook(G.s.roster[G.s.party[0]])); this.token.yaw = 0; this.token.group.position.copy(pos); this.scene.add(this.token.group); this.panel(); }); return; }
    if (d.t === 'enter') {
      const n = WORLD.nodes[this.node];
      if (n.lock && !flag(n.lock)) { await say(null, n.lockText); return; }
      this.closePanel();
      sfx('door');
      await this.app.setScene(new FieldScene(this.app, n.enter));
      return;
    }
    if (d.t === 'go') {
      const route = this.routes.find(r => (r.a === this.node && r.b === d.to) || (r.b === this.node && r.a === d.to));
      this.closePanel();
      this.travel(route, this.node, 0);
    }
  }

  // 경로 따라 이동. 도중 인카운터 → 전투 후 이어서
  async travel(route, from, startIdx) {
    this.traveling = true;
    const tiles = route.a === from ? route.tiles : [...route.tiles].reverse();
    const to = route.a === from ? route.b : route.a;
    const encAt = startIdx === 0 && Math.random() < route.chance ? 3 + Math.floor(Math.random() * (tiles.length - 6)) : -1;
    for (let i = startIdx + 1; i < tiles.length; i++) {
      const [x, y] = tiles[i];
      const a = this.token.group.position.clone(), b = this.dio.toWorld(x, y).add(new THREE.Vector3(0, 0, i === tiles.length - 1 ? 0.5 : 0));
      faceDir(this.token, Math.abs(b.x - a.x) > 0.01 ? Math.sign(b.x - a.x) : 0, Math.abs(b.z - a.z) > 0.01 ? Math.sign(b.z - a.z) : 0);
      this.token.play('walk', { restart: false });
      await this.tween(0.14, k => this.token.group.position.lerpVectors(a, b, k));
      if (i % 2 === 0) sfx('step');
      if (i === encAt) {
        this.token.play('idle');
        const list = ENCOUNTERS[route.enc];
        this.resume = { route, from, idx: i };
        sfx('encounter'); this.stage.flash(0xffffff, 0.8);
        const theme = route.enc === 'hills' ? 'forest' : route.enc === 'cavePath' ? 'cave' : 'field';
        this.traveling = false;
        this.app.setScene(new BattleScene(this.app, {
          enemies: list[Math.floor(Math.random() * list.length)], theme,
          onEnd: r => { if (r.result === 'lose') this.app.gameOver(); else this.app.setScene(this); },
        }), { fadeMs: 250 });
        return;
      }
    }
    this.token.play('idle');
    this.node = to;
    G.s.loc = { scene: 'world', node: to };
    this.traveling = false;
    banner(WORLD.nodes[to].name);
    this.panel();
  }

  tween(dur, fn) { return new Promise(r => { this.tw = { t: 0, dur, fn, r }; }); }

  update(dt) {
    this.t += dt;
    if (this.tw) { const tw = this.tw; tw.t += dt; const k = Math.min(1, tw.t / tw.dur); tw.fn(k); if (k >= 1) { this.tw = null; tw.r(); } }
    this.token.update(dt, this.stage.camera);
    if (this.blades) this.blades.rotation.z += dt * 1.5;
    for (const [id, g] of Object.entries(this.markers)) { g.userData.ring.material.opacity = id === this.node ? 0.6 + Math.sin(this.t * 4) * 0.3 : 0.35; }
    this.dio.update(this.t); this.theme.motes.update(this.t);
    const p = this.token.group.position;
    const portrait = this.stage.width < this.stage.height;
    const off = portrait ? new THREE.Vector3(0, 17, 13) : new THREE.Vector3(0, 12, 12.5);
    const want = p.clone().add(off);
    this.camPos = this.camPos ? this.camPos.lerp(want, 1 - Math.exp(-dt * 3)) : want;
    this.stage.camera.position.copy(this.camPos);
    this.stage.camera.lookAt(this.camPos.clone().sub(off).add(new THREE.Vector3(0, 0, portrait ? -2.5 : -1)));
    this.stage.focusOn(p, 4, 0.18);
    for (const [id, d] of Object.entries(this.labelEls || {})) {
      const q = this.stage.project(this.markers[id].position.clone().setY(1.6));
      d.style.transform = `translate(${q.x}px, ${q.y}px) translate(-50%, -100%)`;
    }
  }
}
