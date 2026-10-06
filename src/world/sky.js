// Sky dome with gradient, sun glow and pixel-quantised drifting clouds,
// plus distant backdrop layers (painted mountain strips).
import * as THREE from 'three';
import { assets } from '../engine/assets.js';

export const SKY_PRESETS = {
  day: { top: 0x3f7fd6, mid: 0x8fc4f0, horizon: 0xe8f2ff, ground: 0x6a7f6a, sun: 0xfff2c8, sunDir: [-0.4, 0.55, -0.7], cloud: 0xffffff, cloudShade: 0x9fb8d8, fog: 0xbfdcf0 },
  dusk: { top: 0x26305e, mid: 0x9a5a7a, horizon: 0xf8b070, ground: 0x3a2a3a, sun: 0xffc070, sunDir: [-0.6, 0.12, -0.8], cloud: 0xffd2a8, cloudShade: 0x8a5a7a, fog: 0xd09a8a },
  night: { top: 0x050a1a, mid: 0x0e1a3a, horizon: 0x24345a, ground: 0x0a0a14, sun: 0xb8d0ff, sunDir: [0.3, 0.4, -0.8], cloud: 0x4a5a80, cloudShade: 0x1a2240, fog: 0x1a2440 },
  shrine: { top: 0x1a2a4a, mid: 0x3a6a8a, horizon: 0x9ad8e0, ground: 0x203030, sun: 0xd0fff8, sunDir: [-0.3, 0.6, -0.7], cloud: 0xd8f0f4, cloudShade: 0x5a8090, fog: 0x8ab8c8 },
};

export class Sky {
  constructor(preset = 'day', radius = 400) {
    const p = SKY_PRESETS[preset];
    this.uniforms = {
      top: { value: new THREE.Color(p.top) },
      mid: { value: new THREE.Color(p.mid) },
      horizon: { value: new THREE.Color(p.horizon) },
      ground: { value: new THREE.Color(p.ground) },
      sunCol: { value: new THREE.Color(p.sun) },
      sunDir: { value: new THREE.Vector3(...p.sunDir).normalize() },
      cloud: { value: new THREE.Color(p.cloud) },
      cloudShade: { value: new THREE.Color(p.cloudShade) },
      time: { value: 0 },
      tNoise: { value: assets.tex.noise },
      stars: { value: preset === 'night' ? 1 : 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
      fragmentShader: `
        uniform vec3 top, mid, horizon, ground, sunCol, sunDir, cloud, cloudShade; uniform float time, stars; uniform sampler2D tNoise;
        varying vec3 vDir;
        float h21(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 45758.5); }
        void main(){
          vec3 d = normalize(vDir);
          float y = d.y;
          vec3 c = y > 0.0 ? mix(horizon, mid, smoothstep(0.0, 0.25, y)) : mix(horizon, ground, smoothstep(0.0, 0.1, -y));
          c = mix(c, top, smoothstep(0.25, 0.9, y));
          float sd = max(dot(d, normalize(sunDir)), 0.0);
          c += sunCol * (pow(sd, 400.0) * 3.0 + pow(sd, 18.0) * 0.35 + pow(sd, 3.0) * 0.12);
          // clouds on a virtual plane
          if (y > 0.015) {
            vec2 cp = d.xz / (y + 0.08) * 0.9;
            cp = floor(cp * 90.0) / 90.0; // pixel quantise
            float n = texture2D(tNoise, cp * 0.08 + vec2(time * 0.0018, time * 0.0007)).r * 0.65
                    + texture2D(tNoise, cp * 0.22 + vec2(time * 0.003, 0.0)).g * 0.35;
            float cov = smoothstep(0.50, 0.62, n) * smoothstep(0.015, 0.12, y);
            float shade = smoothstep(0.5, 0.75, n);
            vec3 cc = mix(cloudShade, cloud, floor(shade * 3.0) / 3.0 + 0.2);
            cc += sunCol * pow(sd, 6.0) * 0.4;
            c = mix(c, cc, cov * 0.92);
          }
          if (stars > 0.5 && y > 0.0) {
            vec2 sp = floor(d.xz / (y + 0.3) * 300.0);
            float s = step(0.997, h21(sp));
            c += s * vec3(1.0) * (0.6 + 0.4 * sin(time * 2.0 + sp.x));
          }
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), mat);
    this.mesh.renderOrder = -10;
    this.mesh.frustumCulled = false;
    this.preset = p;
  }
  update(t, camPos) {
    this.uniforms.time.value = t;
    if (camPos) this.mesh.position.copy(camPos);
  }
}

// Large painted backdrop strip (mountains / forest line) on a cylinder
export function backdrop(texName, radius, height, y, opacity = 1, tint = 0xffffff, repeat = 3) {
  const t = assets.propTex[texName] || assets.tex[texName];
  if (!t) return null;
  const tex = t.clone();
  tex.needsUpdate = true;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(repeat, 1);
  const geo = new THREE.CylinderGeometry(radius, radius, height, 64, 1, true);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.BackSide, depthWrite: false, opacity, color: tint, fog: true, alphaTest: 0.02 });
  const m = new THREE.Mesh(geo, mat);
  m.position.y = y + height / 2;
  m.renderOrder = -5;
  return m;
}
