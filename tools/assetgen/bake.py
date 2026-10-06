"""Bake character sprite atlases.

usage: python3 bake.py [name ...] [--preview]
Writes public/assets/sprites/<name>.png + <name>.json
"""
import json
import os
import sys
import time
from multiprocessing import Pool

import numpy as np
from PIL import Image

import anims
from characters import CAST, build_character
from humanoid import paint_eyes
from rig import Skeleton
from sdf import render_sprite, to_u8

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "assets", "sprites")
SCALE = 0.75
PITCH = 9

VIEWS = {
    # name: (yaw, frame w, frame h, anchor x, anchor y)
    "battle": (58, 176, 152, 108, 140),
    "down": (0, 112, 120, 56, 114),
    "up": (180, 112, 120, 56, 114),
    "left": (90, 112, 120, 56, 114),
}


def render_frame(args):
    name, view, pose, closed = args
    cls = CAST[name]
    yaw, fw, fh, ax, ay = VIEWS[view]
    sk = Skeleton(overrides=getattr(cls, "skeleton", None), scale=getattr(cls, "skscale", 1.0))
    W = sk.solve(pose)
    B = build_character(cls, W, pose)
    img, info = render_sprite(B.prims, B.mats, fw, fh, (0, 0, 0), (ax, ay), yaw=yaw, pitch=PITCH, scale=SCALE)
    img = paint_eyes(img, info, W, (0, 0, 0), (ax, ay), yaw, PITCH, cls.eye, style=cls.eye_style, scale=SCALE, closed=closed, **getattr(cls, "eye_pos", {}))
    return to_u8(img)


def jobs_for(name):
    cls = CAST[name]
    style = getattr(cls, "style", "sword")
    jobs = []
    meta = []
    battle = getattr(cls, "battle", True)
    if battle:
        for an, (fn, fps, loop) in anims.BATTLE_ANIMS.items():
            frames = fn(style)
            meta.append(("battle", an, len(frames), fps, loop))
            for i, p in enumerate(frames):
                jobs.append((name, "battle", p, an in ("ko",)))
    for view in (("down", "up", "left") if getattr(cls, "field", True) else ()):
        for an, (fn, fps, loop) in anims.FIELD_ANIMS.items():
            frames = fn(style)
            meta.append((view, an, len(frames), fps, loop))
            for p in frames:
                jobs.append((name, view, p, False))
    for an, fn in getattr(cls, "extra", {}).items():
        view, frames, fps, loop = fn()
        meta.append((view, an, len(frames), fps, loop))
        for p in frames:
            jobs.append((name, view, p, False))
    return jobs, meta


def pack(name, images, meta):
    # one row per animation
    rows = []
    k = 0
    for view, an, n, fps, loop in meta:
        rows.append((view, an, images[k : k + n], fps, loop))
        k += n
    width = max(sum(im.shape[1] for im in r[2]) for r in rows)
    height = sum(max(im.shape[0] for im in r[2]) for r in rows)
    atlas = np.zeros((height, width, 4), dtype=np.uint8)
    out = {"image": name + ".png", "scale": SCALE, "anims": {}}
    y = 0
    for view, an, ims, fps, loop in rows:
        x = 0
        h = max(im.shape[0] for im in ims)
        fr = []
        for im in ims:
            atlas[y : y + im.shape[0], x : x + im.shape[1]] = im
            fr.append([x, y, im.shape[1], im.shape[0]])
            x += im.shape[1]
        _, fw, fh, ax, ay = VIEWS[view]
        out["anims"][view + "." + an] = {"frames": fr, "fps": fps, "loop": loop, "ax": ax, "ay": ay}
        y += h
    os.makedirs(OUT, exist_ok=True)
    Image.fromarray(atlas, "RGBA").save(os.path.join(OUT, name + ".png"), optimize=True)
    with open(os.path.join(OUT, name + ".json"), "w") as f:
        json.dump(out, f)
    return atlas


def bake(name, pool):
    t0 = time.time()
    jobs, meta = jobs_for(name)
    images = pool.map(render_frame, jobs)
    atlas = pack(name, images, meta)
    print(f"{name}: {len(jobs)} frames, atlas {atlas.shape[1]}x{atlas.shape[0]} in {time.time() - t0:.1f}s")
    return atlas


if __name__ == "__main__":
    names = [a for a in sys.argv[1:] if not a.startswith("--")] or list(CAST)
    with Pool(4) as pool:
        for n in names:
            atlas = bake(n, pool)
            if "--preview" in sys.argv:
                im = Image.fromarray(atlas, "RGBA")
                bg = Image.new("RGBA", im.size, (80, 100, 84, 255))
                bg.alpha_composite(im)
                bg.resize((im.width * 2, im.height * 2), Image.NEAREST).save(f"/tmp/claude-0/-home-user-jy2910/5a38f85b-c21f-5751-aafd-449cad322cff/scratchpad/prev_{n}.png")
