// 앱 진입점: 스테이지/루프/씬 전환/입력/오디오 초기화
import { Stage } from './gfx/stage.js';
import { input } from './core/input.js';
import { initAudio } from './core/audio.js';
import { preloadOverrides } from './art/assets.js';
import { G, newGameState, recruit } from './core/state.js';
import { newChar } from './sys/party.js';
import { fade } from './ui/ui.js';
import { BattleScene } from './scenes/battle.js';

export const app = {
  stage: null, scene: null, battleSpeed: 1, playTimer: 0,
  async setScene(sc, { fadeMs = 300 } = {}) {
    if (this.scene) { await fade(true, fadeMs); this.scene.exit(); }
    input.stack.length = 0;
    input.sceneHandler = null;
    document.getElementById('ui').innerHTML = '';
    this.scene = sc;
    await sc.enter();
    await fade(false, fadeMs);
  },
};

window.__app = app; // 디버그용

async function boot() {
  input.init();
  const unlock = () => initAudio();
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  await preloadOverrides();
  app.stage = new Stage(document.getElementById('view'));
  let last = performance.now();
  const loop = now => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (app.scene) app.scene.update(dt);
    if (G.s) G.s.playTime += dt;
    app.stage.render(dt);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  const q = new URLSearchParams(location.search);
  if (q.get('test') === 'battle') {
    G.s = newGameState();
    const lv = +(q.get('lv') || 5);
    G.s.party = (q.get('party') || 'leon,sera,bran').split(',');
    G.s.roster = {};
    for (const id of G.s.party) G.s.roster[id] = newChar(id, lv);
    const run = () => app.setScene(new BattleScene(app, { enemies: (q.get('foes') || 'slime,mushroom,wolf').split(','), theme: q.get('theme') || 'field', onEnd: run }));
    run();
    return;
  }
  const { TitleScene } = await import('./scenes/title.js');
  app.setScene(new TitleScene(app));
}
boot();
