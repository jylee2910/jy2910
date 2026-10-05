// 타이틀 / 엔딩 / 게임오버
import * as THREE from 'three';
import { MAPS } from '../data/maps.js';
import { buildDiorama, applyTheme } from '../gfx/diorama.js';
import { Billboard } from '../gfx/billboard.js';
import { charSheet } from '../art/assets.js';
import { G, newGameState, hasSave, loadGame, deleteSave } from '../core/state.js';
import { ListMenu, el, root, win, say, fade } from '../ui/ui.js';
import { playBGM, sfx, initAudio, audioSettings, applyVolumes } from '../core/audio.js';
import { FX } from '../gfx/fx.js';

function loadAudioPrefs() {
  try { const a = JSON.parse(localStorage.getItem('crystal-rpg-audio') || 'null'); if (a) Object.assign(audioSettings, a); applyVolumes(); } catch (e) { /* 무시 */ }
}

export class TitleScene {
  constructor(app, mode = 'title') { this.app = app; this.stage = app.stage; this.mode = mode; this.t = 0; }

  enter() {
    loadAudioPrefs();
    const scene = this.scene = new THREE.Scene();
    this.theme = applyTheme(scene, this.mode === 'ending' ? 'town' : 'town', 30);
    if (this.mode !== 'ending') { scene.background = null; this.sky(scene, '#1a2a6a', '#f0a070'); this.theme.sun.color.set('#ffb080'); this.theme.sun.intensity = 2.0; this.theme.hemi.intensity = 0.8; }
    this.dio = buildDiorama(MAPS.town);
    scene.add(this.dio.group);
    this.fx = new FX(scene, this.stage);
    const hero = new Billboard(charSheet('leon', { type: 'sword' }));
    hero.group.position.copy(this.dio.toWorld(11, 11)); scene.add(hero.group);
    const sera = new Billboard(charSheet('sera', { type: 'staff', tint: { G: 'green', g: 'greenS', W: 'greenL' } }));
    sera.group.position.copy(this.dio.toWorld(12, 11)).add(new THREE.Vector3(0, 0, 0.3)); scene.add(sera.group);
    this.sprites = [hero, sera];
    if (this.mode === 'ending') { hero.play('victory'); sera.play('victory'); }
    this.stage.setWorld(scene);
    this.stage.setFov(30);
    this.stage.focus = 0.42; this.stage.applyTilt();
    this.ui = el('div', 'title-ui'); root().appendChild(this.ui);
    if (this.mode === 'ending') this.ending();
    else this.titleMenu();
  }

  sky(scene, a, b) {
    const c = document.createElement('canvas'); c.width = 4; c.height = 256;
    const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, a); g.addColorStop(1, b); x.fillStyle = g; x.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; scene.background = t;
    scene.fog.color.set('#c08070');
  }

  titleMenu() {
    this.ui.innerHTML = `<div class="logo"><div class="l1">수정의 메아리</div><div class="l2">— Echoes of the Crystal —</div></div><div class="press">PRESS ANY KEY</div><div class="copy">© 오리지널 팬메이드 미니 RPG · 모든 그래픽/사운드는 코드로 생성</div>`;
    playBGM('title');
    const go = () => {
      if (this.menu) return;
      initAudio(); playBGM('title');
      this.ui.querySelector('.press')?.remove();
      const w = win('title-menu', this.ui);
      const can = hasSave();
      w.style.pointerEvents = 'none'; setTimeout(() => { w.style.pointerEvents = ''; }, 350);
      this.menu = new ListMenu(w, [{ label: '새로운 모험', data: 'new' }, { label: '이어하기', data: 'load', disabled: !can }], {
        index: can ? 1 : 0,
        onSelect: async it => {
          if (it.data === 'new') {
            if (can) { this.menu.setActive(false); const { choice } = await import('../ui/ui.js'); const c = await choice(['기존 기록을 지우고 시작', '그만둔다'], { title: '새 게임' }); this.menu.setActive(true); if (c !== 0) return; deleteSave(); }
            G.s = newGameState();
            this.app.startGame(true);
          } else if (loadGame()) this.app.startGame(false);
          else sfx('buzz');
        },
      });
    };
    this.pressHandler = () => go();
    window.addEventListener('pointerdown', this.pressHandler, { once: true });
    window.addEventListener('keydown', this.pressHandler, { once: true });
  }

  async ending() {
    playBGM('title');
    this.ui.innerHTML = '';
    const lines = [
      '수정룡 아스테리온이 쓰러지자, 동굴 가득 맑은 울림이 퍼졌다.',
      '용이 삼켰던 빛은 메아리가 되어 엘름 마을로 돌아왔고,',
      '광장의 수호 수정은 다시 푸르게 빛나기 시작했다.',
      '무기에 깃든 기억을 제 것으로 만들고, 서로의 힘을 공명시킨 여행자들.',
      '그들의 이야기는 오래도록 마을의 노래로 남았다.',
    ];
    const box = el('div', 'ending-text'); this.ui.appendChild(box);
    for (const l of lines) {
      const p = el('p', '', l); box.appendChild(p);
      this.fx.burst(new THREE.Vector3(0, 1.5, 0), { n: 30, colors: [0x7ef0ff, 0xffffff, 0xfff4c0], speed: 2, life: 1.5, size: 0.25, glow: true, g: -1, spread: 3 });
      await new Promise(r => setTimeout(r, 2600));
    }
    const end = el('div', 'the-end', 'THE END'); this.ui.appendChild(end);
    sfx('levelup');
    await new Promise(r => setTimeout(r, 1500));
    const w = win('title-menu', this.ui);
    new ListMenu(w, [{ label: '타이틀로', data: 1 }], { onSelect: () => this.app.toTitle() });
  }

  exit() {
    if (this.pressHandler) { window.removeEventListener('pointerdown', this.pressHandler); window.removeEventListener('keydown', this.pressHandler); }
    this.menu?.destroy();
    this.ui.remove();
  }

  update(dt) {
    this.t += dt;
    for (const s of this.sprites) s.update(dt, this.stage.camera);
    this.fx.update(dt);
    this.dio.update(this.t); this.theme.motes.update(this.t);
    const a = this.t * 0.06 + 0.4;
    const r = this.stage.width < this.stage.height ? 19 : 15;
    this.stage.camera.position.set(Math.sin(a) * r, 8 + Math.sin(this.t * 0.2) * 0.5, Math.cos(a) * r);
    this.stage.camera.lookAt(0, 0, 0);
    this.stage.focusOn(new THREE.Vector3(0, 0.5, 0), 3, 0.25);
    if (this.mode === 'ending' && Math.random() < 0.3) this.fx.aura(new THREE.Vector3(0, 0.2, -1.5), 0x7ef0ff, 4);
  }
}

export class GameOverScene {
  constructor(app) { this.app = app; }
  enter() {
    playBGM('gameover');
    this.ui = el('div', 'gameover'); root().appendChild(this.ui);
    this.ui.innerHTML = '<div class="go-t">전멸했다…</div><div class="go-s">빛이 꺼지기 전에, 다시 한 번.</div>';
    const w = win('title-menu', this.ui);
    this.menu = new ListMenu(w, [{ label: '마지막 기록부터', data: 'load', disabled: !hasSave() }, { label: '타이틀로', data: 'title' }], {
      index: hasSave() ? 0 : 1,
      onSelect: it => { if (it.data === 'load' && loadGame()) this.app.startGame(false); else this.app.toTitle(); },
    });
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x000000);
    this.app.stage.setWorld(this.scene);
  }
  exit() { this.menu.destroy(); this.ui.remove(); }
  update() {}
}
