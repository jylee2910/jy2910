// 캐릭터 액터 생성 + 초상화. 3D 리그가 있으면 리그, 없으면 도트 시트 빌보드
import * as THREE from 'three';
import { Billboard } from './billboard.js';
import { charSheet } from '../art/assets.js';
import { makeCharacter, HAS_RIG } from './heroes.js';
import { RigSprite, readSpriteURL } from './rig.js';

export function makeActor(designId, weaponLook, opts = {}) {
  if (HAS_RIG(designId)) return makeCharacter(designId, weaponLook);
  return new Billboard(charSheet(designId, weaponLook), opts);
}

// 방향 지정: dx/dy = 맵 기준 이동 방향 (y+ = 화면 아래)
export function faceDir(sprite, dx, dy) {
  if (sprite.rig) { if (dx || dy) sprite.yaw = Math.atan2(dx, dy) * 180 / Math.PI; }
  else if (dx) sprite.flipped = dx > 0;
}

// 초상화: 리그를 정면 3/4로 렌더해 dataURL (kind: 'face' 머리, 'bust' 상반신)
const cache = new Map();
export function portraitURL(id, kind = 'face', weaponLook = null) {
  const key = id + ':' + kind + ':' + (kind === 'cut' && weaponLook ? weaponLook.type + JSON.stringify(weaponLook.tint || {}) : '');
  if (cache.has(key)) return cache.get(key);
  const bb = makeCharacter(id, weaponLook);
  bb.yaw = kind === 'face' ? -22 : kind === 'cut' ? -30 : -35; bb.curYaw = bb.yaw;
  if (kind === 'cut') { bb.play('attack_slash'); bb.update(0.24, null); } else { bb.play('idle'); bb.update(0.0001, null); }
  const s = bb.rig.root.children.length ? 1 : 1;
  const head = new THREE.Vector3(); bb.rig.b.head.getWorldPosition(head);
  const sp = kind === 'face'
    ? new RigSprite(bb.rig, { w: 40, h: 40, viewW: 0.55, tilt: 8, centerY: head.y + 0.12 })
    : kind === 'cut' ? new RigSprite(bb.rig, { w: 240, h: 168, viewW: 1.45, tilt: 6, centerY: head.y - 0.22 })
    : new RigSprite(bb.rig, { w: 112, h: 112, viewW: 1.25, tilt: 8, centerY: head.y - 0.22 });
  sp.render();
  const url = readSpriteURL(sp);
  sp.dispose(); bb.dispose();
  cache.set(key, url);
  void s;
  return url;
}
export { HAS_RIG };
