// 카메라 줌 단계 (필드/월드맵 공용, 기기별로 기억)
const LEVELS = [1, 1.3, 1.6];
let idx = null;
function load() {
  if (idx !== null) return;
  try { const v = localStorage.getItem('crystal-rpg.zoom'); idx = v === null ? -1 : +v; } catch (e) { idx = -1; }
  if (!(idx >= -1 && idx < LEVELS.length)) idx = -1;
}
// 기본값: 세로(모바일) 화면은 한 단계 멀리
export function camZoom(portrait) { load(); return LEVELS[idx < 0 ? (portrait ? 1 : 0) : idx]; }
export function cycleZoom() {
  load();
  const portrait = innerWidth < innerHeight;
  const cur = idx < 0 ? (portrait ? 1 : 0) : idx;
  idx = (cur + 1) % LEVELS.length;
  try { localStorage.setItem('crystal-rpg.zoom', String(idx)); } catch (e) { /* 저장 불가 무시 */ }
  return idx;
}
