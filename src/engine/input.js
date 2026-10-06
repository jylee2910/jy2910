// Keyboard / gamepad / pointer input with edge-triggered "pressed" queries.
const MAP = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  Enter: 'ok', Space: 'ok', KeyZ: 'ok',
  Escape: 'cancel', KeyX: 'cancel', Backspace: 'cancel',
  KeyM: 'menu', Tab: 'menu', KeyC: 'menu',
  ShiftLeft: 'run', ShiftRight: 'run',
  KeyF: 'fast', KeyH: 'help',
};

class Input {
  constructor() {
    this.down = new Set();
    this.pressedSet = new Set();
    this.listeners = [];
    window.addEventListener('keydown', (e) => {
      const a = MAP[e.code];
      if (!a) return;
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (!this.down.has(a)) {
        this.pressedSet.add(a);
        this.emit(a);
      }
      this.down.add(a);
    });
    window.addEventListener('keyup', (e) => {
      const a = MAP[e.code];
      if (a) this.down.delete(a);
    });
    window.addEventListener('blur', () => this.down.clear());
    this.padPrev = {};
    // virtual stick for touch
    this.stick = { x: 0, y: 0 };
  }

  on(fn) {
    this.listeners.push(fn);
    return () => (this.listeners = this.listeners.filter((f) => f !== fn));
  }

  emit(a) {
    for (const f of [...this.listeners]) f(a);
  }

  // synthetic press (from UI clicks / touch buttons)
  tap(a) {
    this.pressedSet.add(a);
    this.emit(a);
  }

  pressed(a) {
    return this.pressedSet.has(a);
  }

  held(a) {
    return this.down.has(a);
  }

  axis() {
    let x = 0, y = 0;
    if (this.down.has('left')) x -= 1;
    if (this.down.has('right')) x += 1;
    if (this.down.has('up')) y -= 1;
    if (this.down.has('down')) y += 1;
    x += this.stick.x;
    y += this.stick.y;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      if (Math.abs(p.axes[0]) > 0.2) x += p.axes[0];
      if (Math.abs(p.axes[1]) > 0.2) y += p.axes[1];
    }
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    return { x, y };
  }

  pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const btn = { 0: 'ok', 1: 'cancel', 9: 'menu', 3: 'menu', 12: 'up', 13: 'down', 14: 'left', 15: 'right', 5: 'fast' };
    for (const p of pads) {
      if (!p) continue;
      for (const [i, a] of Object.entries(btn)) {
        const v = p.buttons[i]?.pressed;
        const k = p.index + ':' + i;
        if (v && !this.padPrev[k]) {
          this.pressedSet.add(a);
          this.emit(a);
        }
        if (v) this.down.add(a);
        else if (this.padPrev[k]) this.down.delete(a);
        this.padPrev[k] = v;
      }
    }
  }

  endFrame() {
    this.pressedSet.clear();
  }
}

export const input = new Input();
