// WebAudio synth: sound effects + procedurally arranged BGM.
const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
function midi(n) {
  if (typeof n === 'number') return n;
  const m = n.match(/^([A-G][#b]?)(-?\d)$/);
  return 12 * (+m[2] + 1) + NOTE[m[1]];
}
const hz = (m) => 440 * Math.pow(2, (midi(m) - 69) / 12);

// chord tables relative to root
const CH = { M: [0, 4, 7], m: [0, 3, 7], M7: [0, 4, 7, 11], m7: [0, 3, 7, 10], s4: [0, 5, 7], 7: [0, 4, 7, 10], add9: [0, 4, 7, 14], dim: [0, 3, 6] };

class Audio {
  constructor() {
    this.ctx = null;
    this.musicVol = 0.5;
    this.sfxVol = 0.6;
    this.current = null;
    this.enabled = true;
  }

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      this.enabled = false;
      return;
    }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = 0.8;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(c.destination);
    this.music = c.createGain();
    this.music.gain.value = this.musicVol;
    this.music.connect(this.master);
    this.sfxBus = c.createGain();
    this.sfxBus.gain.value = this.sfxVol;
    this.sfxBus.connect(this.master);
    // reverb
    this.verb = c.createConvolver();
    this.verb.buffer = this.impulse(2.8, 2.2);
    this.verbGain = c.createGain();
    this.verbGain.gain.value = 0.35;
    this.verb.connect(this.verbGain).connect(this.master);
    this.noiseBuf = this.makeNoise();
  }

  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    this.init();
    if (this.ctx?.state === 'suspended') this.ctx.resume();
    if (this.want) {
      const w = this.want;
      this.want = null;
      this.play(w);
    }
  }

  impulse(sec, decay) {
    const c = this.ctx, n = c.sampleRate * sec;
    const b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
    }
    return b;
  }

  makeNoise() {
    const c = this.ctx, n = c.sampleRate;
    const b = c.createBuffer(1, n, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  // ---------------------------------------------------------------- voices
  voice(inst, freq, t, dur, vel, dest) {
    const c = this.ctx;
    const out = c.createGain();
    out.connect(dest);
    const send = c.createGain();
    out.connect(send);
    send.connect(this.verb);
    const env = (g, a, d, s, r, peak) => {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + a);
      g.gain.linearRampToValueAtTime(peak * s, t + a + d);
      g.gain.setValueAtTime(peak * s, t + Math.max(a + d, dur));
      g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + d, dur) + r);
      return t + Math.max(a + d, dur) + r;
    };
    let end = t + dur + 1;
    const osc = (type, f, detune = 0) => {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = detune;
      return o;
    };
    if (inst === 'pad' || inst === 'strings') {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = inst === 'pad' ? 1400 : 2400;
      f.Q.value = 0.5;
      const g = c.createGain();
      f.connect(g).connect(out);
      for (const dt of [-9, 0, 8]) {
        const o = osc('sawtooth', freq, dt);
        o.connect(f);
        o.start(t);
        o.stop(t + dur + 2);
      }
      end = env(g, inst === 'pad' ? 0.6 : 0.25, 0.3, 0.8, inst === 'pad' ? 1.4 : 0.7, 0.05 * vel);
      send.gain.value = 0.9;
    } else if (inst === 'pluck' || inst === 'harp') {
      const o = osc(inst === 'harp' ? 'triangle' : 'square', freq);
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(inst === 'harp' ? 3500 : 2600, t);
      f.frequency.exponentialRampToValueAtTime(500, t + 0.4);
      const g = c.createGain();
      o.connect(f).connect(g).connect(out);
      o.start(t);
      o.stop(t + dur + 1);
      end = env(g, 0.004, 0.25, 0.25, 0.4, (inst === 'harp' ? 0.16 : 0.07) * vel);
      send.gain.value = 0.5;
    } else if (inst === 'lead' || inst === 'flute') {
      const o = osc(inst === 'flute' ? 'sine' : 'square', freq);
      const o2 = osc('triangle', freq * 2, 3);
      const lfo = osc('sine', 5.2);
      const lg = c.createGain();
      lg.gain.value = freq * 0.006;
      lfo.connect(lg).connect(o.frequency);
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = inst === 'flute' ? 3000 : 2200;
      const g = c.createGain();
      o.connect(f);
      const g2 = c.createGain();
      g2.gain.value = 0.25;
      o2.connect(g2).connect(f);
      f.connect(g).connect(out);
      for (const x of [o, o2, lfo]) {
        x.start(t);
        x.stop(t + dur + 1);
      }
      end = env(g, 0.04, 0.1, 0.85, 0.25, (inst === 'flute' ? 0.12 : 0.05) * vel);
      send.gain.value = 0.6;
    } else if (inst === 'bass') {
      const o = osc('triangle', freq);
      const o2 = osc('square', freq * 0.5);
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 600;
      const g = c.createGain();
      o.connect(g);
      const g2 = c.createGain();
      g2.gain.value = 0.3;
      o2.connect(g2).connect(f).connect(g);
      g.connect(out);
      o.start(t);
      o2.start(t);
      o.stop(t + dur + 0.5);
      o2.stop(t + dur + 0.5);
      end = env(g, 0.01, 0.1, 0.7, 0.12, 0.22 * vel);
      send.gain.value = 0.1;
    } else if (inst === 'bell') {
      const car = osc('sine', freq);
      const mod = osc('sine', freq * 3.5);
      const mg = c.createGain();
      mg.gain.setValueAtTime(freq * 2.2, t);
      mg.gain.exponentialRampToValueAtTime(1, t + 1.2);
      mod.connect(mg).connect(car.frequency);
      const g = c.createGain();
      car.connect(g).connect(out);
      car.start(t);
      mod.start(t);
      car.stop(t + dur + 2.5);
      mod.stop(t + dur + 2.5);
      end = env(g, 0.005, 0.6, 0.2, 1.6, 0.09 * vel);
      send.gain.value = 1.0;
    } else if (inst === 'brass') {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(400, t);
      f.frequency.linearRampToValueAtTime(2600, t + 0.08);
      f.frequency.linearRampToValueAtTime(1500, t + 0.3);
      const g = c.createGain();
      f.connect(g).connect(out);
      for (const dt of [-6, 6]) {
        const o = osc('sawtooth', freq, dt);
        o.connect(f);
        o.start(t);
        o.stop(t + dur + 1);
      }
      end = env(g, 0.05, 0.2, 0.75, 0.3, 0.07 * vel);
      send.gain.value = 0.6;
    }
    setTimeout(() => out.disconnect(), (end - c.currentTime + 0.5) * 1000);
  }

  drum(kind, t, vel, dest) {
    const c = this.ctx;
    if (kind === 'k') {
      const o = c.createOscillator();
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
      const g = c.createGain();
      g.gain.setValueAtTime(0.5 * vel, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.connect(g).connect(dest);
      o.start(t);
      o.stop(t + 0.35);
    } else {
      const s = c.createBufferSource();
      s.buffer = this.noiseBuf;
      const f = c.createBiquadFilter();
      f.type = kind === 'h' ? 'highpass' : 'bandpass';
      f.frequency.value = kind === 'h' ? 7000 : kind === 't' ? 300 : 1800;
      const g = c.createGain();
      const len = kind === 'h' ? 0.05 : kind === 'c' ? 1.2 : 0.18;
      g.gain.setValueAtTime((kind === 'h' ? 0.12 : kind === 'c' ? 0.15 : 0.3) * vel, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + len);
      s.connect(f).connect(g).connect(dest);
      if (kind !== 'h') {
        const sg = c.createGain();
        sg.gain.value = 0.3;
        g.connect(sg).connect(this.verb);
      }
      s.start(t, Math.random() * 0.5);
      s.stop(t + len + 0.05);
    }
  }

  // ---------------------------------------------------------------- music
  play(name) {
    if (!this.enabled) return;
    if (!this.unlocked) {
      this.want = name;
      return;
    }
    this.init();
    if (this.current?.name === name) return;
    this.stop(1.2);
    const song = SONGS[name];
    if (!song) return;
    const c = this.ctx;
    const bus = c.createGain();
    bus.gain.setValueAtTime(0.0001, c.currentTime);
    bus.gain.linearRampToValueAtTime(1, c.currentTime + 1.0);
    bus.connect(this.music);
    const s = { name, song, bus, step: 0, next: c.currentTime + 0.1, timer: null, events: song.build() };
    s.spb = 60 / song.bpm / 4; // 16th notes
    this.current = s;
    const tick = () => {
      if (this.current !== s) return;
      while (s.next < c.currentTime + 0.25) {
        const evs = s.events[s.step % s.events.length];
        if (evs) for (const e of evs) this.fire(e, s.next, s);
        s.step++;
        if (!song.loop && s.step >= s.events.length) {
          this.current = null;
          break;
        }
        s.next += s.spb;
      }
      s.timer = setTimeout(tick, 60);
    };
    tick();
  }

  fire(e, t, s) {
    const [inst, note, len, vel = 1] = e;
    if (inst === 'drum') this.drum(note, t, vel, s.bus);
    else this.voice(inst, hz(note), t, len * s.spb, vel, s.bus);
  }

  stop(fade = 0.8) {
    if (!this.unlocked) this.want = null;
    const s = this.current;
    if (!s) return;
    this.current = null;
    clearTimeout(s.timer);
    const c = this.ctx;
    s.bus.gain.cancelScheduledValues(c.currentTime);
    s.bus.gain.setValueAtTime(s.bus.gain.value, c.currentTime);
    s.bus.gain.linearRampToValueAtTime(0.0001, c.currentTime + fade);
    setTimeout(() => s.bus.disconnect(), fade * 1000 + 200);
  }

  // ---------------------------------------------------------------- sfx
  sfx(name) {
    if (!this.enabled || !this.ctx) return;
    const c = this.ctx, t = c.currentTime, d = this.sfxBus;
    const tone = (type, f0, f1, dur, vol, delay = 0) => {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, t + delay);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + delay + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(vol, t + delay);
      g.gain.exponentialRampToValueAtTime(0.001, t + delay + dur);
      o.connect(g).connect(d);
      o.start(t + delay);
      o.stop(t + delay + dur + 0.05);
      return g;
    };
    const noise = (f, q, dur, vol, type = 'bandpass', delay = 0, f1 = null) => {
      const s = c.createBufferSource();
      s.buffer = this.noiseBuf;
      const fl = c.createBiquadFilter();
      fl.type = type;
      fl.frequency.setValueAtTime(f, t + delay);
      if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + delay + dur);
      fl.Q.value = q;
      const g = c.createGain();
      g.gain.setValueAtTime(vol, t + delay);
      g.gain.exponentialRampToValueAtTime(0.001, t + delay + dur);
      s.connect(fl).connect(g).connect(d);
      const vs = c.createGain();
      vs.gain.value = 0.25;
      g.connect(vs).connect(this.verb);
      s.start(t + delay, Math.random());
      s.stop(t + delay + dur + 0.05);
    };
    switch (name) {
      case 'cursor': tone('square', 1800, 1700, 0.03, 0.05); break;
      case 'ok': tone('square', 1200, 1200, 0.05, 0.06); tone('square', 1800, 1800, 0.08, 0.05, 0.05); break;
      case 'cancel': tone('square', 900, 500, 0.08, 0.05); break;
      case 'buzz': tone('sawtooth', 160, 120, 0.15, 0.08); break;
      case 'slash': noise(3000, 0.8, 0.18, 0.5, 'bandpass', 0, 900); tone('sine', 600, 200, 0.12, 0.08); break;
      case 'hit': noise(800, 0.6, 0.16, 0.7, 'lowpass'); tone('sine', 160, 50, 0.18, 0.35); break;
      case 'bighit': noise(500, 0.5, 0.4, 0.9, 'lowpass'); tone('sine', 120, 35, 0.4, 0.5); noise(4000, 1, 0.25, 0.3, 'highpass'); break;
      case 'magic': for (let i = 0; i < 5; i++) tone('sine', 900 + i * 220, 1400 + i * 300, 0.25, 0.05, i * 0.05); break;
      case 'heal': for (let i = 0; i < 6; i++) tone('triangle', hz(['C6', 'E6', 'G6', 'C7', 'E7', 'G7'][i]), hz(['C6', 'E6', 'G6', 'C7', 'E7', 'G7'][i]), 0.4, 0.05, i * 0.06); break;
      case 'fire': noise(600, 0.4, 0.8, 0.6, 'lowpass', 0, 2500); tone('sawtooth', 90, 50, 0.6, 0.1); break;
      case 'ice': for (let i = 0; i < 6; i++) tone('sine', 2400 + Math.random() * 1600, 3000, 0.12, 0.05, i * 0.04); noise(6000, 2, 0.4, 0.2, 'highpass'); break;
      case 'thunder': noise(2000, 0.3, 0.12, 0.9, 'highpass'); noise(300, 0.5, 0.9, 0.8, 'lowpass', 0.05); tone('sawtooth', 70, 30, 0.6, 0.2, 0.05); break;
      case 'holy': for (let i = 0; i < 4; i++) tone('sine', hz(['A5', 'C#6', 'E6', 'A6'][i]), hz(['A5', 'C#6', 'E6', 'A6'][i]) * 1.01, 1.0, 0.06, i * 0.08); noise(5000, 1, 0.8, 0.15, 'highpass'); break;
      case 'dark': tone('sawtooth', 220, 55, 0.7, 0.12); noise(400, 3, 0.7, 0.3, 'bandpass', 0, 120); break;
      case 'buff': for (let i = 0; i < 4; i++) tone('square', 600 + i * 200, 650 + i * 200, 0.1, 0.04, i * 0.07); break;
      case 'break': noise(5000, 0.6, 0.5, 0.6, 'highpass'); for (let i = 0; i < 8; i++) tone('triangle', 2000 + Math.random() * 3000, 1500, 0.2, 0.06, i * 0.03); tone('sine', 200, 60, 0.4, 0.4); break;
      case 'fullbreak': for (let i = 0; i < 5; i++) tone('sawtooth', hz(['D5', 'F#5', 'A5', 'D6', 'F#6'][i]), hz(['D5', 'F#5', 'A5', 'D6', 'F#6'][i]), 0.6, 0.06, i * 0.06); noise(3000, 0.5, 1.0, 0.4, 'highpass'); break;
      case 'encounter': for (let i = 0; i < 10; i++) tone('square', 300 + i * 150, 320 + i * 150, 0.05, 0.05, i * 0.03); noise(1000, 0.5, 0.7, 0.4, 'bandpass', 0.2, 4000); break;
      case 'step': noise(900, 1, 0.05, 0.08, 'lowpass'); break;
      case 'chest': for (let i = 0; i < 4; i++) tone('triangle', hz(['C6', 'E6', 'G6', 'C7'][i]), hz(['C6', 'E6', 'G6', 'C7'][i]), 0.3, 0.07, i * 0.09); break;
      case 'resonance': for (let i = 0; i < 8; i++) tone('sine', hz(['D4', 'A4', 'D5', 'F#5', 'A5', 'D6', 'F#6', 'A6'][i]), hz(['D4', 'A4', 'D5', 'F#5', 'A5', 'D6', 'F#6', 'A6'][i]), 1.6, 0.06, i * 0.07); noise(800, 0.3, 2.0, 0.3, 'bandpass', 0, 6000); break;
      case 'ko': tone('sawtooth', 300, 60, 0.6, 0.1); break;
      case 'run': noise(1500, 0.6, 0.3, 0.3, 'bandpass', 0, 400); break;
      case 'door': noise(300, 1, 0.5, 0.4, 'lowpass'); tone('sine', 80, 60, 0.4, 0.2); break;
      default: tone('sine', 800, 800, 0.05, 0.05);
    }
  }
}

// ------------------------------------------------------------------ songs
// helpers to arrange patterns into a 16th-note event grid
function grid(bars) {
  return Array.from({ length: bars * 16 }, () => []);
}
function chordNotes(root, type, oct) {
  const r = midi(root + oct);
  return CH[type].map((i) => r + i);
}

const SONGS = {
  title: {
    bpm: 72, loop: true,
    build() {
      const prog = [['D', 'add9'], ['B', 'm7'], ['G', 'M7'], ['A', 's4'], ['D', 'add9'], ['F#', 'm7'], ['G', 'M7'], ['A', 'M']];
      const g = grid(prog.length * 2);
      const mel = ['F#5', 'A5', 'E5', 'D5', 'B4', 'C#5', 'D5', 'E5', 'F#5', 'A5', 'B5', 'A5', 'G5', 'F#5', 'E5', 'C#5'];
      prog.forEach(([r, t], i) => {
        const s = i * 32;
        for (const n of chordNotes(r, t, 3)) g[s].push(['pad', n, 30, 0.9]);
        g[s].push(['bass', midi(r + '2'), 30, 0.6]);
        const ch = chordNotes(r, t, 4);
        for (let k = 0; k < 8; k++) g[s + k * 4].push(['harp', ch[k % ch.length] + (k >= 4 ? 12 : 0), 3, 0.5]);
        g[s].push(['bell', midi(mel[i * 2]), 12, 0.8]);
        g[s + 16].push(['bell', midi(mel[i * 2 + 1]), 12, 0.7]);
      });
      return g;
    },
  },
  castle: {
    bpm: 84, loop: true,
    build() {
      const prog = [['C', 'M'], ['F', 'M'], ['G', 'M'], ['C', 'M'], ['A', 'm'], ['F', 'M'], ['D', 'm7'], ['G', '7']];
      const mel = [['E5', 8], ['G5', 4], ['C6', 4], ['A5', 8], ['F5', 8], ['G5', 6], ['A5', 2], ['B5', 8], ['C6', 12], ['G5', 4], ['A5', 6], ['G5', 2], ['E5', 8], ['F5', 8], ['A5', 8], ['D5', 8], ['F5', 4], ['E5', 4], ['D5', 8], ['B4', 8]];
      const g = grid(prog.length * 2);
      prog.forEach(([r, t], i) => {
        const s = i * 32;
        for (const n of chordNotes(r, t, 4)) g[s].push(['strings', n, 30, 0.7]);
        g[s].push(['bass', midi(r + '2'), 14, 0.7]);
        g[s + 16].push(['bass', midi(r + '2') + 7, 14, 0.6]);
        const ch = chordNotes(r, t, 3);
        for (let k = 0; k < 8; k++) g[s + k * 4].push(['harp', ch[k % ch.length] + 12, 3, 0.4]);
      });
      let p = 0;
      for (const [n, l] of mel) {
        if (p < g.length) g[p].push(['flute', midi(n), l - 1, 0.9]);
        p += l;
      }
      return g;
    },
  },
  field: {
    bpm: 104, loop: true,
    build() {
      const prog = [['D', 'M'], ['A', 'M'], ['B', 'm'], ['G', 'M'], ['D', 'M'], ['A', 'M'], ['G', 'M'], ['A', 'M'], ['B', 'm'], ['F#', 'm'], ['G', 'M'], ['D', 'M'], ['E', 'm'], ['G', 'M'], ['A', 's4'], ['A', 'M']];
      const mel = [
        ['A4', 4], ['D5', 4], ['E5', 4], ['F#5', 4], ['E5', 6], ['C#5', 2], ['A4', 8], ['B4', 4], ['D5', 4], ['F#5', 4], ['A5', 4], ['G5', 8], ['D5', 8],
        ['F#5', 4], ['A5', 4], ['B5', 4], ['A5', 4], ['E5', 6], ['F#5', 2], ['G5', 8], ['F#5', 4], ['E5', 4], ['D5', 4], ['C#5', 4], ['E5', 16],
        ['D5', 4], ['F#5', 4], ['B5', 8], ['A5', 4], ['F#5', 4], ['C#5', 8], ['B4', 4], ['D5', 4], ['G5', 6], ['F#5', 2], ['F#5', 8], ['D5', 8],
        ['E5', 4], ['G5', 4], ['B5', 8], ['B5', 4], ['A5', 4], ['G5', 8], ['A5', 8], ['E5', 6], ['G5', 2], ['A5', 16],
      ];
      const g = grid(prog.length * 2);
      prog.forEach(([r, t], i) => {
        const s = i * 32;
        for (const n of chordNotes(r, t, 3)) g[s].push(['pad', n, 30, 0.6]);
        const b = midi(r + '2');
        for (const k of [0, 6, 8, 14, 16, 22, 24, 28]) g[s + k].push(['bass', b + (k === 22 || k === 28 ? 7 : 0), 2, 0.6]);
        const ch = chordNotes(r, t, 4);
        for (let k = 0; k < 16; k++) if (k % 2 === 0) g[s + k * 2].push(['pluck', ch[(k / 2) % ch.length] + (k % 8 >= 4 ? 12 : 0), 2, 0.5]);
        for (let k = 0; k < 8; k++) g[s + k * 4].push(['drum', k % 2 ? 's' : 'k', 1, 0.35]);
        for (let k = 0; k < 16; k++) g[s + k * 2].push(['drum', 'h', 1, 0.3]);
      });
      let p = 0;
      for (const [n, l] of mel) {
        if (p < g.length) g[p].push(['lead', midi(n), l - 1, 0.9]);
        p += l;
      }
      return g;
    },
  },
  battle: {
    bpm: 148, loop: true,
    build() {
      const prog = [['A', 'm'], ['F', 'M'], ['G', 'M'], ['E', 'M'], ['A', 'm'], ['F', 'M'], ['D', 'm'], ['E', '7']];
      const mel = [
        ['A5', 2], ['B5', 2], ['C6', 4], ['B5', 2], ['A5', 2], ['E5', 4], ['A5', 2], ['G5', 2], ['F5', 4], ['A5', 4], ['C6', 4],
        ['B5', 4], ['G5', 4], ['D6', 4], ['B5', 4], ['G#5', 8], ['E5', 8],
        ['A5', 2], ['C6', 2], ['E6', 4], ['D6', 2], ['C6', 2], ['B5', 4], ['A5', 2], ['C6', 2], ['F6', 8], ['E6', 4], ['D6', 4],
        ['F5', 4], ['A5', 4], ['D6', 8], ['E6', 4], ['D6', 2], ['C6', 2], ['B5', 4], ['G#5', 4],
      ];
      const g = grid(prog.length * 2);
      prog.forEach(([r, t], i) => {
        const s = i * 32;
        const b = midi(r + '2');
        for (let k = 0; k < 16; k++) g[s + k * 2].push(['bass', b + (k % 4 === 3 ? 12 : 0), 1.6, 0.8]);
        for (const n of chordNotes(r, t, 4)) {
          g[s].push(['brass', n, 6, 0.6]);
          g[s + 12].push(['brass', n, 3, 0.5]);
          g[s + 16].push(['strings', n, 14, 0.5]);
        }
        for (let k = 0; k < 8; k++) g[s + k * 4].push(['drum', k % 2 ? 's' : 'k', 1, 0.6]);
        g[s + 26].push(['drum', 'k', 1, 0.5]);
        for (let k = 0; k < 16; k++) g[s + k * 2].push(['drum', 'h', 1, 0.4]);
        if (i % 4 === 0) g[s].push(['drum', 'c', 1, 0.5]);
      });
      let p = 0;
      for (const [n, l] of mel) {
        if (p < g.length) g[p].push(['lead', midi(n), l - 0.5, 1]);
        p += l;
      }
      return g;
    },
  },
  boss: {
    bpm: 160, loop: true,
    build() {
      const prog = [['D', 'm'], ['D', 'm'], ['Bb', 'M'], ['C', 'M'], ['D', 'm'], ['A', 'M'], ['Bb', 'M'], ['A', '7']];
      const mel = [['D5', 6], ['F5', 2], ['A5', 8], ['G5', 4], ['F5', 4], ['E5', 4], ['C#5', 4], ['D5', 16], ['F5', 4], ['A5', 4], ['D6', 8], ['C6', 4], ['Bb5', 4], ['A5', 8], ['G5', 8], ['A5', 6], ['Bb5', 2], ['C6', 8], ['A5', 16], ['D6', 6], ['C6', 2], ['Bb5', 8], ['A5', 6], ['G5', 2], ['A5', 8], ['C#6', 16], ['E6', 16]];
      const g = grid(prog.length * 2);
      prog.forEach(([r, t], i) => {
        const s = i * 32;
        const b = midi(r + '1');
        for (let k = 0; k < 32; k++) if (k % 2 === 0 || k % 8 === 7) g[s + k].push(['bass', b + (k % 8 === 6 ? 12 : 0), 1, 0.9]);
        for (const n of chordNotes(r, t, 3)) {
          g[s].push(['strings', n, 30, 0.6]);
          g[s].push(['brass', n + 12, 4, 0.7]);
          g[s + 6].push(['brass', n + 12, 2, 0.6]);
          g[s + 10].push(['brass', n + 12, 4, 0.6]);
        }
        for (let k = 0; k < 8; k++) g[s + k * 4].push(['drum', k % 2 ? 's' : 'k', 1, 0.7]);
        for (const k of [10, 14, 26, 30]) g[s + k].push(['drum', 'k', 1, 0.5]);
        for (let k = 0; k < 32; k++) g[s + k].push(['drum', 'h', 1, k % 2 ? 0.2 : 0.4]);
        if (i % 2 === 0) g[s].push(['drum', 'c', 1, 0.6]);
        g[s + 28].push(['drum', 't', 1, 0.6]);
        g[s + 30].push(['drum', 't', 1, 0.6]);
      });
      let p = 0;
      for (const [n, l] of mel) {
        if (p < g.length) g[p].push(['lead', midi(n), l - 0.5, 1]);
        p += l;
      }
      return g;
    },
  },
  victory: {
    bpm: 132, loop: false,
    build() {
      const g = grid(5);
      const fan = [['C5', 0, 2], ['C5', 3, 2], ['C5', 6, 2], ['C5', 9, 6], ['Ab4', 16, 6], ['Bb4', 24, 6], ['C5', 32, 3], ['Bb4', 36, 2], ['C5', 40, 24]];
      for (const [n, s, l] of fan) {
        g[s].push(['brass', midi(n) + 12, l, 1]);
        g[s].push(['lead', midi(n) + 12, l, 0.6]);
      }
      for (const [r, s] of [['C', 0], ['Ab', 16], ['Bb', 24], ['C', 40]]) {
        for (const n of chordNotes(r, 'M', 4)) g[s].push(['strings', n, 14, 0.7]);
        g[s].push(['bass', midi(r + '2'), 12, 0.8]);
        g[s].push(['drum', 'c', 1, 0.5]);
      }
      return g;
    },
  },
  shrine: {
    bpm: 66, loop: true,
    build() {
      const prog = [['E', 'm7'], ['C', 'M7'], ['A', 'm7'], ['B', 's4']];
      const g = grid(prog.length * 2);
      prog.forEach(([r, t], i) => {
        const s = i * 32;
        for (const n of chordNotes(r, t, 3)) g[s].push(['pad', n, 31, 0.8]);
        const ch = chordNotes(r, t, 5);
        for (let k = 0; k < 6; k++) g[s + k * 5].push(['bell', ch[(k * 2) % ch.length], 4, 0.4]);
      });
      return g;
    },
  },
};

export const audio = new Audio();
