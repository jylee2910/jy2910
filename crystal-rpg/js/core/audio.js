// WebAudio 합성 효과음 + 간단한 BGM 시퀀서 (외부 음원 없음)
let ctx = null, master, sfxBus, bgmBus, noiseBuf;
export const audioSettings = { sfx: 0.7, bgm: 0.45, muted: false };

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) { ctx = null; return; }
  master = ctx.createGain(); master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
  master.connect(comp); comp.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.connect(master);
  bgmBus = ctx.createGain(); bgmBus.connect(master);
  applyVolumes();
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  if (pendingSong) { const s = pendingSong; pendingSong = null; playBGM(s); }
}
export function applyVolumes() {
  if (!ctx) return;
  sfxBus.gain.value = audioSettings.muted ? 0 : audioSettings.sfx;
  bgmBus.gain.value = audioSettings.muted ? 0 : audioSettings.bgm * 0.55;
}

const N = n => 440 * Math.pow(2, (n - 69) / 12);
function tone(type, freq, t, dur, vol, bus = sfxBus, opt = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (opt.to) o.frequency.exponentialRampToValueAtTime(Math.max(20, opt.to), t + (opt.slide || dur));
  if (opt.detune) o.detune.value = opt.detune;
  const a = opt.attack ?? 0.005;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = o;
  if (opt.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opt.lp; o.connect(f); node = f; }
  node.connect(g); g.connect(bus);
  o.start(t); o.stop(t + dur + 0.05);
}
function noise(t, dur, vol, { type = 'bandpass', f = 2000, to = null, q = 1, bus = sfxBus, attack = 0.003 } = {}) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (to) fl.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(bus);
  s.start(t, Math.random()); s.stop(t + dur + 0.05);
}

const SFX = {
  cursor: t => tone('square', 1320, t, 0.04, 0.05),
  ok: t => { tone('square', 990, t, 0.05, 0.06); tone('square', 1480, t + 0.045, 0.07, 0.06); },
  cancel: t => { tone('square', 700, t, 0.05, 0.06); tone('square', 480, t + 0.045, 0.07, 0.05); },
  buzz: t => tone('sawtooth', 110, t, 0.12, 0.06, sfxBus, { lp: 900 }),
  text: t => tone('square', 900 + Math.random() * 80, t, 0.025, 0.018),
  step: t => noise(t, 0.05, 0.05, { f: 500, q: 2 }),
  slash: t => { noise(t, 0.16, 0.3, { type: 'highpass', f: 1500, to: 6000 }); tone('sawtooth', 600, t, 0.08, 0.05, sfxBus, { to: 200 }); },
  hit: t => { tone('sine', 160, t, 0.16, 0.5, sfxBus, { to: 50 }); noise(t, 0.08, 0.35, { f: 1200, q: 0.8 }); },
  heavy: t => { tone('sine', 120, t, 0.3, 0.6, sfxBus, { to: 35 }); noise(t, 0.2, 0.4, { type: 'lowpass', f: 2500, to: 300 }); },
  crit: t => { SFX.heavy(t); tone('square', 1760, t + 0.02, 0.25, 0.08, sfxBus, { to: 2600 }); tone('triangle', 2640, t + 0.05, 0.3, 0.07); },
  weak: t => { tone('triangle', 1200, t, 0.12, 0.1); tone('triangle', 1800, t + 0.05, 0.16, 0.08); },
  resist: t => tone('square', 220, t, 0.12, 0.08, sfxBus, { lp: 800 }),
  break: t => {
    noise(t, 0.5, 0.45, { type: 'highpass', f: 3000, to: 8000 });
    for (let i = 0; i < 9; i++) tone('triangle', 1800 + Math.random() * 2800, t + i * 0.025, 0.18, 0.06);
    tone('sine', 90, t, 0.4, 0.6, sfxBus, { to: 30 });
  },
  fire: t => { noise(t, 0.5, 0.4, { type: 'lowpass', f: 600, to: 2400, attack: 0.05 }); tone('sawtooth', 110, t, 0.4, 0.08, sfxBus, { lp: 500, to: 60 }); },
  ice: t => { for (let i = 0; i < 6; i++) tone('sine', 2000 + i * 330 + Math.random() * 200, t + i * 0.04, 0.3, 0.07); noise(t, 0.25, 0.15, { type: 'highpass', f: 5000 }); },
  bolt: t => { for (let i = 0; i < 5; i++) noise(t + i * 0.03, 0.06, 0.4, { f: 3000 + Math.random() * 3000, q: 3 }); tone('square', 80, t, 0.35, 0.18, sfxBus, { lp: 1200 }); },
  wind: t => noise(t, 0.6, 0.35, { f: 400, to: 3000, q: 4, attack: 0.1 }),
  light: t => { [0, 4, 7, 12, 16].forEach((n, i) => tone('triangle', N(84 + n), t + i * 0.05, 0.5, 0.06)); },
  dark: t => { tone('sawtooth', 220, t, 0.6, 0.1, sfxBus, { to: 40, lp: 900 }); tone('sawtooth', 227, t, 0.6, 0.08, sfxBus, { to: 42, lp: 900 }); noise(t, 0.5, 0.2, { type: 'lowpass', f: 400 }); },
  heal: t => { [0, 4, 7, 11, 14].forEach((n, i) => tone('sine', N(76 + n), t + i * 0.06, 0.4, 0.08)); },
  buff: t => { tone('square', N(72), t, 0.1, 0.05); tone('square', N(79), t + 0.08, 0.14, 0.05); },
  debuff: t => { tone('square', N(67), t, 0.1, 0.05); tone('square', N(60), t + 0.08, 0.14, 0.05); },
  jump: t => { noise(t, 0.3, 0.3, { f: 800, to: 4000, q: 2 }); tone('square', 300, t, 0.25, 0.05, sfxBus, { to: 1200 }); },
  land: t => { SFX.heavy(t); noise(t, 0.3, 0.3, { type: 'lowpass', f: 1500, to: 200 }); },
  cast: t => { [0, 7, 12].forEach((n, i) => tone('triangle', N(67 + n), t + i * 0.07, 0.25, 0.05)); noise(t, 0.4, 0.08, { type: 'highpass', f: 6000, attack: 0.2 }); },
  guard: t => { tone('square', 440, t, 0.08, 0.05); tone('triangle', 660, t + 0.02, 0.2, 0.06); },
  miss: t => noise(t, 0.15, 0.15, { f: 3000, to: 800, q: 2 }),
  ko: t => { tone('square', 400, t, 0.4, 0.07, sfxBus, { to: 80, lp: 1500 }); },
  enemyDie: t => { noise(t, 0.6, 0.3, { type: 'highpass', f: 800, to: 6000, attack: 0.02 }); tone('square', 600, t, 0.4, 0.05, sfxBus, { to: 100 }); },
  encounter: t => { noise(t, 0.7, 0.35, { f: 300, to: 6000, q: 3, attack: 0.3 }); for (let i = 0; i < 4; i++) tone('square', N(60 + i * 5), t + 0.4 + i * 0.05, 0.12, 0.05); },
  coin: t => { tone('square', N(88), t, 0.06, 0.05); tone('square', N(95), t + 0.06, 0.2, 0.05); },
  chest: t => { [0, 4, 7, 12].forEach((n, i) => tone('square', N(72 + n), t + i * 0.08, 0.2, 0.05)); },
  levelup: t => { [0, 4, 7, 12, 7, 12, 16, 19].forEach((n, i) => tone('square', N(72 + n), t + i * 0.07, 0.18, 0.05)); },
  learn: t => { [0, 7, 12, 19, 24].forEach((n, i) => tone('triangle', N(79 + n), t + i * 0.06, 0.4, 0.07)); },
  door: t => { noise(t, 0.2, 0.2, { f: 400, q: 1 }); tone('square', 200, t, 0.08, 0.04); },
  inn: t => { [0, 4, 7, 4, 0, -5, 0].forEach((n, i) => tone('triangle', N(72 + n), t + i * 0.18, 0.3, 0.06)); },
  save: t => { [0, 7, 12, 16].forEach((n, i) => tone('sine', N(79 + n), t + i * 0.09, 0.5, 0.06)); },
  phase: t => { tone('sawtooth', 55, t, 2.0, 0.2, sfxBus, { lp: 400, attack: 0.3 }); noise(t, 2, 0.25, { type: 'lowpass', f: 200, to: 2000, attack: 0.6 }); },
};

let lastPlay = {};
export function sfx(name) {
  if (!ctx || audioSettings.muted) return;
  const now = ctx.currentTime;
  if (lastPlay[name] && now - lastPlay[name] < 0.03) return;
  lastPlay[name] = now;
  try { SFX[name]?.(now + 0.005); } catch (e) { /* ignore */ }
}

// ─────────────────────────────────────────────────────────────
//  BGM: 코드 진행 + 멜로디 문자열. 한 칸 = 8분음표
//  melody: 공백으로 구분된 음 (C5, D#4, - 쉼표, = 늘임)
// ─────────────────────────────────────────────────────────────
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function midi(s) { const m = s.match(/^([A-G])(#|b)?(\d)$/); if (!m) return null; return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); }
const SONGS = {
  title: { bpm: 84, lead: 'triangle', chords: [['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'], ['C3', 'E3', 'G3'], ['G3', 'B3', 'D4']],
    melody: 'E5 = = D5 C5 = B4 = A4 = = = C5 = D5 = E5 = = G5 F5 = E5 = D5 = = = = = - - C5 = = B4 A4 = G4 = A4 = = = B4 = C5 = D5 = = E5 D5 = C5 = B4 = = = = = - -', drums: false },
  town: { bpm: 108, lead: 'square', chords: [['C4', 'E4', 'G4'], ['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'], ['G3', 'B3', 'D4']],
    melody: 'G4 C5 E5 = D5 C5 D5 E5 C5 = A4 = G4 = - - F4 A4 C5 = B4 A4 G4 = D5 = = C5 B4 = - - G4 C5 E5 = D5 C5 D5 E5 G5 = E5 = C5 = - - F5 E5 D5 C5 A4 = C5 = B4 G4 A4 B4 C5 = = -', drums: 'light' },
  world: { bpm: 120, lead: 'square', chords: [['D4', 'F#4', 'A4'], ['B3', 'D4', 'F#4'], ['G3', 'B3', 'D4'], ['A3', 'C#4', 'E4']],
    melody: 'D5 = A4 = D5 E5 F#5 = E5 = D5 = C#5 = A4 = B4 = F#4 = B4 C#5 D5 = C#5 = B4 = A4 = = = G4 = B4 = D5 = G5 = F#5 = E5 = D5 = C#5 = E5 = = = A4 = = = - -', drums: 'march' },
  dungeon: { bpm: 92, lead: 'triangle', chords: [['D4', 'F4', 'A4'], ['A#3', 'D4', 'F4'], ['C4', 'E4', 'G4'], ['A3', 'C#4', 'E4']],
    melody: 'A4 = = = F4 = D4 = E4 = F4 = G4 = = = F4 = = = D4 = A#3 = C4 = = = = = - - A4 = = = C5 = A4 = G4 = F4 = E4 = = = F4 = E4 = D4 = C#4 = D4 = = = = = - -', drums: 'soft' },
  battle: { bpm: 152, lead: 'square', chords: [['A3', 'C4', 'E4'], ['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'], ['G3', 'B3', 'D4']],
    melody: 'A4 A4 C5 A4 E5 = D5 C5 B4 = G4 = A4 = = = A4 A4 C5 A4 E5 = G5 E5 F5 = E5 = D5 = = = F4 A4 C5 F5 E5 = C5 = D5 = B4 = G4 = B4 = A4 C5 E5 A5 G5 = E5 = F5 E5 D5 C5 B4 = = =', drums: 'battle', bass: 'drive' },
  boss: { bpm: 164, lead: 'sawtooth', chords: [['D4', 'F4', 'A4'], ['C#4', 'E4', 'A4'], ['A#3', 'D4', 'F4'], ['A3', 'C#4', 'E4']],
    melody: 'D5 = D5 E5 F5 = E5 D5 C#5 = A4 = C#5 = E5 = D5 = D5 E5 F5 = G5 F5 E5 = A5 = G5 = = = F5 = E5 = D5 = C#5 = D5 = A4 = F4 = A4 = A#4 = A4 = G4 = F4 = E4 = C#5 = A4 = = =', drums: 'battle', bass: 'drive' },
  victory: { bpm: 140, lead: 'square', chords: [['C4', 'E4', 'G4'], ['F3', 'A3', 'C4'], ['G3', 'B3', 'D4'], ['C4', 'E4', 'G4']],
    melody: 'C5 C5 C5 = C5 = G#4 = A#4 = C5 = A#4 C5 = = G4 = A4 = B4 = C5 = D5 = E5 = C5 = = = F5 = E5 = D5 = C5 = B4 = C5 = D5 = G4 = E5 = D5 = C5 = = = - - - -', drums: 'light', once: false },
  gameover: { bpm: 70, lead: 'triangle', chords: [['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'], ['D3', 'F3', 'A3'], ['E3', 'G#3', 'B3']],
    melody: 'E5 = = = D5 = C5 = B4 = = = A4 = = = C5 = = = B4 = A4 = G#4 = = = = = = =', drums: false },
};

let bgm = null, pendingSong = null;
export function playBGM(name) {
  if (bgm && bgm.name === name) return;
  stopBGM();
  if (!name) return;
  if (!ctx) { pendingSong = name; return; }
  const song = SONGS[name];
  const step = 60 / song.bpm / 2;
  const mel = song.melody.split(/\s+/);
  const gain = ctx.createGain(); gain.gain.value = 1; gain.connect(bgmBus);
  const state = { name, gain, t: ctx.currentTime + 0.1, i: 0, timer: null };
  const barLen = 8; // 8분음표 8개 = 1마디
  const sched = () => {
    while (state.t < ctx.currentTime + 0.25) {
      const i = state.i, t = state.t;
      // 멜로디
      const tok = mel[i % mel.length];
      if (tok !== '-' && tok !== '=') {
        let len = 1; while (mel[(i + len) % mel.length] === '=' && len < 8) len++;
        const m = midi(tok);
        if (m) {
          tone(song.lead, N(m), t, step * len * 0.95, song.lead === 'sawtooth' ? 0.045 : 0.07, gain, { lp: song.lead === 'sawtooth' ? 2400 : 5000, attack: 0.01 });
          tone('triangle', N(m + 12), t, step * len * 0.6, 0.015, gain);
        }
      }
      // 코드 (마디 단위)
      const ch = song.chords[Math.floor(i / barLen) % song.chords.length];
      if (i % barLen === 0) for (const c of ch) tone('sawtooth', N(midi(c)), t, step * barLen * 0.98, 0.018, gain, { lp: 900, attack: 0.08 });
      // 베이스
      const root = midi(ch[0]) - 12;
      if (song.bass === 'drive') tone('triangle', N(root + (i % 4 === 3 ? 12 : 0)), t, step * 0.9, 0.11, gain);
      else if (i % 2 === 0) tone('triangle', N(root + (i % 8 === 4 ? 7 : 0)), t, step * 1.8, 0.1, gain);
      // 드럼
      if (song.drums) {
        const d = song.drums;
        if ((d === 'battle' && i % 2 === 0) || (d !== 'battle' && d !== 'soft' && i % 4 === 0) || (d === 'soft' && i % 8 === 0)) tone('sine', 150, t, 0.12, d === 'soft' ? 0.15 : 0.3, gain, { to: 45 });
        if ((d === 'battle' || d === 'march') && i % 4 === 2) noise(t, 0.1, 0.12, { f: 1800, q: 0.7, bus: gain });
        if (d !== 'soft') noise(t, 0.03, i % 2 ? 0.025 : 0.04, { type: 'highpass', f: 7000, bus: gain });
      }
      state.i++; state.t += step;
    }
  };
  sched();
  state.timer = setInterval(sched, 60);
  bgm = state;
}
export function stopBGM(fadeTime = 0.4) {
  if (!bgm) return;
  const b = bgm; bgm = null;
  clearInterval(b.timer);
  if (ctx) { b.gain.gain.setTargetAtTime(0, ctx.currentTime, fadeTime / 3); setTimeout(() => b.gain.disconnect(), fadeTime * 1000 + 300); }
}
export function currentBGM() { return bgm?.name || pendingSong; }
