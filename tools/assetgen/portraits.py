"""Dialogue portraits: high-detail busts rendered from the same SDF models,
with hand-styled anime eyes / brows / mouth painted on top.
-> public/assets/portraits/<name>_<expr>.png"""
import os
import sys
from multiprocessing import Pool

import numpy as np
from PIL import Image

from characters import CAST, build_character
from rig import Skeleton
from sdf import camera_basis, project, render_sprite, to_u8

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "assets", "portraits")
SC = 0.19
W, H = 200, 200
YAW = 24
PITCH = 3

POSE = {
    "sh_l": (2, 0, 8), "el_l": (-10, 0, 0), "sh_r": (2, 0, -8), "el_r": (-10, 0, 0),
    "show_weapon": False, "sheathed": True, "scarf": 0.25,
}

EXPR = {
    "normal": dict(brow=0, mouth="line", lid=0),
    "smile": dict(brow=0.5, mouth="smile", lid=0.25),
    "angry": dict(brow=-1, mouth="frown", lid=0.2),
    "sad": dict(brow=1.2, mouth="frown", lid=0.35),
    "surprised": dict(brow=1.5, mouth="o", lid=-0.2),
}


def put(img, y, x, c, a=1.0):
    if 0 <= y < img.shape[0] and 0 <= x < img.shape[1] and img[y, x, 3] > 0:
        img[y, x, :3] = img[y, x, :3] * (1 - a) + np.asarray(c) * a


def paint_face(img, info, Wj, cls, anchor_world, anchor_px, expr, mats):
    right, up, fwd = camera_basis(YAW, PITCH)
    h = Wj["head"]
    view = -fwd
    eye_r = cls.eye
    style = cls.eye_style
    skin = mats[0].ramp  # std skin is material 0
    hair = None
    for m in mats:
        pass
    lash = np.array([0.12, 0.06, 0.1])
    e = EXPR[expr]
    head_right = h.R @ np.array([1.0, 0, 0])
    big = style == "big"
    narrow = style == "narrow"
    ey = getattr(cls, "eye_pos", {}).get("ey", 5.0)
    for sx in (-1, 1):
        pt = h.apply(np.array([sx * 2.75, ey, 6.75]))
        nrm = h.R @ np.array([sx * 0.4, 0.05, 0.92])
        nrm /= np.linalg.norm(nrm)
        facing = float(nrm @ view)
        if facing < 0.15:
            continue
        x, y, z = project(pt, anchor_world, anchor_px, YAW, PITCH, SC)
        cx, cy = int(round(x)), int(round(y))
        f = max(0.45, min(1.0, facing))
        rx = (3.4 if big else 3.0 if not narrow else 3.2) * f
        ry = 5.2 if big else 4.2 if not narrow else 3.0
        outer = 1 if (head_right @ right) * sx > 0 else -1
        lid = e["lid"]
        # sclera + iris
        for yy in range(int(cy - ry - 1), int(cy + ry + 2)):
            for xx in range(int(cx - rx - 3), int(cx + rx + 4)):
                dx = (xx - cx) / (rx + 1.6)
                dy = (yy - cy) / (ry + 0.6)
                if dx * dx + dy * dy <= 1.0 and (yy - cy) > -ry + lid * ry * 1.2:
                    put(img, yy, xx, (0.97, 0.97, 1.0))
                ix = (xx - cx) / rx
                iy = (yy - cy) / ry
                if ix * ix + iy * iy <= 1.0 and (yy - cy) > -ry + lid * ry * 1.2:
                    t = (yy - (cy - ry)) / (2 * ry)
                    k = 0 if t < 0.35 else 1 if t < 0.7 else 2
                    put(img, yy, xx, eye_r[k])
                    # pupil
                    if (ix * ix * 2.2 + (iy + 0.1) ** 2 * 1.6) < 0.35:
                        put(img, yy, xx, eye_r[0] * 0.45)
        # highlights
        put(img, int(cy - ry * 0.45), cx - outer, (1, 1, 1))
        put(img, int(cy - ry * 0.45) + 1, cx - outer, (1, 1, 1))
        put(img, int(cy - ry * 0.45), cx - outer * 2, (1, 1, 1), 0.8)
        put(img, int(cy + ry * 0.45), cx + outer, (1, 1, 1), 0.7)
        # upper lash line (thick, flicks outward)
        top = cy - ry + lid * ry * 1.2
        for xx in range(int(cx - rx - 2), int(cx + rx + 3)):
            dx = (xx - cx) / (rx + 1.6)
            if abs(dx) > 1.15:
                continue
            yy = int(round(top - 0.5 + (dx * dx) * ry * 0.35 * (1 if not narrow else 0.6) - (dx * outer > 0.6) * 1.2))
            put(img, yy, xx, lash)
            put(img, yy - 1, xx, lash, 0.9 if big or abs(dx) < 0.8 else 0.5)
            if big and dx * outer > 0.7:
                put(img, yy - 2, xx + outer, lash, 0.8)
        # lower lid
        for xx in range(int(cx - rx * 0.6), int(cx + rx * 0.9 * (1 if outer > 0 else 0.6)) + 1):
            put(img, int(cy + ry + 1), xx, skin[1], 0.8)
        # brow
        by = cy - ry - 3 - (2 if big else 1) - e["brow"] * 1.5
        for k in range(-int(rx + 1), int(rx + 3)):
            xx = cx + k * outer
            tilt = (k / (rx + 2)) * (e["brow"] * -1.2 + (0.6 if narrow else 0.0))
            yy = int(round(by - tilt * 2 + (k / (rx + 2)) ** 2 * 1.5))
            put(img, yy, xx, lash * 1.5 + 0.05)
            if not big:
                put(img, yy + 1, xx, lash * 1.5 + 0.05, 0.7)
    # nose + mouth on the face centre line
    nose = h.apply(np.array([0.3, 3.3, 7.2]))
    x, y, z = project(nose, anchor_world, anchor_px, YAW, PITCH, SC)
    put(img, int(y), int(x), skin[1], 0.9)
    put(img, int(y) + 1, int(x) - 1, skin[1], 0.6)
    mouth = h.apply(np.array([0.2, 1.4, 6.9]))
    x, y, z = project(mouth, anchor_world, anchor_px, YAW, PITCH, SC)
    mx, my = int(x), int(y)
    mc = np.array([0.45, 0.16, 0.2])
    if e["mouth"] == "line":
        for k in range(-2, 2):
            put(img, my, mx + k, mc, 0.8)
    elif e["mouth"] == "smile":
        for k in range(-3, 3):
            put(img, my + (1 if abs(k) < 2 else 0), mx + k, mc, 0.9)
    elif e["mouth"] == "frown":
        for k in range(-2, 3):
            put(img, my - (1 if abs(k) < 2 else 0), mx + k, mc, 0.9)
    elif e["mouth"] == "o":
        for yy in range(-1, 2):
            for k in range(-1, 2):
                put(img, my + yy, mx + k, mc * (0.6 if yy == 0 and k == 0 else 1))
    # blush for "big" eyed characters
    if big:
        for sx in (-1, 1):
            p = h.apply(np.array([sx * 3.8, 2.6, 6.0]))
            x, y, z = project(p, anchor_world, anchor_px, YAW, PITCH, SC)
            for k in range(-2, 2):
                put(img, int(y), int(x) + k, (1.0, 0.55, 0.55), 0.35)
    return img


def render(args):
    name, expr = args
    cls = CAST[name]
    sk = Skeleton(overrides=getattr(cls, "skeleton", None), scale=getattr(cls, "skscale", 1.0))
    pose = dict(POSE)
    Wj = sk.solve(pose)
    B = build_character(cls, Wj, pose)
    anchor = Wj["head"].apply(np.array([0, 3.0, 0]))
    apx = (100, 118)
    img, info = render_sprite(B.prims, B.mats, W, H, anchor, apx, yaw=YAW, pitch=PITCH, scale=SC, depth_thresh=1.2, steps=110)
    img = paint_face(img, info, Wj, cls, anchor, apx, expr, B.mats)
    # fade the bottom (bust cut-off)
    fade = np.clip((H - 4 - np.arange(H)) / 34.0, 0, 1)[:, None]
    img[..., 3] *= fade
    return name, expr, to_u8(img)


if __name__ == "__main__":
    names = [a for a in sys.argv[1:] if not a.startswith("--")] or ["kael", "argen", "mira", "nell", "king", "soldier", "echo_paladin", "echo_saint", "echo_sage"]
    os.makedirs(OUT, exist_ok=True)
    jobs = [(n, e) for n in names for e in (EXPR if n in ("kael", "argen", "mira", "nell") else ["normal", "angry", "surprised"])]
    if "--quick" in sys.argv:
        jobs = [(n, "normal") for n in names]
    with Pool(4) as pool:
        res = pool.map(render, jobs)
    for n, e, im in res:
        Image.fromarray(im, "RGBA").save(os.path.join(OUT, f"{n}_{e}.png"))
    if "--preview" in sys.argv:
        ims = [r[2] for r in res]
        sheet = np.concatenate(ims, 1)
        bg = Image.new("RGBA", (sheet.shape[1], sheet.shape[0]), (40, 50, 80, 255))
        bg.alpha_composite(Image.fromarray(sheet, "RGBA"))
        bg.resize((bg.width * 2, bg.height * 2), Image.NEAREST).save("/tmp/claude-0/-home-user-jy2910/5a38f85b-c21f-5751-aafd-449cad322cff/scratchpad/portraits.png")
    print(len(res), "portraits")
