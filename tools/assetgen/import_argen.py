"""Import refs/argen_sheet.webp (character sheet with sprite rows + expressions)
into the 'argen' party slot.  Reuses the helpers from import_sheet.py.

usage: python3 import_argen.py [--preview]
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

from import_sheet import outline, place, punch, quantize_all, transform

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, "refs", "argen_sheet.webp")
OUT_SPR = os.path.join(ROOT, "public", "assets", "sprites")
OUT_POR = os.path.join(ROOT, "public", "assets", "portraits")
NAME = "argen"
TARGET_H = 110
REF_H = 89  # standing height of the idle sprites in the sheet

# (x0, y0, x1, y1) in sheet pixels, generous boxes around each sprite
FRAMES = {
    **{f"idle{i}": (x - 4, 490, x + 48, 592) for i, x in enumerate([372, 441, 516, 588, 652, 713])},
    **{f"walk{i}": (x - 4, 490, x + 58, 592) for i, x in enumerate([829, 892, 960, 1029, 1091, 1167, 1236])},
    **{f"run{i}": (x - 4, 645, x + 62, 746) for i, x in enumerate([360, 432, 508, 578, 650, 714])},
    "atk0": (817, 650, 925, 746),
    "atk1": (929, 650, 990, 746),
    "atk2": (994, 650, 1118, 746),
    "atk3": (1110, 645, 1200, 748),
    "atk4": (1226, 645, 1318, 746),
    "skl0": (354, 795, 488, 925),
    "skl1": (464, 793, 597, 927),
    "skl2": (608, 800, 730, 923),
    "skl3": (724, 805, 874, 927),
    "hurt0": (910, 826, 971, 923),
    "hurt1": (971, 840, 1031, 923),
    "hurt2": (1031, 850, 1093, 923),
    "dead0": (1133, 840, 1199, 925),
    "dead1": (1210, 880, 1331, 924),
}
# expression panels -> portrait expressions
FACES = {
    "normal": (1097, 48, 1217, 214),
    "angry": (1232, 48, 1352, 214),
    "surprised": (1365, 48, 1485, 214),
    "smile": (1097, 222, 1217, 390),
    "sad": (1365, 222, 1485, 390),
}


def cut(src, box, median=61, thr=28):
    x0, y0, x1, y1 = box
    pad = 40
    X0, Y0 = max(0, x0 - pad), max(0, y0 - pad)
    reg = src[Y0 : y1 + pad, X0 : x1 + pad].astype(float)
    # background estimate: median on a 1/8 downsample, upsampled back (fast)
    f = 8
    sm = reg[::f, ::f]
    bgs = np.stack([ndi.median_filter(sm[..., c], size=max(3, median // f)) for c in range(3)], -1)
    bg = np.repeat(np.repeat(bgs, f, 0), f, 1)[: reg.shape[0], : reg.shape[1]]
    bg = ndi.uniform_filter(bg, size=(f, f, 1))
    m = np.abs(reg - bg).sum(-1) > thr
    m = ndi.binary_closing(m, iterations=2)
    m = ndi.binary_fill_holes(m)
    oy, ox = y0 - Y0, x0 - X0
    m = m[oy : oy + (y1 - y0), ox : ox + (x1 - x0)]
    rgb = reg[oy : oy + (y1 - y0), ox : ox + (x1 - x0)]
    lab, n = ndi.label(m)
    if n:
        sizes = ndi.sum(m, lab, range(1, n + 1))
        big = max(sizes)
        m = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > big * 0.12])
    return np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), (m * 255).astype(np.uint8)])


def rescale(rgba, k):
    """premultiplied resize (up or down) followed by a hard alpha cut"""
    H, W = rgba.shape[:2]
    w, h = max(1, round(W * k)), max(1, round(H * k))
    a = rgba[..., 3:4].astype(float) / 255
    pre = np.dstack([rgba[..., :3] * a, a * 255]).astype(np.uint8)
    flt = Image.BOX if k < 1 else Image.LANCZOS
    sm = np.asarray(Image.fromarray(pre, "RGBA").resize((w, h), flt)).astype(float)
    al = np.clip(sm[..., 3] / 255, 0, 1)
    rgb = np.where(al[..., None] > 0.02, sm[..., :3] / np.maximum(al[..., None], 1e-6), 0)
    return np.dstack([np.clip(rgb, 0, 255), (al > 0.5) * 255]).astype(np.uint8)


def trim(f):
    ys, xs = np.where(f[..., 3] > 0)
    return f[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]


def portrait(src, box):
    x0, y0, x1, y1 = box
    rgb = src[y0:y1, x0:x1].astype(float)
    H, W = rgb.shape[:2]
    edge = np.concatenate([rgb[:3].reshape(-1, 3), rgb[:, :3].reshape(-1, 3), rgb[:, -3:].reshape(-1, 3)])
    bgc = np.median(edge, 0)
    near = np.abs(rgb - bgc).sum(-1) < 48
    lab, n = ndi.label(near)
    border = set(np.unique(np.concatenate([lab[0], lab[:, 0], lab[:, -1]]))) - {0}
    bgm = np.isin(lab, list(border))
    bgm = ndi.binary_opening(bgm, iterations=1)
    alpha = ndi.gaussian_filter((~bgm).astype(float), 0.8)
    f = np.dstack([rgb.astype(np.uint8), (np.clip(alpha * 1.4 - 0.2, 0, 1) * 255).astype(np.uint8)])
    k = 124 / W
    im = Image.fromarray(f, "RGBA").resize((round(W * k), round(H * k)), Image.LANCZOS)
    can = Image.new("RGBA", (200, 200))
    can.alpha_composite(im, ((200 - im.width) // 2, 28))
    a = np.asarray(can).copy()
    fade = np.clip((200 - 4 - np.arange(200)) / 36.0, 0, 1)[:, None]
    a[..., 3] = (a[..., 3] * fade).astype(np.uint8)
    return a


def main(preview=False):
    src = np.asarray(Image.open(SRC).convert("RGB"))
    k = TARGET_H / REF_H
    small = {n: outline(rescale(trim(cut(src, b)), k)) for n, b in FRAMES.items()}
    small = {n: punch(f, contrast=1.06, sat=1.05) for n, f in small.items()}
    small = quantize_all(small)
    small = {n: f[:, ::-1].copy() for n, f in small.items()}  # sheet faces right -> face left

    BW, BH, BAX, BAY = 232, 168, 132, 160
    P = lambda n, **kw: place(small[n], BW, BH, BAX, BAY, **kw)
    stance = P("atk1")
    anims = {}
    anims["battle.idle"] = ([P(f"idle{i}") for i in range(6)], 6, True)
    anims["battle.attack"] = ([P("atk0"), P("atk1"), P("atk2", dx=-6), P("atk3", dx=-6), P("atk4", dx=-4), stance], 12, False)
    anims["battle.skill"] = ([P("skl0"), P("skl1", dx=-4), P("skl2", dx=-6), P("skl3", dx=-6), stance], 10, False)
    anims["battle.cast"] = ([P("idle0"), P("idle1"), P("idle2"), P("idle3")], 8, False)
    anims["battle.hurt"] = ([P("hurt1"), P("hurt0")], 8, False)
    anims["battle.guard"] = ([P("hurt0")], 1, True)
    anims["battle.weak"] = ([P("hurt2")], 1, True)
    anims["battle.ko"] = ([P("dead1")], 1, True)
    anims["battle.win"] = ([P("idle0"), transform(P("idle0"), BAX, BAY, sy=0.99)], 3, True)
    anims["battle.run"] = ([P(f"run{i}") for i in range(6)], 14, True)

    FW, FH, FAX, FAY = 168, 140, 84, 132
    F = lambda n: place(small[n], FW, FH, FAX, FAY)
    idles = [F(f"idle{i}") for i in range(6)]
    walks = [F(f"walk{i}") for i in range(7)]
    for view in ("down", "up", "left"):
        anims[f"{view}.idle"] = (idles[:2], 2, True)
        anims[f"{view}.walk"] = (walks, 10, True)

    rows = list(anims.items())
    width = max(sum(f.shape[1] for f in fr) for _, (fr, _, _) in rows)
    height = sum(max(f.shape[0] for f in fr) for _, (fr, _, _) in rows)
    atlas = np.zeros((height, width, 4), dtype=np.uint8)
    meta = {"image": NAME + ".png", "scale": 0.75, "anims": {}, "imported": True}
    y = 0
    for key, (fr, fps, loop) in rows:
        x = 0
        rects = []
        for f in fr:
            atlas[y : y + f.shape[0], x : x + f.shape[1]] = f
            rects.append([x, y, f.shape[1], f.shape[0]])
            x += f.shape[1]
        ax, ay = (BAX, BAY) if key.startswith("battle") else (FAX, FAY)
        meta["anims"][key] = {"frames": rects, "fps": fps, "loop": loop, "ax": ax, "ay": ay}
        y += max(f.shape[0] for f in fr)
    Image.fromarray(atlas, "RGBA").save(os.path.join(OUT_SPR, NAME + ".png"), optimize=True)
    json.dump(meta, open(os.path.join(OUT_SPR, NAME + ".json"), "w"))

    for expr, box in FACES.items():
        Image.fromarray(portrait(src, box), "RGBA").save(os.path.join(OUT_POR, f"{NAME}_{expr}.png"))
    print(f"{NAME}: {sum(len(v[0]) for v in anims.values())} frames, atlas {width}x{height}")

    if preview:
        d = os.environ.get("PREVIEW_DIR", "/tmp")
        prev = Image.new("RGBA", (width, height), (40, 120, 70, 255))
        prev.alpha_composite(Image.fromarray(atlas, "RGBA"))
        prev.save(os.path.join(d, "argen_atlas.png"))
        ps = Image.new("RGBA", (200 * len(FACES), 200), (40, 50, 80, 255))
        for i, e in enumerate(FACES):
            ps.alpha_composite(Image.open(os.path.join(OUT_POR, f"{NAME}_{e}.png")), (i * 200, 0))
        ps.save(os.path.join(d, "argen_portraits.png"))


if __name__ == "__main__":
    main("--preview" in sys.argv)
