import sys
import time

import numpy as np
from PIL import Image

from characters import CAST, build_character
from humanoid import paint_eyes
from rig import Skeleton
from sdf import render_sprite, to_u8

OUT = sys.argv[2] if len(sys.argv) > 2 else "/tmp/sheet.png"
name = sys.argv[1] if len(sys.argv) > 1 else "kael"
cls = CAST[name]
sk = Skeleton()
pose = {
    "sh_r": (20, 0, -12),
    "el_r": (35, 0, 0),
    "sh_l": (-5, 0, 10),
    "el_l": (15, 0, 0),
    "hip_r": (-8, 0, -3),
    "hip_l": (8, 0, 3),
    "kn_r": (6, 0, 0),
    "kn_l": (6, 0, 0),
}
W = sk.solve(pose)
B = build_character(cls, W, {"wrot": (60, 0, 0)})
tiles = []
for yaw in (0, 35, 60, 90, 180):
    t0 = time.time()
    img, info = render_sprite(B.prims, B.mats, 128, 128, (0, 0, 0), (64, 120), yaw=yaw, pitch=10, scale=0.75)
    img = paint_eyes(img, info, W, (0, 0, 0), (64, 120), yaw, 10, cls.eye, scale=0.75)
    print(yaw, time.time() - t0)
    tiles.append(to_u8(img))
sheet = np.concatenate(tiles, axis=1)
im = Image.fromarray(sheet, "RGBA")
bg = Image.new("RGBA", im.size, (90, 110, 90, 255))
bg.alpha_composite(im)
bg = bg.resize((im.width * 4, im.height * 4), Image.NEAREST)
bg.save(OUT)
