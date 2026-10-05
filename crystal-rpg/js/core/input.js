// 키보드/포인터 입력. UI 스택의 최상단 핸들러가 키를 먼저 받는다.
const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Enter: 'ok', Space: 'ok', KeyZ: 'ok', KeyE: 'ok',
  Escape: 'cancel', KeyX: 'cancel', Backspace: 'cancel', KeyQ: 'cancel',
  KeyM: 'menu', Tab: 'menu', KeyC: 'menu',
};

export const input = {
  held: new Set(),
  stack: [],          // UI 핸들러 스택 [{onKey(k) -> bool}]
  sceneHandler: null, // 스택이 비었을 때
  lastKeyTime: 0,
  push(h) { this.stack.push(h); return h; },
  // DOM에서 사라진 메뉴의 핸들러가 남아 입력을 막는 일을 방지
  prune() {
    for (let i = this.stack.length - 1; i >= 0; i--) { const el = this.stack[i].el; if (el && !el.isConnected) this.stack.splice(i, 1); }
  },
  remove(h) { const i = this.stack.indexOf(h); if (i >= 0) this.stack.splice(i, 1); },
  get top() { return this.stack[this.stack.length - 1]; },
  dispatch(k) {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const h = this.stack[i];
      if (h.onKey && h.onKey(k)) return true;
      if (h.modal !== false) return true; // 모달이면 아래로 전달하지 않음
    }
    return this.sceneHandler ? this.sceneHandler(k) : false;
  },
  init() {
    window.addEventListener('keydown', e => {
      const k = KEYMAP[e.code];
      if (!k) return;
      e.preventDefault();
      if (['up', 'down', 'left', 'right'].includes(k)) this.held.add(k);
      if (e.repeat && !['up', 'down', 'left', 'right'].includes(k)) return;
      this.lastKeyTime = performance.now();
      this.dispatch(k);
    });
    window.addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) this.held.delete(k); });
    window.addEventListener('blur', () => this.held.clear());
    document.addEventListener('visibilitychange', () => this.held.clear());
  },
};
