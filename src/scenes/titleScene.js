// Title screen: slowly orbiting night view of the crystal shrine.
import * as THREE from 'three';
import { audio } from '../engine/audio.js';
import { input } from '../engine/input.js';
import { GameState } from '../game/state.js';
import { buildArena } from '../battle/arena.js';
import { el } from '../ui/dom.js';
import { updatePropsTime } from '../world/props.js';

export class TitleScene {
  constructor(game) {
    this.game = game;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.3, 500);
    this.arena = buildArena('shrine', this.scene);
    this.scene.fog.color.setHex(0x1a2040);
    this.scene.background = new THREE.Color(0x1a2040);
    this.time = 0;
  }

  enter() {
    const post = this.game.renderer.post;
    post.dof.enabled.value = 1;
    post.dof.maxBlur.value = 9;
    post.dof.focusRange.value = 6;
    post.dof.tilt.value = 0.2;
    post.bloom.strength = 0.6;
    post.bloom.threshold = 0.84;
    post.grade.vignette.value = 0.8;
    post.grade.tint.value = 0;
    audio.play('title');
    this.root = el('div', 'title-screen');
    const has = GameState.hasSave();
    this.opts = [
      { id: 'new', label: '새로운 게임' },
      { id: 'cont', label: '이어하기', dis: !has },
      { id: 'demo', label: '보스전 체험' },
    ];
    this.sel = has ? 1 : 0;
    this.root.innerHTML = `<div class="logo"><div class="crys"></div><div class="l1">CRYSTAL ECHOES</div><div class="l2">크리스탈 에코즈</div></div><div class="tmenu"></div><div class="copyright">PRESS ENTER · ↑↓ SELECT</div>`;
    document.getElementById('ui').appendChild(this.root);
    this.renderMenu();
    this.off = input.on((a) => {
      audio.unlock();
      if (a === 'up' || a === 'down') {
        this.sel = (this.sel + (a === 'up' ? -1 : 1) + this.opts.length) % this.opts.length;
        audio.sfx('cursor');
        this.renderMenu();
      } else if (a === 'ok') this.choose();
    });
  }

  renderMenu() {
    const m = this.root.querySelector('.tmenu');
    m.innerHTML = this.opts.map((o, i) => `<div class="opt${i === this.sel ? ' sel' : ''}${o.dis ? ' dis' : ''}" data-i="${i}">${o.label}</div>`).join('');
    m.querySelectorAll('.opt').forEach((d) => {
      d.onmouseenter = () => {
        this.sel = +d.dataset.i;
        this.renderMenu();
      };
      d.onclick = () => {
        audio.unlock();
        this.sel = +d.dataset.i;
        this.choose();
      };
    });
  }

  choose() {
    const o = this.opts[this.sel];
    if (o.dis) return audio.sfx('buzz');
    audio.sfx('ok');
    this.off();
    this.root.style.transition = 'opacity 0.8s';
    this.root.style.opacity = 0;
    setTimeout(() => {
      if (o.id === 'new') this.game.newGame();
      else if (o.id === 'cont') this.game.continueGame();
      else this.game.bossDemo();
    }, 700);
  }

  exit() {
    this.off?.();
    this.root?.remove();
  }

  update(dt) {
    this.time += dt;
    const a = this.time * 0.05;
    this.camera.position.set(Math.sin(a) * 13 - 2, 1.6 + Math.sin(this.time * 0.2) * 0.3, Math.cos(a) * 11 - 6);
    const look = new THREE.Vector3(-2, 3.4, -7.5);
    this.camera.lookAt(look);
    this.game.renderer.post.dof.focusDist.value = this.camera.position.distanceTo(look);
    this.arena.particles.update(dt);
    this.arena.sky.update(this.time, this.camera.position);
    this.arena.props.update(this.camera);
    this.arena.lights.follow(new THREE.Vector3(0, 0, 0));
    updatePropsTime(this.time);
    if (this.arena.crystalLight) this.arena.crystalLight.intensity = 14 + Math.sin(this.time * 1.5) * 4;
  }
}
