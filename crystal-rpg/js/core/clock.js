// 씬 시간: 히트스톱/슬로모션을 위해 timeScale을 적용한 시간과 대기/트윈을 관리
export const ease = {
  linear: k => k,
  out: k => 1 - Math.pow(1 - k, 3),
  in: k => k * k * k,
  inOut: k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  back: k => { const c = 1.7; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); },
};

export class Clock {
  constructor() { this.t = 0; this.scale = 1; this.hitstop = 0; this.jobs = []; }
  update(realDt) {
    if (this.hitstop > 0) { this.hitstop -= realDt; return 0; }
    const dt = realDt * this.scale;
    this.t += dt;
    const jobs = this.jobs; this.jobs = [];
    for (const j of jobs) {
      j.el += dt;
      const k = Math.min(1, j.el / j.dur);
      if (j.fn) j.fn(j.ease(k));
      if (k >= 1) j.done(); else this.jobs.push(j);
    }
    return dt;
  }
  wait(s) { return this.tween(s, null); }
  tween(dur, fn, e = ease.out) {
    return new Promise(done => { if (dur <= 0) { fn?.(1); done(); return; } this.jobs.push({ el: 0, dur, fn, ease: e, done }); });
  }
  stop(sec) { this.hitstop = Math.max(this.hitstop, sec); }
  clear() { for (const j of this.jobs) j.done(); this.jobs = []; }
}
