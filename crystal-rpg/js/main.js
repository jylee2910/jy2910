// 앱 진입점: 스테이지/루프/씬 전환/입력/오디오 초기화
import { Stage } from './gfx/stage.js';
import { input } from './core/input.js';
import { initAudio } from './core/audio.js';
import { preloadOverrides } from './art/assets.js';
import { G, newGameState, recruit } from './core/state.js';
import { newChar } from './sys/party.js';
import { fade } from './ui/ui.js';
import { BattleScene } from './scenes/battle.js';
import { setPortraitHook } from './art/assets.js';
import { portraitURL, HAS_RIG } from './gfx/actors.js';

export const app = {
  stage: null, scene: null, battleSpeed: 1, playTimer: 0,
  async setScene(sc, { fadeMs = 300 } = {}) {
    if (this.scene) { await fade(true, fadeMs); this.scene.exit(); }
    input.stack.length = 0;
    input.sceneHandler = null;
    document.getElementById('ui').innerHTML = '';
    this.scene = sc;
    try { await sc.enter(); } catch (e) { console.error('[scene enter]', e); }
    // 셰이더를 미리 컴파일해 첫 프레임 멈춤을 줄인다
    try { if (this.stage.renderer.compileAsync && this.stage.scene) await Promise.race([this.stage.renderer.compileAsync(this.stage.scene, this.stage.camera), new Promise(r => setTimeout(r, 1500))]); } catch (e) { /* 무시 */ }
    await fade(false, fadeMs);
  },
};

Object.assign(app, {
  async toTitle() {
    const { TitleScene } = await import('./scenes/title.js');
    this.setScene(new TitleScene(this));
  },
  async startGame(isNew) {
    const { FieldScene } = await import('./scenes/field.js');
    const { WorldScene } = await import('./scenes/world.js');
    const loc = G.s.loc;
    if (loc.scene === 'world') await this.setScene(new WorldScene(this, loc.node));
    else await this.setScene(new FieldScene(this, loc.map, { x: loc.x, y: loc.y, dir: loc.dir }));
    if (isNew) {
      const { say } = await import('./ui/ui.js');
      this.scene.busy = true;
      await say(null, ['— 수정의 가호를 받는 작은 마을, 엘름.', '열흘 전, 광장의 수호 수정이 갑자기 빛을 잃었다.', '그날 이후 숲의 짐승들은 사나워지고, 마을 사람들의 얼굴에도 그늘이 졌다…']);
      await say('세라', '레온, 촌장님이 부르셨어. 광장 왼쪽의 촌장님 댁으로 가 보자!', { face: 'sera' });
      this.scene.busy = false;
    }
  },
  async gameOver() {
    const { GameOverScene } = await import('./scenes/title.js');
    this.setScene(new GameOverScene(this));
  },
  async ending() {
    const { TitleScene } = await import('./scenes/title.js');
    this.setScene(new TitleScene(this, 'ending'), { fadeMs: 1200 });
  },
});
window.__app = app; window.__G = G; // 디버그용

async function boot() {
  input.init();
  const unlock = () => initAudio();
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  await preloadOverrides();
  app.stage = new Stage(document.getElementById('view'));
  setPortraitHook(id => (HAS_RIG(id) ? portraitURL(id, 'face') : null));
  let last = performance.now();
  let errCount = 0;
  const loop = now => {
    requestAnimationFrame(loop); // 예외가 나도 루프는 계속
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    try {
      if (app.scene) app.scene.update(dt);
      if (G.s) G.s.playTime += dt;
      app.stage.render(dt);
    } catch (e) { if (errCount++ < 5) console.error('[loop]', e); }
    input.prune();
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
  if (q.get('test') === 'field') {
    G.s = newGameState();
    G.s.party = (q.get('party') || 'leon,sera,bran').split(',');
    G.s.roster = {};
    for (const id of G.s.party) G.s.roster[id] = newChar(id, +(q.get('lv') || 5));
    import('./scenes/field.js').then(({ FieldScene }) => app.setScene(new FieldScene(app, q.get('map') || 'town', { x: +(q.get('x') || 12), y: +(q.get('y') || 13), dir: 'up' })));
    return;
  }
  app.toTitle();
}
boot();
