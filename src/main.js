import * as THREE from 'three';
import { assets } from './engine/assets.js';
import { audio } from './engine/audio.js';
import { input } from './engine/input.js';
import { Renderer } from './engine/renderer.js';
import { BattleScene } from './battle/battleScene.js';
import { GameState } from './game/state.js';
import { CastleScene } from './scenes/castleScene.js';
import { EventRunner } from './scenes/events.js';
import { FieldScene } from './scenes/fieldScene.js';
import { TitleScene } from './scenes/titleScene.js';
import { fade } from './ui/dialogue.js';
import { el, sleep } from './ui/dom.js';
import { openMenu } from './ui/menu.js';
import { showTutorial } from './ui/tutorial.js';
import { setupTouch } from './ui/touch.js';

// minimal scene used while narrating over black
class BlackScene {
  constructor(game) {
    this.game = game;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0);
    this.camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 10);
    this.events = new EventRunner(this);
  }
  update(dt) {
    this.events.update(dt);
  }
}

class Game {
  constructor() {
    this.renderer = new Renderer(document.getElementById('view'));
    this.state = new GameState();
    this.assets = assets;
    this.scene = null;
    this.field = null;
    this.modal = false;
    this.last = performance.now();
  }

  async boot() {
    const fill = document.querySelector('.ld-fill');
    await assets.loadAll((p) => (fill.style.width = Math.round(p * 100) + '%'));
    const params = new URLSearchParams(location.search);
    this.dtScale = +(params.get('dt') || 1);
    this.auto = params.get('auto') === '1';
    window.addEventListener('pointerdown', () => audio.unlock());
    window.addEventListener('keydown', () => audio.unlock());
    setupTouch();
    requestAnimationFrame((t) => this.loop(t));
    document.getElementById('loading').classList.add('hide');
    const sc = params.get('scene');
    if (params.get('battle')) {
      for (const id of (params.get('party') || 'kael,argen,mira,nell').split(',')) this.state.join(id);
      if (params.get('echo')) this.giveEchoes();
      this.setScene(new BattleScene(this, params.get('battle'), { onEnd: () => location.reload() }));
    } else if (sc === 'field') {
      this.state.flags.audience = true;
      if (params.get('flags')) for (const f of params.get('flags').split(',')) this.state.flags[f] = true;
      if (this.state.flags.meet) ['mira', 'nell'].forEach((id) => this.state.join(id));
      if (params.get('echo')) this.giveEchoes();
      if (params.get('pos')) this.state.fieldPos = params.get('pos').split(',').map(Number);
      this.gotoField();
    } else if (sc === 'castle') this.setScene(new CastleScene(this));
    else this.setScene(new TitleScene(this));
  }

  giveEchoes() {
    this.state.gainEcho('liriel');
    this.state.gainEcho('voltaire');
    this.state.equipEcho('mira', 'liriel');
    this.state.equipEcho('nell', 'voltaire');
  }

  setScene(s) {
    this.scene?.exit?.();
    this.scene = s;
    this.renderer.setCamera(s.camera);
    s.enter?.();
  }

  // ----------------------------------------------------------------- flow
  async newGame() {
    this.state.reset();
    this.field = null;
    const b = new BlackScene(this);
    this.setScene(b);
    await b.events.run('prologue');
    audio.stop(1.5);
    this.setScene(new CastleScene(this));
  }

  continueGame() {
    if (!this.state.load()) return this.newGame();
    this.field = null;
    if (!this.state.flags.audience) this.setScene(new CastleScene(this));
    else this.gotoField();
  }

  async bossDemo() {
    this.state.reset();
    for (const id of ['mira', 'nell']) this.state.join(id);
    this.giveEchoes();
    for (const m of this.state.party) {
      m.level = 9;
      m.hp = m.stats.hp;
      m.mp = m.stats.mp;
      m.resonance = m.id === 'kael' ? 70 : 40;
    }
    this.state.flags.tut_break = true;
    await this.battle('boss', { noReturn: true });
    location.reload();
  }

  async gotoField() {
    await fade(1, 300);
    if (!this.field) this.field = new FieldScene(this);
    this.setScene(this.field);
    await fade(0, 900);
  }

  battle(troop, opts = {}) {
    return new Promise((resolve) => {
      const back = this.scene;
      const post = this.renderer.post.grade;
      // swirl + flash transition
      const t0 = performance.now();
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / 700);
        post.radial.value = k * 1.6;
        post.flash.value = k * 0.9;
        post.flashColor.value.setRGB(1, 1, 1);
        if (k < 1) return requestAnimationFrame(step);
        const bs = new BattleScene(this, troop, {
          onEnd: async (result) => {
            await fade(1, 500);
            if (!opts.noReturn && back) {
              this.setScene(back);
              back.resume?.();
            }
            post.radial.value = 0;
            await fade(0, 700);
            resolve(result);
          },
        });
        this.setScene(bs);
        post.flash.value = 0;
      };
      step();
    });
  }

  tutorial(pages) {
    return showTutorial(pages);
  }

  openMenu(tab) {
    if (this.modal) return Promise.resolve();
    return openMenu(this, tab);
  }

  async chapterEnd() {
    await fade(1, 1200);
    const card = el('div', 'narration', `<div class="ln" style="font-size:16px;letter-spacing:.5em;color:#9fd8ff">CHAPTER 1</div><div class="ln" style="animation-delay:.8s;font-size:40px">공명의 시작</div><div class="ln" style="animation-delay:2s;font-size:18px;color:#f2cf6a">― 완 ―</div><div class="ln" style="animation-delay:3.4s;font-size:14px;color:#9fb6d6;margin-top:30px">To be continued…</div>`);
    card.style.zIndex = 45;
    document.getElementById('ui').appendChild(card);
    await sleep(this.auto ? 2000 : 6500);
    card.style.transition = 'opacity 1.2s';
    card.style.opacity = 0;
    await sleep(1200);
    card.remove();
    await fade(0, 1200);
  }

  async gameOver() {
    audio.stop(1);
    const card = el('div', 'narration', `<div class="ln" style="font-family:Cinzel,serif;font-size:56px;color:#ffb0c0;text-shadow:0 0 18px #a0204a">GAME OVER</div><div class="ln" style="animation-delay:1s;font-size:15px">Enter: 마지막 기록부터 다시 시작</div>`);
    card.style.zIndex = 45;
    document.getElementById('ui').appendChild(card);
    await fade(0.85, 800);
    await new Promise((r) => {
      const off = input.on((a) => {
        if (a === 'ok') {
          off();
          r();
        }
      });
    });
    location.reload();
  }

  loop(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000) * (this.dtScale || 1);
    this.last = now;
    input.pollPad();
    if (this.scene) {
      this.scene.update(dt);
      this.renderer.render(this.scene.scene, this.scene.camera, now / 1000);
    }
    input.endFrame();
    requestAnimationFrame((t) => this.loop(t));
  }
}

window.game = new Game();
window.game.boot();
