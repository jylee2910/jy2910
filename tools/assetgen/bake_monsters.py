"""Bake monster atlases -> public/assets/sprites/m_<name>.png/json"""
import json
import os
import sys
import time
from multiprocessing import Pool

import numpy as np
from PIL import Image

from humanoid import Builder
from monsters import BESTIARY
from sdf import render_sprite, to_u8

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "assets", "sprites")
SCALE = 0.75
PITCH = 9
YAW = -58


def render(args):
    name, anim, i, n = args
    cls = BESTIARY[name]
    w, h, ax, ay = cls.size
    B = Builder()
    cls.materials(B)
    cls.build(B, anim, i, n)
    img, _ = render_sprite(B.prims, B.mats, w, h, (0, 0, 0), (ax, ay), yaw=YAW, pitch=PITCH, scale=SCALE, steps=128)
    return to_u8(img)


def bake(name, pool, preview=False):
    t0 = time.time()
    cls = BESTIARY[name]
    jobs = []
    meta = []
    for an, (n, fps, loop) in cls.anims.items():
        meta.append((an, n, fps, loop))
        for i in range(n):
            jobs.append((name, an, i, n))
    ims = pool.map(render, jobs)
    w, h, ax, ay = cls.size
    cols = max(m[1] for m in meta)
    atlas = np.zeros((h * len(meta), w * cols, 4), dtype=np.uint8)
    out = {"image": "m_" + name + ".png", "scale": SCALE, "anims": {}}
    k = 0
    for r, (an, n, fps, loop) in enumerate(meta):
        fr = []
        for i in range(n):
            atlas[r * h : (r + 1) * h, i * w : (i + 1) * w] = ims[k]
            fr.append([i * w, r * h, w, h])
            k += 1
        out["anims"]["battle." + an] = {"frames": fr, "fps": fps, "loop": loop, "ax": ax, "ay": ay}
    os.makedirs(OUT, exist_ok=True)
    Image.fromarray(atlas, "RGBA").save(os.path.join(OUT, "m_" + name + ".png"), optimize=True)
    with open(os.path.join(OUT, "m_" + name + ".json"), "w") as f:
        json.dump(out, f)
    print(f"{name}: {len(jobs)} frames {time.time() - t0:.1f}s")
    if preview:
        im = Image.fromarray(atlas, "RGBA")
        bg = Image.new("RGBA", im.size, (80, 100, 84, 255))
        bg.alpha_composite(im)
        bg.resize((im.width * 2, im.height * 2), Image.NEAREST).save(f"/tmp/claude-0/-home-user-jy2910/5a38f85b-c21f-5751-aafd-449cad322cff/scratchpad/prev_m_{name}.png")


if __name__ == "__main__":
    names = [a for a in sys.argv[1:] if not a.startswith("--")] or list(BESTIARY)
    with Pool(4) as pool:
        for n in names:
            bake(n, pool, "--preview" in sys.argv)
