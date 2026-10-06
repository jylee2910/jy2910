// Stylised pixel water: depth tint, animated quantised waves, shore foam,
// glints that feed the bloom pass, fresnel sky reflection.
import * as THREE from 'three';
import { assets } from '../engine/assets.js';

const VERT = /* glsl */ `
attribute float depth;
varying float vDepth;
varying vec3 vWP;
#include <fog_pars_vertex>
void main(){
  vDepth = depth;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = /* glsl */ `
uniform float time;
uniform sampler2D tNoise;
uniform vec3 shallow, deep, foamCol, skyCol;
uniform float opacity;
varying float vDepth;
varying vec3 vWP;
#include <fog_pars_fragment>
void main(){
  float px = 1.28 / 64.0;
  vec2 q = floor(vWP.xz / px) * px;
  float t = time;
  float n1 = texture2D(tNoise, q * 0.08 + vec2(t * 0.012, t * 0.007)).r;
  float n2 = texture2D(tNoise, q * 0.15 - vec2(t * 0.009, -t * 0.013)).g;
  float wave = n1 * 0.6 + n2 * 0.4;
  float d = clamp(vDepth / 2.2, 0.0, 1.0);
  vec3 col = mix(shallow, deep, smoothstep(0.0, 1.0, d));
  // quantised wave bands
  float band = floor(wave * 5.0) / 5.0;
  col *= 0.86 + band * 0.28;
  // fresnel-ish reflection toward the far side
  vec3 V = normalize(cameraPosition - vWP);
  float fr = pow(1.0 - clamp(V.y, 0.0, 1.0), 3.0);
  col = mix(col, skyCol, fr * 0.35);
  // ripple highlight lines
  float ln = step(0.73, fract(wave * 6.0 + t * 0.1)) * step(0.55, n2);
  col += ln * 0.12 * (1.0 - d);
  // foam near the shore (low depth)
  float foamEdge = 0.06 + 0.05 * sin(t * 1.4 + n1 * 6.28);
  float foam = step(vDepth, foamEdge + n2 * 0.08);
  float foam2 = step(vDepth, 0.22 + n1 * 0.1) * step(0.62, fract(n2 * 5.0 - t * 0.2)) * (1.0 - foam);
  col = mix(col, foamCol, foam * 0.8 + foam2 * 0.35);
  // glints (bloom)
  float g = step(0.985, n1 * n2 * 1.9 + 0.05 * sin(t * 3.0 + q.x * 3.0));
  col += g * vec3(1.4, 1.4, 1.2) * (1.0 - foam);
  float a = mix(opacity * 0.75, opacity, d) + foam * 0.2;
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
  #include <fog_fragment>
}`;

export class Water {
  constructor({ x0, z0, width, depth, level, terrain, step = 0.5, shallow = 0x3fa6c8, deep = 0x103a6a, sky = 0x9fd4f2 }) {
    const nx = Math.round(width / step) + 1;
    const nz = Math.round(depth / step) + 1;
    const pos = [];
    const dep = [];
    const idx = [];
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const x = x0 + i * step, z = z0 + j * step;
        pos.push(x, level, z);
        dep.push(level - terrain.heightAt(x, z));
      }
    for (let j = 0; j < nz - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
        // skip quads entirely above the terrain
        if (Math.max(dep[a], dep[b], dep[c], dep[d]) < -0.05) continue;
        idx.push(a, c, b, b, c, d);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('depth', new THREE.Float32BufferAttribute(dep, 1));
    geo.setIndex(idx);
    this.uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        time: { value: 0 },
        tNoise: { value: assets.tex.water_noise },
        shallow: { value: new THREE.Color(shallow) },
        deep: { value: new THREE.Color(deep) },
        foamCol: { value: new THREE.Color(0xe8f6ff) },
        skyCol: { value: new THREE.Color(sky) },
        opacity: { value: 0.9 },
      },
    ]);
    this.uniforms.tNoise.value = assets.tex.water_noise;
    this.mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms, transparent: true, fog: true, depthWrite: false });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.renderOrder = 2;
    this.level = level;
  }

  update(t) {
    this.uniforms.time.value = t;
  }
}

// vertical scrolling waterfall sheet
export class Waterfall {
  constructor({ x, z, y0, y1, width, rotY = 0 }) {
    const geo = new THREE.PlaneGeometry(width, y1 - y0, 1, 1);
    geo.translate(0, (y1 - y0) / 2, 0);
    this.uniforms = {
      time: { value: 0 },
      tNoise: { value: assets.tex.water_noise },
      h: { value: y1 - y0 },
      w: { value: width },
    };
    this.mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
      fragmentShader: `uniform float time,h,w; uniform sampler2D tNoise; varying vec2 vUv;
        void main(){
          vec2 p = vec2(vUv.x * w, vUv.y * h);
          float px = 1.28/64.0; p = floor(p/px)*px;
          float n = texture2D(tNoise, vec2(p.x*0.25, p.y*0.05 + time*0.35)).r;
          float s = step(0.55, fract(n*4.0 + p.x*0.3));
          vec3 c = mix(vec3(0.35,0.7,0.9), vec3(0.85,0.97,1.0), s);
          c += step(0.8, n) * 0.6;
          float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
          gl_FragColor = vec4(c * 1.15, 0.86 * edge);
        }`,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.position.set(x, y0, z);
    this.mesh.rotation.y = rotY;
    this.mesh.renderOrder = 3;
  }
  update(t) {
    this.uniforms.time.value = t;
  }
}
