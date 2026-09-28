import * as THREE from 'three';
import { Stage } from './gfx/stage.js';
import { buildDiorama, applyTheme, arenaMap } from './gfx/diorama.js';
import { Billboard } from './gfx/billboard.js';
import { charSheet, monsterSheet } from './art/assets.js';

const theme = new URLSearchParams(location.search).get('theme') || 'field';
const stage = new Stage(document.getElementById('view'));
const scene = new THREE.Scene();
stage.setWorld(scene);
applyTheme(scene, theme, 18);
const d = buildDiorama(arenaMap(theme));
scene.add(d.group);
const sprites = [];
const party = [['leon', 'sword'], ['sera', 'staff'], ['bran', 'sword'], ['rhea', 'spear'], ['kyle', 'rod']];
party.forEach(([id, w], i) => {
  const b = new Billboard(charSheet(id, { type: w }));
  b.group.position.set(2.2 + i * 0.5, 0, -1.6 + i * 0.9);
  b.play(['idle', 'attack', 'cast', 'idle', 'victory'][i]);
  scene.add(b.group); sprites.push(b);
});
['slime', 'mushroom', 'wolf'].forEach((id, i) => {
  const b = new Billboard(monsterSheet(id));
  
  b.group.position.set(-2.4 - (i % 2) * 0.6, 0, -1.4 + i * 1.3);
  scene.add(b.group); sprites.push(b);
});
const boss = new Billboard(monsterSheet(theme === 'boss' ? 'dragon' : 'treant'), { scale: 1.3 });
boss.group.position.set(-4.5, 0, -1.2); scene.add(boss.group); sprites.push(boss);
stage.setFov(30);
stage.camera.position.set(0.8, 5.2, 9.5);
stage.camera.lookAt(-0.2, 0.7, 0);
stage.focus = 0.42; stage.applyTilt();
let last = performance.now(), t = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
  for (const s of sprites) s.update(dt, stage.camera);
  d.update(t);
  stage.render(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
