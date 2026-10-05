// 에셋 레지스트리: 생성 결과를 캐시하고, overrides.js에 등록된 외부 PNG가 있으면 그것을 우선 사용한다.
import { makeCharSheet, makeCharSheet2, HAS_DESIGN2, makeMonsterSheet, makeIcon, makeWeaponIcon, makeFaceIcon, makeFaceIcon2, makeTexture } from './generate.js';
import { OVERRIDES } from './overrides.js';

const cache = new Map();
const loaded = new Map(); // 외부 이미지

export async function preloadOverrides(base = '') {
  const jobs = [];
  for (const [kind, map] of Object.entries(OVERRIDES)) {
    for (const [id, src] of Object.entries(map)) {
      jobs.push(new Promise(res => {
        const img = new Image();
        img.onload = () => { loaded.set(kind + ':' + id, img); res(); };
        img.onerror = () => { console.warn('[assets] 외부 에셋 로드 실패, 생성본 사용:', src); res(); };
        img.src = base + src;
      }));
    }
  }
  await Promise.all(jobs);
}

function toCanvasFromImage(img) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  c.getContext('2d').drawImage(img, 0, 0); return c;
}

function memo(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

// { canvas, meta }
export function charSheet(designId, weapon) {
  const key = 'char:' + designId + ':' + (weapon ? weapon.type + JSON.stringify(weapon.tint || {}) : '-');
  return memo(key, () => {
    const gen = HAS_DESIGN2(designId) ? makeCharSheet2(designId, weapon) : makeCharSheet(designId, weapon);
    const ext = loaded.get('chars:' + designId);
    return { key, canvas: ext ? toCanvasFromImage(ext) : gen.buf.toCanvas(), meta: gen.meta };
  });
}

export function monsterSheet(designId) {
  return memo('mon:' + designId, () => {
    const gen = makeMonsterSheet(designId);
    const ext = loaded.get('monsters:' + designId);
    return { key: 'mon:' + designId, canvas: ext ? toCanvasFromImage(ext) : gen.buf.toCanvas(), meta: gen.meta };
  });
}

export function iconCanvas(name) {
  return memo('icon:' + name, () => {
    const ext = loaded.get('icons:' + name);
    if (ext) return toCanvasFromImage(ext);
    if (name.startsWith('w_')) return makeWeaponIcon(name.slice(2)).toCanvas();
    if (name.startsWith('face_')) { const id = name.slice(5); return (HAS_DESIGN2(id) ? makeFaceIcon2(id) : makeFaceIcon(id)).toCanvas(); }
    return makeIcon(name).toCanvas();
  });
}

// CSS/IMG용 dataURL (UI에서 사용)
export function iconURL(name) {
  return memo('url:' + name, () => iconCanvas(name).toDataURL());
}
export function weaponIconURL(type, tint) {
  const key = 'w_' + type + (tint ? JSON.stringify(tint) : '');
  return memo('url:' + key, () => makeWeaponIcon(type, tint).toCanvas().toDataURL());
}

export function textureCanvas(name, variant = 0) {
  return memo('tex:' + name + ':' + variant, () => {
    const ext = loaded.get('tiles:' + name);
    return ext ? toCanvasFromImage(ext) : makeTexture(name, variant).toCanvas();
  });
}
