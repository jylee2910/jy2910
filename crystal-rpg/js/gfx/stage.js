// 렌더러 + HD-2D 포스트 프로세싱
//  씬 렌더(깊이 텍스처 포함) → 깊이 기반 피사계심도(앞/뒤 흐림) → 블룸 → 톤매핑 → 컬러그레이딩/비네트
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { setRigRenderer } from './rig.js';

// 씬을 깊이 텍스처가 있는 자체 타깃에 그린 뒤, 깊이로 흐림 정도(CoC)를 계산해 합성
class SceneDofPass extends Pass {
  constructor(stage) {
    super();
    this.stage = stage;
    this.rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: true });
    this.rt.depthTexture = new THREE.DepthTexture(4, 4);
    this.rt.depthTexture.type = THREE.UnsignedIntType;
    this.uniforms = {
      tColor: { value: null }, tDepth: { value: null },
      near: { value: 0.5 }, far: { value: 200 },
      focus: { value: 12 }, range: { value: 2.2 }, strength: { value: 0.32 },
      maxR: { value: 7 }, texel: { value: new THREE.Vector2() }, enabled: { value: 1 },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: /* glsl */`
        uniform sampler2D tColor; uniform sampler2D tDepth; uniform float near, far, focus, range, strength, maxR, enabled; uniform vec2 texel;
        varying vec2 vUv;
        float lin(float d){ float z = d * 2.0 - 1.0; return 2.0 * near * far / (far + near - z * (far - near)); }
        float coc(vec2 uv){ float l = lin(texture2D(tDepth, uv).r); float d = l - focus; float k = max(0.0, abs(d) - range) * strength; if (d < 0.0) k *= 1.7; return clamp(k, 0.0, 1.0); }
        void main(){
          vec4 base = texture2D(tColor, vUv);
          if (enabled < 0.5) { gl_FragColor = base; return; }
          float c = coc(vUv);
          vec3 acc = base.rgb; float wsum = 1.0;
          const int N = ${stage.mobile ? 12 : 20};
          for (int i = 0; i < N; i++) {
            float fi = float(i);
            float r = sqrt((fi + 0.5) / float(N));
            float a = fi * 2.39996;
            vec2 off = vec2(cos(a), sin(a)) * r * maxR * texel;
            float sc = coc(vUv + off);
            float rad = max(c, sc * 0.85);    // 흐린 이웃이 선명한 영역 위로 번지도록
            vec2 o = off * rad;
            vec3 s = texture2D(tColor, vUv + o).rgb;
            float w = 0.4 + rad;
            acc += s * w; wsum += w;
          }
          vec3 blur = acc / wsum;
          gl_FragColor = vec4(mix(base.rgb, blur, smoothstep(0.0, 0.35, c)), 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.fsQuad = new FullScreenQuad(this.material);
    this.clearColor = new THREE.Color(0, 0, 0);
  }
  setSize(w, h) {
    this.rt.setSize(w, h);
    this.rt.depthTexture.image.width = w; this.rt.depthTexture.image.height = h;
    this.uniforms.texel.value.set(1 / w, 1 / h);
  }
  render(renderer, writeBuffer) {
    const st = this.stage;
    renderer.setRenderTarget(this.rt);
    renderer.clear();
    renderer.render(st.scene, st.camera);
    const u = this.uniforms;
    u.tColor.value = this.rt.texture; u.tDepth.value = this.rt.depthTexture;
    u.near.value = st.camera.near; u.far.value = st.camera.far;
    u.focus.value = st.dof.focus; u.range.value = st.dof.range; u.strength.value = st.dof.strength; u.enabled.value = st.dof.enabled ? 1 : 0;
    u.maxR.value = st.dof.maxR * (st.pixelRatio || 1);
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.fsQuad.render(renderer);
  }
}

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    vignette: { value: 0.95 },
    tint: { value: new THREE.Vector3(1.0, 0.985, 0.95) },
    flash: { value: new THREE.Vector4(1, 1, 1, 0) },
    sat: { value: 1.1 },
    time: { value: 0 },
    lift: { value: new THREE.Vector3(0.025, 0.02, 0.045) },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float vignette; uniform vec3 tint; uniform vec4 flash; uniform float sat; uniform float time; uniform vec3 lift;
    varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.299,0.587,0.114));
      c.rgb = mix(vec3(l), c.rgb, sat) * tint;
      // 스플릿 톤: 그림자는 푸르게 들어 올리고 하이라이트는 따뜻하게
      c.rgb = c.rgb + lift * (1.0 - smoothstep(0.0, 0.5, l));
      c.rgb += vec3(0.035, 0.018, -0.012) * smoothstep(0.55, 1.0, l);
      // 부드러운 S 커브
      c.rgb = mix(c.rgb, c.rgb * c.rgb * (3.0 - 2.0 * c.rgb), 0.25);
      vec2 d = vUv - 0.5; d.x *= 1.25;
      float v = smoothstep(0.9, 0.22, length(d) * vignette);
      c.rgb *= mix(0.55, 1.0, v);
      // 아주 약한 필름 그레인
      float n = fract(sin(dot(vUv * 800.0 + time, vec2(12.9898, 78.233))) * 43758.5453);
      c.rgb += (n - 0.5) * 0.018;
      c.rgb = mix(c.rgb, flash.rgb, flash.a);
      gl_FragColor = c;
    }`,
};

export class Stage {
  constructor(container) {
    this.container = container;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.mobile = matchMedia('(pointer: coarse)').matches;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, this.mobile ? 1.35 : 1.75);
    r.setPixelRatio(this.pixelRatio);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.08;
    container.appendChild(r.domElement);
    setRigRenderer(r);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.5, 200);
    this.dof = { focus: 12, range: 2.0, strength: 0.3, maxR: 7, enabled: true };

    this.composer = new EffectComposer(r);
    this.scenePass = new SceneDofPass(this);
    this.composer.addPass(this.scenePass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.55, 0.8);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);

    this.shake = { t: 0, amp: 0 };
    this.flashA = 0;
    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
    this.resize();
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth, h = this.container.clientHeight || window.innerHeight;
    this.width = w; this.height = h;
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    // 세로 화면에서는 화각을 넓혀 디오라마가 잘리지 않게
    this.camera.fov = this.baseFov ? (this.camera.aspect < 1 ? this.baseFov * Math.min(this.maxFovMul || 1.7, 1 / this.camera.aspect * 0.95) : this.baseFov) : 30;
    this.camera.updateProjectionMatrix();
  }

  setFov(f, maxMul = 1.7) { this.baseFov = f; this.maxFovMul = maxMul; this.resize(); }
  // 이전 API 호환 (틸트시프트 → 깊이 DOF로 대체)
  applyTilt() {}
  setFocus(dist, range = 2.0, strength = 0.3) { this.dof.focus = dist; this.dof.range = range; this.dof.strength = strength; }
  focusOn(worldPos, range, strength) { this.setFocus(this.camera.position.distanceTo(worldPos), range, strength); }

  setWorld(scene) { this.scene = scene; }

  addShake(amp, dur = 0.25) { this.shake.amp = Math.max(this.shake.amp, amp); this.shake.t = Math.max(this.shake.t, dur); this.shake.dur = dur; }
  flash(color = 0xffffff, a = 0.7) { const c = new THREE.Color(color); this.grade.uniforms.flash.value.set(c.r, c.g, c.b, a); this.flashA = a; }

  render(dt) {
    const cam = this.camera;
    let ox = 0, oy = 0;
    if (this.shake.t > 0) {
      this.shake.t -= dt;
      const k = Math.max(0, this.shake.t / (this.shake.dur || 0.25));
      ox = (Math.random() - 0.5) * this.shake.amp * k; oy = (Math.random() - 0.5) * this.shake.amp * k;
      cam.position.x += ox; cam.position.y += oy;
    }
    if (this.flashA > 0) { this.flashA = Math.max(0, this.flashA - dt * 3); this.grade.uniforms.flash.value.w = this.flashA; }
    this.grade.uniforms.time.value = (this.grade.uniforms.time.value + dt) % 100;
    this.composer.render(dt);
    cam.position.x -= ox; cam.position.y -= oy;
  }

  project(v) {
    const p = v.clone().project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * this.width, y: (-p.y * 0.5 + 0.5) * this.height, behind: p.z > 1 };
  }
}
