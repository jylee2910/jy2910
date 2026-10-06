// Shared lighting / atmosphere setup.
import * as THREE from 'three';

export function setupLights(scene, o = {}) {
  const hemi = new THREE.HemisphereLight(o.sky ?? 0xc8dcff, o.ground ?? 0x5a4a38, o.hemi ?? 1.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(o.sun ?? 0xfff0d8, o.sunI ?? 2.4);
  const d = o.sunDir ?? [-14, 26, 12];
  sun.position.set(...d);
  sun.castShadow = true;
  sun.shadow.mapSize.set(o.shadowRes ?? 2048, o.shadowRes ?? 2048);
  const s = o.shadowSize ?? 26;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 0.5, far: 120 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 2.5;
  scene.add(sun);
  scene.add(sun.target);
  const offset = new THREE.Vector3(...d);
  return {
    hemi,
    sun,
    follow(p) {
      sun.position.copy(p).add(offset);
      sun.target.position.copy(p);
    },
  };
}

export function setFog(scene, color, near, far) {
  scene.fog = new THREE.Fog(color, near, far);
  scene.background = new THREE.Color(color);
}
