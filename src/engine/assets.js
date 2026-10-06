import * as THREE from 'three';

const BASE = './assets/';

export const SPRITES = ['kael', 'argen', 'mira', 'nell', 'king', 'soldier', 'm_imp', 'm_crawler', 'm_wolf', 'm_ember', 'm_wyvern', 'echo_paladin', 'echo_saint', 'echo_sage'];
export const TEXTURES = ['grass', 'grass2', 'forest', 'dirt', 'dirt_dark', 'sand', 'rock', 'cliff', 'cobble', 'castle_floor', 'bricks', 'castle_wall', 'marble', 'carpet', 'wood', 'roof', 'roof_red', 'plaster', 'water_noise', 'noise', 'bg_mountains', 'bg_mountains_dusk', 'bg_trees', 'bg_trees_far'];
export const EXTRA = ['fx/fx.json', 'ui/icons.json'];

class Assets {
  constructor() {
    this.atlas = {};
    this.tex = {};
    this.props = {};
    this.propTex = {};
    this.images = {};
    this.json = {};
    this.loader = new THREE.TextureLoader();
  }

  async loadJSON(path) {
    const r = await fetch(BASE + path);
    if (!r.ok) throw new Error('missing ' + path);
    return r.json();
  }

  loadTexture(path, pixel = true, mip = false) {
    return new Promise((res, rej) => {
      this.loader.load(
        BASE + path,
        (t) => {
          t.colorSpace = THREE.SRGBColorSpace;
          t.magFilter = THREE.NearestFilter;
          if (mip) {
            t.minFilter = THREE.NearestMipmapLinearFilter;
            t.generateMipmaps = true;
            t.anisotropy = 4;
          } else {
            t.minFilter = pixel ? THREE.NearestFilter : THREE.LinearFilter;
            t.generateMipmaps = false;
          }
          res(t);
        },
        undefined,
        () => rej(new Error('texture ' + path)),
      );
    });
  }

  async loadAll(progress) {
    const jobs = [];
    let done = 0;
    const tick = () => progress && progress(++done / jobs.length);
    for (const s of SPRITES) {
      jobs.push(
        (async () => {
          try {
            const meta = await this.loadJSON('sprites/' + s + '.json');
            const tex = await this.loadTexture('sprites/' + meta.image);
            this.atlas[s] = { meta, tex, w: tex.image.width, h: tex.image.height };
          } catch (e) {
            console.warn('sprite missing', s, e.message);
          }
          tick();
        })(),
      );
    }
    for (const t of TEXTURES) {
      jobs.push(
        (async () => {
          const tx = await this.loadTexture('tex/' + t + '.png', true, true);
          tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
          if (t.includes('noise')) {
            tx.colorSpace = THREE.NoColorSpace;
            tx.magFilter = THREE.LinearFilter;
            tx.minFilter = THREE.LinearMipmapLinearFilter;
          }
          this.tex[t] = tx;
          tick();
        })(),
      );
    }
    jobs.push(
      (async () => {
        this.props = await this.loadJSON('props/props.json');
        const names = Object.keys(this.props);
        await Promise.all(
          names.map(async (n) => {
            this.propTex[n] = await this.loadTexture('props/' + n + '.png');
          }),
        );
        tick();
      })(),
    );
    for (const e of EXTRA) {
      jobs.push(
        (async () => {
          try {
            const meta = await this.loadJSON(e);
            this.json[e] = meta;
            const dir = e.split('/')[0] + '/';
            if (meta.image) this.images[e] = await this.loadTexture(dir + meta.image);
          } catch (err) {
            console.warn('extra missing', e);
          }
          tick();
        })(),
      );
    }
    await Promise.all(jobs);
  }

  url(path) {
    return BASE + path;
  }
}

export const assets = new Assets();
