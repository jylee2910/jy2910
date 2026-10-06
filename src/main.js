import { assets } from './engine/assets.js';
import { input } from './engine/input.js';
import { Renderer } from './engine/renderer.js';
import { FieldScene } from './scenes/fieldScene.js';

class Game {
  constructor() {
    this.renderer = new Renderer(document.getElementById('view'));
    this.ui = document.getElementById('ui');
    this.state = {};
    this.party = { leaderSprite: () => 'kael' };
    this.scene = null;
    this.last = performance.now();
  }

  async boot() {
    const fill = document.querySelector('.ld-fill');
    await assets.loadAll((p) => (fill.style.width = Math.round(p * 100) + '%'));
    document.getElementById('loading').classList.add('hide');
    const params = new URLSearchParams(location.search);
    this.setScene(new FieldScene(this));
    requestAnimationFrame((t) => this.loop(t));
  }

  setScene(s) {
    this.scene?.exit?.();
    this.scene = s;
    this.renderer.setCamera(s.camera);
    s.enter?.();
  }

  loop(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    input.pollPad();
    this.scene.update(dt);
    this.renderer.render(this.scene.scene, this.scene.camera, now / 1000);
    input.endFrame();
    requestAnimationFrame((t) => this.loop(t));
  }
}

window.game = new Game();
window.game.boot();
