// Battle arenas: small dressed terrain patches with painted backdrops.
import * as THREE from 'three';
import { fbm, mulberry, smoothstep } from '../engine/noise.js';
import { brokenPillar, box, cylinder } from '../world/buildings.js';
import { setupLights, setFog } from '../world/env.js';
import { ambientMotes, fireflies, ParticleSystem } from '../world/particles.js';
import { PropField } from '../world/props.js';
import { backdrop, Sky } from '../world/sky.js';
import { Terrain } from '../world/terrain.js';

export function buildArena(kind, scene) {
  const out = { kind, update: [] };
  if (kind === 'shrine') return shrine(scene, out);
  return plains(scene, out);
}

function plains(scene, out) {
  setFog(scene, 0xc4dcf0, 30, 110);
  const sky = new Sky('day');
  scene.add(sky.mesh);
  out.sky = sky;
  out.lights = setupLights(scene, { sunDir: [-10, 20, 14], shadowSize: 16, hemi: 0.8, sunI: 2.2, sky: 0xc8dcff, ground: 0x6a5a40 });
  const height = (x, z) => (fbm(x * 0.05, z * 0.05, 3, 3) - 0.5) * 1.6 * smoothstep(6, 18, Math.hypot(x, z * 1.6)) + smoothstep(14, 30, -z) * 2.5;
  const paint = (x, z) => {
    const f = fbm(x * 0.12, z * 0.12, 8, 3);
    const d = fbm(x * 0.2 + 3, z * 0.2, 9, 2);
    return [1, f > 0.58 ? 0.9 : 0, Math.max(0, 1.4 - Math.hypot(x * 0.35, z * 0.8)) * (d > 0.45 ? 1 : 0.6), 0, 0, smoothstep(10, 22, -z) * 1.2, 0, 0];
  };
  const terrain = new Terrain({ width: 90, depth: 60, step: 0.5, x0: -45, z0: -40, height, paint });
  scene.add(terrain.mesh);
  out.terrain = terrain;
  const props = new PropField();
  const rnd = mulberry(77);
  for (let i = 0; i < 260; i++) {
    const x = -44 + rnd() * 88, z = -38 + rnd() * 30;
    if (Math.abs(x) < 9 && z > -6) continue;
    const t = rnd();
    const name = t < 0.3 ? 'pine1' : t < 0.6 ? 'tree1' : t < 0.85 ? 'tree2' : 'tree3';
    if (z > -10 && rnd() < 0.6) continue;
    props.add(name, x, terrain.heightAt(x, z) - 0.1, z, { scale: 0.9 + rnd() * 0.4 });
  }
  for (let i = 0; i < 900; i++) {
    const x = -30 + rnd() * 60, z = -14 + rnd() * 20;
    if (Math.abs(x) < 7 && Math.abs(z) < 3.2 && rnd() < 0.85) continue;
    if (z > 3.5 && rnd() < 0.7) continue;
    const t = rnd();
    const name = t < 0.6 ? 'grass' + (1 + Math.floor(rnd() * 3)) : t < 0.78 ? ['flowers_w', 'flowers_y', 'flowers_p'][Math.floor(rnd() * 3)] : t < 0.92 ? 'bush' + (1 + Math.floor(rnd() * 2)) : 'rock3';
    if (name.startsWith('bush') && Math.abs(x) < 9 && z > -6) continue;
    props.add(name, x, terrain.heightAt(x, z) - 0.02, z, { scale: (0.9 + rnd() * 0.35) * (name.startsWith('grass') ? 0.7 : 0.85) });
  }
  for (const [x, z, s] of [[-11, -5, 1.1], [12, -6, 1.3], [-14, 3, 0.8], [15, 4, 0.9]]) props.add('rock2', x, terrain.heightAt(x, z) - 0.2, z, { scale: s });
  props.build();
  scene.add(props.group);
  out.props = props;
  const m1 = backdrop('bg_mountains', 120, 34, -6, 1, 0xffffff, 3);
  const m2 = backdrop('bg_trees_far', 80, 14, -2.5, 1, 0xffffff, 5);
  if (m1) scene.add(m1);
  if (m2) scene.add(m2);
  const ps = new ParticleSystem(600, { soft: true });
  scene.add(ps.points);
  ambientMotes(ps, new THREE.Vector3(0, 0, -2), 26, { rate: 8, size: 0.06, color: [1, 0.97, 0.85, 0.5] });
  out.particles = ps;
  out.ground = (x, z) => terrain.heightAt(x, z);
  return out;
}

function shrine(scene, out) {
  setFog(scene, 0x6a7aa8, 26, 90);
  const sky = new Sky('dusk');
  scene.add(sky.mesh);
  out.sky = sky;
  out.lights = setupLights(scene, { sunDir: [-12, 14, -8], shadowSize: 16, hemi: 0.55, sunI: 1.6, sun: 0xffc890, sky: 0x8a90d0, ground: 0x3a2a40 });
  const height = (x, z) => {
    const r = Math.hypot(x, z * 1.3);
    return smoothstep(13, 16, r) * (-2.5 + fbm(x * 0.1, z * 0.1, 4, 3) * 2) + smoothstep(16, 30, -z) * 3;
  };
  const paint = (x, z) => {
    const r = Math.hypot(x, z * 1.3);
    return [r > 12 ? 1 : 0, 0, 0, 0, 0, r > 14 ? 0.6 : 0, 0, r < 13 ? 1.4 + (fbm(x * 0.3, z * 0.3, 5, 2) - 0.5) : 0];
  };
  const terrain = new Terrain({ width: 90, depth: 60, step: 0.5, x0: -45, z0: -40, height, paint });
  scene.add(terrain.mesh);
  out.terrain = terrain;
  const g = new THREE.Group();
  // ring of broken pillars
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.3;
    const x = Math.cos(a) * 11, z = Math.sin(a) * 8 - 1.5;
    if (z > 3.5) continue;
    const p = brokenPillar([5.2, 2.6, 5.2, 1.2, 4.0, 5.2, 0.8, 3.4, 5.2, 2.0][i], 0.65);
    p.position.set(x, terrain.heightAt(x, z) - 0.1, z);
    g.add(p);
  }
  // altar + steps behind the boss
  const alt = box(6, 0.6, 3.5, 'castle_wall', 'marble');
  alt.position.set(-2, 0, -7.5);
  g.add(alt);
  const alt2 = box(4, 0.6, 2.4, 'castle_wall', 'marble');
  alt2.position.set(-2, 0.6, -7.8);
  g.add(alt2);
  for (const [x, z, r] of [[5, 3, 1.1], [-8, 2.5, 0.3], [8, -4, 2.1]]) {
    const c = cylinder(0.55, 2.4, 'castle_wall', 'castle_floor', 10);
    c.rotation.z = Math.PI / 2;
    c.rotation.y = r;
    c.position.set(x, 0.55, z);
    g.add(c);
  }
  scene.add(g);
  const props = new PropField();
  props.add('crystal', -2, 1.2, -7.8, { flip: false, scale: 2.4 });
  const rnd = mulberry(5);
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2;
    const x = Math.cos(a) * (9 + rnd() * 6), z = Math.sin(a) * (6 + rnd() * 5) - 3;
    if (z > 2) continue;
    props.add(rnd() < 0.5 ? 'crystal_p' : 'crystal', x, terrain.heightAt(x, z) - 0.1, z, { scale: 0.6 + rnd() * 0.6 });
  }
  for (let i = 0; i < 400; i++) {
    const x = -40 + rnd() * 80, z = -38 + rnd() * 44;
    if (Math.hypot(x, z * 1.3) < 13.5) {
      if (rnd() < 0.9) continue;
    }
    const t = rnd();
    props.add(t < 0.5 ? 'grass3' : t < 0.7 ? 'grass1' : t < 0.9 ? 'pine1' : 'rock1', x, terrain.heightAt(x, z) - 0.05, z, { scale: 0.8 + rnd() * 0.5 });
  }
  props.build();
  scene.add(props.group);
  out.props = props;
  // crystal light
  const cl = new THREE.PointLight(0x7ad8ff, 30, 16, 2);
  cl.position.set(-2, 4, -7);
  scene.add(cl);
  out.crystalLight = cl;
  const m1 = backdrop('bg_mountains_dusk', 120, 34, -6, 1, 0xffffff, 3);
  if (m1) scene.add(m1);
  const ps = new ParticleSystem(800, { soft: true });
  scene.add(ps.points);
  ambientMotes(ps, new THREE.Vector3(0, 0, -2), 24, { rate: 14, size: 0.07, color: [0.6, 0.9, 1.0, 0.7] });
  fireflies(ps, new THREE.Vector3(-2, 0, -6), 14);
  out.particles = ps;
  out.ground = (x, z) => terrain.heightAt(x, z);
  return out;
}
