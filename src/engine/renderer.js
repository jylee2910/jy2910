// HD-2D rendering pipeline:
//   scene -> HDR target (+depth) -> depth-of-field / tilt-shift -> bloom -> grade (tonemap, LUT-ish colour, vignette, grain)
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

const FS_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const DOF_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 resolution;
uniform float cameraNear, cameraFar;
uniform float focusDist, focusRange, maxBlur, nearScale;
uniform float tilt, tiltCenter, tiltWidth;
uniform float enabled;

float linDepth(float d){
  float z = d * 2.0 - 1.0;
  return 2.0 * cameraNear * cameraFar / (cameraFar + cameraNear - z * (cameraFar - cameraNear));
}
float cocAt(vec2 uv){
  float d = linDepth(texture2D(tDepth, uv).x);
  float c = (d - focusDist) / focusRange;
  c = c < 0.0 ? c * nearScale : c;
  float t = max(0.0, abs(uv.y - tiltCenter) - tiltWidth) * tilt * 4.0;
  float cc = clamp(abs(c), 0.0, 1.0);
  return clamp(max(cc, t), 0.0, 1.0) * sign(c + 1e-5);
}
void main(){
  vec4 base = texture2D(tColor, vUv);
  if (enabled < 0.5) { gl_FragColor = base; return; }
  float c0 = cocAt(vUv);
  float r = abs(c0) * maxBlur;
  if (r < 0.5) { gl_FragColor = base; return; }
  vec3 acc = base.rgb; float wsum = 1.0;
  const int N = 40;
  const float GA = 2.39996323;
  for (int i = 1; i < N; i++) {
    float fi = float(i);
    float rr = sqrt(fi / float(N)) * r;
    float a = fi * GA;
    vec2 o = vec2(cos(a), sin(a)) * rr / resolution;
    vec2 suv = vUv + o;
    vec3 s = texture2D(tColor, suv).rgb;
    float cs = cocAt(suv);
    // don't let sharp (in-focus) foreground pixels bleed into the blurred background
    float w = c0 > 0.0 ? smoothstep(0.0, 1.0, abs(cs) * maxBlur - rr + 1.5) : 1.0;
    // bokeh highlights
    w *= 1.0 + dot(s, vec3(0.3, 0.5, 0.2)) * 0.6;
    acc += s * w; wsum += w;
  }
  gl_FragColor = vec4(acc / wsum, 1.0);
}
`;

const GRADE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tInput;
uniform vec2 resolution;
uniform float time;
uniform float exposure;
uniform float saturation;
uniform float contrast;
uniform vec3 lift, gamma, gain;
uniform float vignette;
uniform float grain;
uniform float aberration;
uniform vec3 flashColor; uniform float flash;
uniform vec3 tintColor; uniform float tint;
uniform float letterbox;
uniform float radial; uniform vec2 radialCenter;
uniform float desat;

vec3 aces(vec3 x){
  const float a = 2.51; const float b = 0.03; const float c = 2.43; const float d = 0.59; const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main(){
  vec2 uv = vUv;
  vec3 col;
  if (radial > 0.001) {
    vec2 dir = uv - radialCenter;
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 12; i++) {
      float t = float(i) / 11.0;
      acc += texture2D(tInput, uv - dir * t * radial * 0.25).rgb;
    }
    col = acc / 12.0;
  } else {
    vec2 d = (uv - 0.5);
    float ab = aberration * dot(d, d);
    col.r = texture2D(tInput, uv - d * ab).r;
    col.g = texture2D(tInput, uv).g;
    col.b = texture2D(tInput, uv + d * ab).b;
  }
  col *= exposure;
  col = aces(col);
  // lift / gamma / gain
  col = pow(max(col * gain + lift * (1.0 - col), 0.0), 1.0 / gamma);
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(l), col, saturation * (1.0 - desat));
  col = (col - 0.5) * contrast + 0.5;
  // tints / flashes
  col = mix(col, col * tintColor * 1.4 + tintColor * 0.12, tint);
  col = mix(col, flashColor, flash);
  // vignette
  vec2 q = uv - 0.5; q.x *= resolution.x / resolution.y;
  float v = smoothstep(0.95, 0.25, length(q));
  col *= mix(1.0, v, vignette);
  // grain
  col += (hash(uv * resolution + fract(time) * 100.0) - 0.5) * grain;
  // letterbox
  float lb = letterbox * 0.12;
  if (uv.y < lb || uv.y > 1.0 - lb) col = vec3(0.0);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  #include <colorspace_fragment>
}
`;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.NoToneMapping;
    this.gl = gl;
    this.size = new THREE.Vector2();

    this.fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.fsGeo = new THREE.PlaneGeometry(2, 2);

    this.dofMat = new THREE.ShaderMaterial({
      vertexShader: FS_VERT,
      fragmentShader: DOF_FRAG,
      uniforms: {
        tColor: { value: null }, tDepth: { value: null },
        resolution: { value: new THREE.Vector2() },
        cameraNear: { value: 0.1 }, cameraFar: { value: 500 },
        focusDist: { value: 20 }, focusRange: { value: 18 }, maxBlur: { value: 9 }, nearScale: { value: 1.6 },
        tilt: { value: 0.0 }, tiltCenter: { value: 0.5 }, tiltWidth: { value: 0.2 },
        enabled: { value: 1 },
      },
      depthTest: false, depthWrite: false,
    });
    this.gradeMat = new THREE.ShaderMaterial({
      vertexShader: FS_VERT,
      fragmentShader: GRADE_FRAG,
      uniforms: {
        tInput: { value: null }, resolution: { value: new THREE.Vector2() }, time: { value: 0 },
        exposure: { value: 0.92 }, saturation: { value: 1.02 }, contrast: { value: 1.06 },
        lift: { value: new THREE.Vector3(0.02, 0.015, 0.04) },
        gamma: { value: new THREE.Vector3(1.0, 1.0, 1.0) },
        gain: { value: new THREE.Vector3(1.03, 1.0, 0.96) },
        vignette: { value: 0.55 }, grain: { value: 0.025 }, aberration: { value: 0.012 },
        flashColor: { value: new THREE.Color(1, 1, 1) }, flash: { value: 0 },
        tintColor: { value: new THREE.Color(1, 0.8, 0.4) }, tint: { value: 0 },
        letterbox: { value: 0 }, radial: { value: 0 }, radialCenter: { value: new THREE.Vector2(0.5, 0.5) },
        desat: { value: 0 },
      },
      depthTest: false, depthWrite: false,
    });
    this.quad = new THREE.Mesh(this.fsGeo, this.dofMat);
    this.quad.frustumCulled = false;
    this.fsScene = new THREE.Scene();
    this.fsScene.add(this.quad);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  makeTargets(w, h) {
    this.sceneRT?.dispose();
    this.dofRT?.dispose();
    const opts = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.sceneRT = new THREE.WebGLRenderTarget(w, h, opts);
    this.sceneRT.depthTexture = new THREE.DepthTexture(w, h);
    this.sceneRT.depthTexture.type = THREE.UnsignedIntType;
    this.dofRT = new THREE.WebGLRenderTarget(w, h, opts);
    if (!this.bloom) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.55, 0.55, 0.82);
    } else this.bloom.setSize(w, h);
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.gl.setSize(w, h, false);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.gl.getDrawingBufferSize(this.size);
    this.makeTargets(this.size.x, this.size.y);
    this.dofMat.uniforms.resolution.value.copy(this.size);
    this.gradeMat.uniforms.resolution.value.copy(this.size);
    if (this.camera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }

  setCamera(cam) {
    this.camera = cam;
    cam.aspect = window.innerWidth / window.innerHeight;
    cam.updateProjectionMatrix();
  }

  get post() {
    return { dof: this.dofMat.uniforms, grade: this.gradeMat.uniforms, bloom: this.bloom };
  }

  render(scene, camera, t) {
    const gl = this.gl;
    gl.setRenderTarget(this.sceneRT);
    gl.clear();
    gl.render(scene, camera);

    const du = this.dofMat.uniforms;
    du.tColor.value = this.sceneRT.texture;
    du.tDepth.value = this.sceneRT.depthTexture;
    du.cameraNear.value = camera.near;
    du.cameraFar.value = camera.far;
    this.quad.material = this.dofMat;
    gl.setRenderTarget(this.dofRT);
    gl.render(this.fsScene, this.fsCam);

    // bloom blends into dofRT
    this.bloom.render(gl, null, this.dofRT, 0, false);

    const gu = this.gradeMat.uniforms;
    gu.tInput.value = this.dofRT.texture;
    gu.time.value = t;
    this.quad.material = this.gradeMat;
    gl.setRenderTarget(null);
    gl.render(this.fsScene, this.fsCam);
  }
}
