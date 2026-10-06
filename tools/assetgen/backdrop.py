"""Painted pixel backdrop strips for battle / title skies (transparent above
the silhouette).  -> public/assets/tex/bg_*.png"""
import os

import numpy as np
from PIL import Image

from sdf import hex2rgb
from textures import BAYER, fbm, norm, pnoise

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "assets", "tex")


def R(*h):
    return np.array([hex2rgb(x) for x in h])


def ridge(w, base, amp, seed, cells=6, oct=5):
    # periodic 1D fbm via a 2D noise row
    n = np.zeros(w)
    a = 1.0
    c = cells
    tot = 0
    for o in range(oct):
        row = pnoise(w, c, seed + o * 7)[w // 3]
        n += row * a
        tot += a
        a *= 0.5
        c *= 2
    n /= tot
    rid = 1 - np.abs(n * 2 - 1)
    return base - (rid ** 1.4) * amp * 0.85 + amp * 0.3


def mountains(name, w=1024, h=256, layers=None, snow=True, seed=1):
    img = np.zeros((h, w, 4))
    layers = layers or [
        (0.55, 150, R("#5a6c9a", "#7486b2", "#93a6cc", "#b8c8e4", "#e2ecf8"), 0.0),
        (0.70, 120, R("#3e4e7a", "#56689a", "#7488b8", "#9aaed2", "#c4d4ec"), 0.2),
        (0.86, 80, R("#2a3a5a", "#3a4e74", "#4e6890", "#6a86aa", "#90a8c6"), 0.4),
    ]
    yy, xx = np.mgrid[0:h, 0:w]
    for li, (base, amp, ramp, fogk) in enumerate(layers):
        top = ridge(w, base * h, amp, seed + li * 31)
        nz = fbm(w, 16, seed + li, 4)[:h] if h <= w else None
        mask = yy >= top[None, :]
        # lighting from the left: compare slope
        slope = np.convolve(np.gradient(top), np.ones(5) / 5, mode="same")
        face = np.clip(-slope * 0.6, -1, 1)
        nz2 = fbm(w, 24, seed + li * 3, 4)[:h, :]
        lit = np.clip(0.5 + face[None, :] * 0.35 * np.exp(-(yy - top[None, :]) / 60.0) + (nz2 - 0.5) * 0.55, 0, 1)
        depth = np.clip((yy - top[None, :]) / (h * 0.5), 0, 1)
        v = lit * (1 - depth * 0.6)
        b = np.tile(BAYER, (h // 4 + 1, w // 4 + 1))[:h, :w]
        v = np.clip(v + b * 0.12, 0, 0.999)
        col = ramp[(v * len(ramp)).astype(int)]
        if snow and li == 0:
            snowline = (yy - top[None, :]) < (12 + (fbm(w, 24, 9, 3)[:h] * 22))
            col = np.where((snowline & (v > 0.35))[..., None], R("#e8f0fa")[0], col)
            col = np.where((snowline & (v <= 0.35))[..., None], R("#a8b8d8")[0], col)
        img[mask] = np.dstack([col, np.ones((h, w))])[mask]
    Image.fromarray((img * 255).astype(np.uint8), "RGBA").save(os.path.join(OUT, name + ".png"))


def treeline(name, w=1024, h=192, seed=4, ramp=None):
    ramp = ramp if ramp is not None else R("#0e2418", "#163420", "#1f4628", "#2c5c30", "#3c743a", "#4e8a44")
    img = np.zeros((h, w, 4))
    yy, xx = np.mgrid[0:h, 0:w]
    rng = np.random.default_rng(seed)
    hgt = np.full(w, h * 0.75)
    # crowns: overlapping circles
    lit = np.zeros((h, w))
    mask = np.zeros((h, w), dtype=bool)
    for k in range(260):
        cx = rng.uniform(0, w)
        cy = rng.uniform(h * 0.25, h * 0.6)
        r = rng.uniform(14, 30)
        for ox in (-w, 0, w):
            d = np.sqrt((xx - cx - ox) ** 2 + (yy - cy) ** 2)
            m = d < r
            l = np.clip(1 - ((xx - cx - ox + r * 0.4) ** 2 + (yy - cy + r * 0.5) ** 2) / (r * r * 1.6), 0, 1)
            lit = np.where(m & ~mask, l, np.where(m, np.maximum(lit * 0.9, l * 0.8), lit))
            mask |= m
    mask |= yy > h * 0.55
    nz = fbm(w, 32, seed, 3)[:h]
    v = np.clip(lit * 0.75 + (nz - 0.5) * 0.4 + 0.1, 0, 0.999)
    b = np.tile(BAYER, (h // 4 + 1, w // 4 + 1))[:h, :w]
    v = np.clip(v + b * 0.15, 0, 0.999)
    col = ramp[(v * len(ramp)).astype(int)]
    img[mask] = np.dstack([col, np.ones((h, w))])[mask]
    Image.fromarray((img * 255).astype(np.uint8), "RGBA").save(os.path.join(OUT, name + ".png"))


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    mountains("bg_mountains")
    mountains(
        "bg_mountains_dusk",
        layers=[
            (0.55, 150, R("#6a4a7a", "#8a5a86", "#b0708e", "#d8909a", "#f6c0a8"), 0.0),
            (0.70, 120, R("#3e2e5a", "#54406e", "#6e5484", "#8a6a98", "#a888b0"), 0.2),
            (0.86, 80, R("#221a36", "#302448", "#40305a", "#52406c", "#685482"), 0.4),
        ],
        seed=5,
    )
    treeline("bg_trees")
    treeline("bg_trees_far", ramp=R("#2a4a5a", "#36586a", "#44687a", "#567a8a", "#6a8e9c", "#80a2ae"), seed=8)
    print("backdrops done")
