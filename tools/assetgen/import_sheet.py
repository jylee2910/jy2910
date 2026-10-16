"""Import a hand-made (or externally drawn) sprite sheet as a game character.

Currently configured for refs/nell_sheet.webp -> the 'nell' party slot:
  - cuts frames out of a flat grey background
  - erases baked-in effects (slash trails, dust, chain swirl, watermark)
  - normalises every frame to one global scale (target height in px)
  - re-pixelates: area downscale, hard alpha, shared adaptive palette
  - flips to face left (battle convention), aligns feet on a common baseline
  - synthesises the poses the sheet lacks (hurt, weak, KO, breathing idle)
  - writes public/assets/sprites/nell.png/.json and dialogue portraits

usage: python3 import_sheet.py [--preview]
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, "refs", "nell_sheet.webp")
OUT_SPR = os.path.join(ROOT, "public", "assets", "sprites")
OUT_POR = os.path.join(ROOT, "public", "assets", "portraits")
NAME = "nell"
TARGET_H = 110  # standing height in sprite pixels
REF_H = 240  # standing height (idle frames) in the source sheet
BG = np.array([69, 73, 77])
PALETTE = 48

# frame bounding boxes in the source sheet: name -> (x0, y0, x1, y1)
FRAMES = {
    "idle0": (323, 58, 450, 298),
    "idle1": (465, 58, 571, 296),
    "idle2": (581, 57, 711, 296),
    "atk0": (315, 368, 559, 592),
    "atk1": (554, 355, 699, 600),
    "kick0": (24, 709, 261, 982),
    "kick1": (288, 677, 520, 985),
    "run0": (29, 1054, 159, 1261),
    "run1": (189, 1046, 341, 1257),
    "run2": (360, 1056, 524, 1262),
    "run3": (544, 1054, 696, 1258),
    "run4": (17, 1281, 173, 1488),
    "run5": (197, 1281, 344, 1484),
    "run6": (370, 1277, 519, 1484),
    "run7": (541, 1281, 701, 1483),
}


def hsv(rgb):
    r, g, b = [rgb[..., i] / 255.0 for i in range(3)]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    return sat, mx * 255


def cut(src, name):
    x0, y0, x1, y1 = FRAMES[name]
    rgb = src[y0:y1, x0:x1].astype(int)
    fg = np.abs(rgb - BG).sum(-1) > 22
    lab, n = ndi.label(fg)
    sizes = ndi.sum(fg, lab, range(1, n + 1))
    keep = np.zeros_like(fg)
    for i, s in enumerate(sizes):
        if s > 60:
            keep |= lab == i + 1
    sat, val = hsv(rgb)
    H, W = keep.shape
    yy, xx = np.mgrid[0:H, 0:W]
    # ------------------------------------------------ per-frame effect removal
    if name == "atk0":
        # dark slash trail to the right of the body, keep the punching arm
        arm = (xx >= 126) & (xx <= 216) & (yy >= 46) & (yy <= 72)
        keep &= ~((xx >= 126) & (yy < 128) & ~arm)
        keep &= ~((xx >= 196) & (yy >= 128))
    if name == "kick1":
        keep &= ~((xx >= 165) & (yy < 175) & (sat < 0.16) & (val > 75))  # white kick trail
        keep &= ~((yy >= 232) & (xx >= 108))  # dust cloud
        keep &= ~((yy >= 232) & (sat < 0.22) & (val > 70))
    if name == "atk1":
        keep &= ~(xx < 12)  # tail of the neighbouring frame's slash trail
    if name in ("run2", "run4"):
        keep &= ~((yy >= H - 22) & (sat < 0.4) & (val > 70))  # dust puffs
    if name == "run7":
        keep &= ~((xx < 48) & (yy > 55) & (yy < 115) & (sat < 0.2) & (val > 60))  # watermark
    # drop specks left behind by the erasure
    lab, n = ndi.label(keep)
    if n:
        sizes = ndi.sum(keep, lab, range(1, n + 1))
        big = max(sizes)
        keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > 40 or s > big * 0.02])
    rgba = np.dstack([rgb.astype(np.uint8), (keep * 255).astype(np.uint8)])
    return rgba


def downscale(rgba, k):
    """area-average downscale with premultiplied alpha, then hard alpha"""
    im = Image.fromarray(rgba, "RGBA")
    W, H = im.size
    w, h = max(1, round(W * k)), max(1, round(H * k))
    a = rgba[..., 3:4].astype(float) / 255
    pre = np.dstack([rgba[..., :3] * a, a * 255]).astype(np.uint8)
    small = np.asarray(Image.fromarray(pre, "RGBA").resize((w, h), Image.BOX)).astype(float)
    al = small[..., 3] / 255
    rgb = np.where(al[..., None] > 0, small[..., :3] / np.maximum(al[..., None], 1e-6), 0)
    out = np.dstack([np.clip(rgb, 0, 255), (al > 0.45) * 255]).astype(np.uint8)
    return out


def outline(rgba):
    """1px dark selective outline (pixel-art finish, matches the rest of the cast)"""
    a = rgba[..., 3] > 0
    pad = np.pad(a, 1)
    nb = np.zeros_like(a)
    col = np.zeros(rgba.shape[:2] + (3,), dtype=float)
    cnt = np.zeros(a.shape)
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        s = pad[1 + dy : 1 + dy + a.shape[0], 1 + dx : 1 + dx + a.shape[1]]
        sh = np.roll(np.roll(rgba[..., :3].astype(float), -dy, 0), -dx, 1)
        m = s & ~a
        col[m] += sh[m]
        cnt[m] += 1
        nb |= m
    out = rgba.copy()
    c = col / np.maximum(cnt[..., None], 1)
    out[nb, :3] = (c[nb] * 0.35 + np.array([8, 4, 10]) * 0.65).astype(np.uint8)
    out[nb, 3] = 255
    return out


def punch(f, contrast=1.12, sat=1.1):
    out = f.copy().astype(float)
    m = out[..., 3] > 0
    c = out[m, :3]
    lum = c @ np.array([0.299, 0.587, 0.114])
    c = lum[:, None] + (c - lum[:, None]) * sat
    c = (c - 110) * contrast + 110
    out[m, :3] = np.clip(c, 0, 255)
    return out.astype(np.uint8)


def quantize_all(frames):
    """one adaptive palette shared by every frame -> consistent pixel colours"""
    opaque = np.concatenate([f[f[..., 3] > 0][:, :3] for f in frames.values()])
    strip = Image.fromarray(opaque.reshape(1, -1, 3), "RGB")
    pal_img = strip.quantize(colors=PALETTE, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    out = {}
    for k, f in frames.items():
        q = Image.fromarray(f[..., :3], "RGB").quantize(palette=pal_img, dither=Image.Dither.NONE).convert("RGB")
        g = np.dstack([np.asarray(q), f[..., 3]])
        g[g[..., 3] == 0] = 0
        out[k] = g
    return out


def baseline_info(f):
    a = f[..., 3] > 0
    ys, xs = np.where(a)
    bottom = ys.max()
    # horizontal anchor: centre of the torso band (35-60% of the figure from the top)
    top = ys.min()
    band = (ys > top + (bottom - top) * 0.35) & (ys < top + (bottom - top) * 0.6)
    cx = int(np.median(xs[band])) if band.any() else int(np.median(xs))
    return bottom, cx


def place(f, W, H, ax, ay, dx=0, dy=0):
    """put a frame on a W x H canvas so its feet sit at (ax, ay)"""
    bottom, cx = baseline_info(f)
    can = np.zeros((H, W, 4), dtype=np.uint8)
    ox = ax - cx + dx
    oy = ay - bottom + dy
    h, w = f.shape[:2]
    sx0, sy0 = max(0, -ox), max(0, -oy)
    tx0, ty0 = max(0, ox), max(0, oy)
    tw, th = min(w - sx0, W - tx0), min(h - sy0, H - ty0)
    if tw > 0 and th > 0:
        can[ty0 : ty0 + th, tx0 : tx0 + tw] = f[sy0 : sy0 + th, sx0 : sx0 + tw]
    return can


def transform(can, ax, ay, rot=0.0, sy=1.0, dx=0, dy=0):
    """rotate (degrees, about the feet) / squash vertically, nearest-neighbour"""
    im = Image.fromarray(can, "RGBA")
    if sy != 1.0:
        H = can.shape[0]
        im2 = im.resize((can.shape[1], max(1, round(H * sy))), Image.NEAREST)
        base = Image.new("RGBA", im.size)
        base.alpha_composite(im2, (0, round(ay - ay * sy)))
        im = base
    if rot:
        im = im.rotate(rot, resample=Image.NEAREST, center=(ax, ay))
    if dx or dy:
        base = Image.new("RGBA", im.size)
        base.alpha_composite(im, (dx, dy)) if dx >= 0 and dy >= 0 else base.paste(im, (dx, dy))
        im = base
    return np.asarray(im).copy()


def tint(can, col, k):
    out = can.copy().astype(float)
    m = out[..., 3] > 0
    out[m, :3] = out[m, :3] * (1 - k) + np.array(col) * k
    return out.astype(np.uint8)


def main(preview=False):
    src = np.asarray(Image.open(SRC).convert("RGB"))
    k = TARGET_H / REF_H
    raw = {n: cut(src, n) for n in FRAMES}
    small = {n: outline(downscale(f, k)) for n, f in raw.items()}
    small = {n: punch(f) for n, f in small.items()}
    small = quantize_all(small)
    # sheet faces right; battle / field-left views face left
    small = {n: f[:, ::-1].copy() for n, f in small.items()}

    BW, BH, BAX, BAY = 232, 168, 132, 160  # battle canvas
    P = lambda n, **kw: place(small[n], BW, BH, BAX, BAY, **kw)
    idle = P("idle0")
    stance = P("atk1")
    anims = {}
    # breathing idle: tiny vertical squash
    anims["battle.idle"] = ([transform(idle, BAX, BAY, sy=s) for s in (1.0, 0.99, 0.982, 0.99)], 5, True)
    anims["battle.attack"] = ([stance, P("atk0", dx=-6), P("atk0", dx=-8), P("atk0", dx=-8), stance, stance], 14, False)
    anims["battle.skill"] = ([stance, P("kick0", dx=-4), P("kick1", dx=-8), P("kick1", dx=-8), P("kick0", dx=-4), stance], 12, False)
    anims["battle.cast"] = ([P("idle1"), P("idle2"), P("idle2"), P("idle2")], 8, False)
    anims["battle.hurt"] = ([transform(stance, BAX, BAY, rot=-9, dx=4), transform(stance, BAX, BAY, rot=-5, dx=2)], 8, False)
    anims["battle.guard"] = ([transform(stance, BAX, BAY, sy=0.96)], 1, True)
    anims["battle.weak"] = ([transform(transform(stance, BAX, BAY, sy=0.86), BAX, BAY, rot=7)], 1, True)
    anims["battle.ko"] = ([transform(P("idle0", dx=-58), BAX - 58, BAY, rot=-88, dy=-2)], 1, True)
    anims["battle.win"] = ([P("idle2"), transform(P("idle2"), BAX, BAY, sy=0.99)], 3, True)
    runs = [P(f"run{i}") for i in range(8)]
    anims["battle.run"] = (runs, 14, True)

    FW, FH, FAX, FAY = 168, 140, 84, 132  # field canvas
    F = lambda n: place(small[n], FW, FH, FAX, FAY)
    fidle = F("idle0")
    fruns = [F(f"run{i}") for i in range(8)]
    for view in ("down", "up", "left"):
        anims[f"{view}.idle"] = ([fidle, transform(fidle, FAX, FAY, sy=0.99)], 2, True)
        anims[f"{view}.walk"] = (fruns, 12, True)

    # pack: one row per animation
    rows = list(anims.items())
    width = max(sum(f.shape[1] for f in fr) for _, (fr, _, _) in rows)
    height = sum(max(f.shape[0] for f in fr) for _, (fr, _, _) in rows)
    atlas = np.zeros((height, width, 4), dtype=np.uint8)
    meta = {"image": NAME + ".png", "scale": 0.75, "anims": {}, "imported": True}
    y = 0
    for key, (fr, fps, loop) in rows:
        x = 0
        h = max(f.shape[0] for f in fr)
        rects = []
        for f in fr:
            atlas[y : y + f.shape[0], x : x + f.shape[1]] = f
            rects.append([x, y, f.shape[1], f.shape[0]])
            x += f.shape[1]
        ax, ay = (BAX, BAY) if key.startswith("battle") else (FAX, FAY)
        meta["anims"][key] = {"frames": rects, "fps": fps, "loop": loop, "ax": ax, "ay": ay}
        y += h
    os.makedirs(OUT_SPR, exist_ok=True)
    Image.fromarray(atlas, "RGBA").save(os.path.join(OUT_SPR, NAME + ".png"), optimize=True)
    json.dump(meta, open(os.path.join(OUT_SPR, NAME + ".json"), "w"))

    # portrait: bust from the full-resolution idle frame (pixel look kept)
    bust = raw["idle0"][:, ::-1]
    a = bust[..., 3] > 0
    ys, xs = np.where(a)
    top = ys.min()
    head = bust[top : top + 118]
    cx = int(np.median(np.where(head[..., 3] > 0)[1]))
    crop = np.zeros((118, 118, 4), dtype=np.uint8)
    x0 = cx - 59
    for xx in range(118):
        sx = x0 + xx
        if 0 <= sx < head.shape[1]:
            crop[: head.shape[0], xx] = head[:, sx]
    por = Image.fromarray(crop, "RGBA").resize((200, 200), Image.NEAREST)
    pa = np.asarray(por).copy()
    fade = np.clip((200 - 6 - np.arange(200)) / 40.0, 0, 1)[:, None]
    pa[..., 3] = (pa[..., 3] * fade).astype(np.uint8)
    os.makedirs(OUT_POR, exist_ok=True)
    for expr in ("normal", "smile", "angry", "sad", "surprised"):
        Image.fromarray(pa, "RGBA").save(os.path.join(OUT_POR, f"{NAME}_{expr}.png"))
    print(f"{NAME}: {sum(len(v[0]) for v in anims.values())} frames, atlas {width}x{height}")

    if preview:
        prev = Image.new("RGBA", (width, height), (40, 120, 70, 255))
        prev.alpha_composite(Image.fromarray(atlas, "RGBA"))
        prev.resize((width * 2, height * 2), Image.NEAREST).save(os.path.join(os.environ.get("PREVIEW_DIR", "/tmp"), "import_preview.png"))


if __name__ == "__main__":
    main("--preview" in sys.argv)
