// Coroutine-style event runner used by cutscenes in every scene.
import * as THREE from 'three';
import { audio } from '../engine/audio.js';
import { dialogue, fade, toast } from '../ui/dialogue.js';
import { sleep } from '../ui/dom.js';
import { SCRIPTS } from '../data/scripts.js';

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export class EventRunner {
  constructor(scene) {
    this.scene = scene;
    this.game = scene.game;
    this.timers = [];
    this.tweens = [];
    this.busy = false;
  }

  update(dt) {
    for (const t of this.timers) t.t -= dt;
    const done = this.timers.filter((t) => t.t <= 0);
    this.timers = this.timers.filter((t) => t.t > 0);
    done.forEach((t) => t.res());
    for (const tw of this.tweens) {
      tw.t += dt;
      tw.fn(Math.min(1, tw.t / tw.d));
    }
    const fin = this.tweens.filter((t) => t.t >= t.d);
    this.tweens = this.tweens.filter((t) => t.t < t.d);
    fin.forEach((t) => t.res());
  }

  async run(name, ...args) {
    const fn = SCRIPTS[name];
    if (!fn) return console.warn('no script', name);
    this.busy = true;
    try {
      await fn(this.api(), this.scene, this.game, ...args);
    } finally {
      this.busy = false;
      dialogue.close();
    }
  }

  api() {
    const R = this;
    const S = this.scene;
    const G = this.game;
    return {
      wait: (s) => new Promise((res) => R.timers.push({ t: s, res })),
      tween: (d, fn) => new Promise((res) => R.tweens.push({ d, t: 0, fn, res })),
      say: (name, text, portrait, expr) => dialogue.say(name, text, portrait, expr),
      close: () => dialogue.close(),
      narration: (lines, hold) => dialogue.narration(lines, hold),
      choice: (opts) => dialogue.choice(opts),
      toast: (html, ms) => toast(html, ms),
      fade: (to, ms = 700, white = false) => fade(to, ms, white),
      music: (n) => audio.play(n),
      stopMusic: () => audio.stop(),
      sfx: (n) => audio.sfx(n),
      flag: (k, v = true) => (G.state.flags[k] = v),
      has: (k) => !!G.state.flags[k],
      objective: (t) => {
        G.state.objective = t;
        S.hud?.update?.();
      },
      join: (id) => {
        G.state.join(id);
        S.hud?.update?.();
      },
      echo: (id) => G.state.gainEcho(id),
      tutorial: (pages) => G.tutorial(pages),
      battle: (troop, opts) => G.battle(troop, opts),
      save: () => G.state.save(),
      // camera move (scenes expose camPos / camLook and a cinematic flag)
      cam: (pos, look, d = 1.2) => {
        S.cinematic = true;
        const p0 = S.camPos.clone(), l0 = S.camLook.clone();
        return R.api().tween(d, (k) => {
          const e = ease(k);
          S.camPos.lerpVectors(p0, pos, e);
          S.camLook.lerpVectors(l0, look, e);
        });
      },
      release: () => (S.cinematic = false),
      // walk a sprite to (x,z); picks the walk animation from the travel direction
      walk: (a, x, z, speed = 2.6) => {
        const from = a.position.clone();
        const to = new THREE.Vector3(x, from.y, z);
        const d = from.distanceTo(to);
        const dx = x - from.x, dz = z - from.z;
        const view = Math.abs(dx) > Math.abs(dz) ? 'left' : dz < 0 ? 'up' : 'down';
        a.setFlip(Math.abs(dx) > Math.abs(dz) && dx > 0);
        a.play(view + '.walk');
        return R.api()
          .tween(Math.max(0.05, d / speed), (k) => {
            a.position.lerpVectors(from, to, k);
            if (S.groundAt) a.position.y = S.groundAt(a.position.x, a.position.z);
          })
          .then(() => a.play(view + '.idle'));
      },
      face: (a, dir) => {
        a.setFlip(dir === 'right');
        a.play((dir === 'right' ? 'left' : dir) + '.idle');
      },
      shake: (amt = 0.3) => (S.shakeAmt = amt),
      sleep,
    };
  }
}
