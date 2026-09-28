// 렌더러 + HD-2D 포스트 프로세싱 (블룸 → 톤매핑 → 틸트시프트 → 컬러그레이딩/비네트)
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { HorizontalTiltShiftShader } from 'three/addons/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    vignette: { value: 0.9 },
    tint: { value: new THREE.Vector3(1.0, 0.98, 0.94) },
    flash: { value: new THREE.Vector4(1, 1, 1, 0) },
    sat: { value: 1.12 },
    time: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float vignette; uniform vec3 tint; uniform vec4 flash; uniform float sat; uniform float time;
    varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.299,0.587,0.114));
      c.rgb = mix(vec3(l), c.rgb, sat) * tint;
      // 살짝 따뜻한 하이라이트 / 차가운 그림자
      c.rgb += vec3(0.03,0.015,-0.01) * smoothstep(0.5,1.0,l) + vec3(-0.01,0.0,0.03) * (1.0 - smoothstep(0.0,0.35,l));
      vec2 d = vUv - 0.5; d.x *= 1.2;
      float v = smoothstep(0.85, 0.2, length(d) * vignette);
      c.rgb *= mix(0.62, 1.0, v);
      c.rgb = mix(c.rgb, flash.rgb, flash.a);
      gl_FragColor = c;
    }`,
};

export class Stage {
  constructor(container) {
    this.container = container;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.mobile = matchMedia('(pointer: coarse)').matches;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, this.mobile ? 1.5 : 2);
    r.setPixelRatio(this.pixelRatio);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    container.appendChild(r.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.5, 200);

    this.composer = new EffectComposer(r);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.5, 0.82);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.tiltH = new ShaderPass(HorizontalTiltShiftShader);
    this.tiltV = new ShaderPass(VerticalTiltShiftShader);
    this.composer.addPass(this.tiltH);
    this.composer.addPass(this.tiltV);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);

    this.tiltAmount = 2.2; // 틸트시프트 세기
    this.focus = 0.5;       // 초점 라인 (0=아래,1=위)

    this.shake = { t: 0, amp: 0 };
    this.camBase = new THREE.Vector3();
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
    this.camera.fov = this.baseFov ? (this.camera.aspect < 1 ? this.baseFov * Math.min(1.7, 1 / this.camera.aspect * 0.95) : this.baseFov) : 30;
    this.camera.updateProjectionMatrix();
    this.applyTilt();
  }

  setFov(f) { this.baseFov = f; this.resize(); }

  applyTilt() {
    const k = this.tiltAmount;
    this.tiltH.uniforms.h.value = k / (this.width * this.pixelRatio);
    this.tiltV.uniforms.v.value = k / (this.height * this.pixelRatio);
    this.tiltH.uniforms.r.value = this.focus;
    this.tiltV.uniforms.r.value = this.focus;
  }

  setWorld(scene) { this.scene = scene; this.renderPass.scene = scene; }

  addShake(amp, dur = 0.25) { this.shake.amp = Math.max(this.shake.amp, amp); this.shake.t = Math.max(this.shake.t, dur); this.shake.dur = dur; }
  flash(color = 0xffffff, a = 0.7) { const c = new THREE.Color(color); this.grade.uniforms.flash.value.set(c.r, c.g, c.b, a); this.flashA = a; }

  render(dt) {
    // 카메라 흔들림 (렌더 직전에만 적용 후 복구)
    const cam = this.camera;
    let ox = 0, oy = 0;
    if (this.shake.t > 0) {
      this.shake.t -= dt;
      const k = Math.max(0, this.shake.t / (this.shake.dur || 0.25));
      ox = (Math.random() - 0.5) * this.shake.amp * k; oy = (Math.random() - 0.5) * this.shake.amp * k;
      cam.position.x += ox; cam.position.y += oy;
    }
    if (this.flashA > 0) { this.flashA = Math.max(0, this.flashA - dt * 3); this.grade.uniforms.flash.value.w = this.flashA; }
    this.grade.uniforms.time.value += dt;
    this.composer.render(dt);
    cam.position.x -= ox; cam.position.y -= oy;
  }

  // 3D 좌표 → 화면 px
  project(v) {
    const p = v.clone().project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * this.width, y: (-p.y * 0.5 + 0.5) * this.height, behind: p.z > 1 };
  }
}
