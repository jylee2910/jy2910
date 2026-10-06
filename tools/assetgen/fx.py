"""Pixel-art battle effect sheets -> public/assets/fx/fx.png + fx.json

Effects are drawn procedurally per frame on a float canvas (intensity), then
mapped through hue ramps (dark->white-hot) and quantised, so they read as
hand-made pixel FX and bloom nicely in the engine (additive blending)."""
import json
import math
import os

import numpy as np
from PIL import Image

from sdf import hex2rgb
from textures import fbm, norm

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "assets", "fx")
rng = np.random.default_rng(3)


def R(*h):
    return np.array([hex2rgb(x) for x in h])


RAMPS = {
    "white": R("#1a3a6a", "#3a7ac8", "#7ac4ff", "#c8f0ff", "#ffffff"),
    "fire": R("#5a0a00", "#b02a00", "#f06a00", "#ffb020", "#fff0a0", "#ffffff"),
    "ice": R("#0a2a5a", "#1a6ab0", "#4ab8f0", "#a0e8ff", "#ffffff"),
    "thunder": R("#2a1a6a", "#6a4ae0", "#b0a0ff", "#f0f0ff", "#ffffff"),
    "heal": R("#0a3a1a", "#1a8a3a", "#4ad06a", "#b0ffb0", "#ffffff"),
    "holy": R("#5a4010", "#c09030", "#ffe070", "#fff8c8", "#ffffff"),
    "dark": R("#1a0420", "#4a0a5a", "#8a20a0", "#d060e0", "#ffd0ff"),
    "gold": R("#4a2a00", "#a06a10", "#f0b030", "#ffe890", "#ffffff"),
    "smoke": R("#2a2a30", "#4a4a54", "#6e6e78", "#9a9aa4", "#c8c8d0"),
    "red": R("#3a0008", "#8a0a1a", "#e02030", "#ff7a6a", "#ffe0d0"),
}


def colorize(inten, ramp, alpha_floor=0.06):
    v = np.clip(inten, 0, 1)
    k = len(ramp)
    idx = np.clip((v * k).astype(int), 0, k - 1)
    rgb = ramp[idx]
    a = (v > alpha_floor).astype(float) * np.clip(v * 3, 0, 1)
    # quantise alpha to 3 levels for pixel look
    a = np.round(a * 3) / 3
    return np.dstack([rgb, a])


def grid(n):
    yy, xx = np.mgrid[0:n, 0:n].astype(float)
    return xx - n / 2 + 0.5, yy - n / 2 + 0.5


# --------------------------------------------------------------- effects


def slash(n=96, frames=6, cross=False):
    out = []
    X, Y = grid(n)
    for f in range(frames):
        t = (f + 1) / frames
        img = np.zeros((n, n))
        for k, ang0 in enumerate([0.0, math.pi / 2] if cross else [0.0]):
            # rotate coords
            c, s = math.cos(ang0 - 0.6), math.sin(ang0 - 0.6)
            x = X * c - Y * s
            y = X * s + Y * c
            r = np.sqrt(x * x + (y * 1.0) ** 2)
            a = np.arctan2(y, x)
            R0 = n * 0.36
            head = -2.4 + t * 4.2  # sweep angle
            tail = head - 1.8
            inside = (a < head) & (a > tail)
            along = np.clip((a - tail) / (head - tail), 0, 1)
            thick = 1 + 8 * along ** 1.5 * (1 - t * 0.6)
            band = np.exp(-((r - R0) ** 2) / (thick ** 2 + 1e-3))
            img += band * inside * (0.4 + 0.6 * along) * (1.15 - t * 0.5)
        out.append(colorize(img, RAMPS["white"]))
    return out


def hit(n=64, frames=5, ramp="white"):
    out = []
    X, Y = grid(n)
    r = np.sqrt(X * X + Y * Y)
    a = np.arctan2(Y, X)
    for f in range(frames):
        t = (f + 1) / frames
        star = np.abs(np.cos(a * 4)) ** 8 * np.exp(-r / (n * 0.35 * t + 1))
        ring = np.exp(-((r - n * 0.42 * t) ** 2) / 6.0) * (1 - t)
        core = np.exp(-r * r / (40 * (1 - t) + 1)) * (1 - t)
        img = star * 1.2 * (1 - t * 0.7) + ring + core * 1.3
        out.append(colorize(img, RAMPS[ramp]))
    return out


def fire(n=112, frames=8):
    out = []
    X, Y = grid(n)
    nz = fbm(n, 6, 11, 4)
    nz2 = fbm(n, 12, 12, 3)
    for f in range(frames):
        t = (f + 1) / frames
        cy = n * 0.15 - t * n * 0.12
        r = np.sqrt(X * X + ((Y - cy) * 1.15) ** 2)
        rad = n * (0.15 + 0.32 * t)
        sh = np.roll(nz, int(-t * n * 0.3), axis=0) * 0.6 + np.roll(nz2, int(-t * n * 0.5), axis=0) * 0.4
        body = np.clip(1 - r / (rad * (0.75 + sh * 0.6)), 0, 1)
        body = body ** 0.7 * (1.25 - t * 0.85)
        # tongues upward
        tongue = np.clip(1 - np.abs(X) / (n * 0.3), 0, 1) * np.clip(-(Y - cy) / (n * 0.45), 0, 1) * (sh > 0.55) * (1 - t) * 0.8
        out.append(colorize(body + tongue, RAMPS["fire"]))
    return out


def ice(n=112, frames=7):
    out = []
    X, Y = grid(n)
    shards = [(rng.uniform(-0.9, 0.9), rng.uniform(0.25, 0.5), rng.uniform(-0.5, 0.5)) for _ in range(9)]
    for f in range(frames):
        t = min(1, (f + 1) / (frames - 2))
        fade = 1 if f < frames - 2 else 1 - (f - frames + 3) / 3
        img = np.zeros((n, n))
        for ang, L, off in shards:
            ca, sa = math.cos(ang - math.pi / 2), math.sin(ang - math.pi / 2)
            x = X * ca + (Y - n * 0.32) * sa
            y = -X * sa + (Y - n * 0.32) * ca
            Ll = L * n * t
            w = 4.5 * (1 - np.clip(x / max(Ll, 1), 0, 1))
            inside = (x > 0) & (x < Ll) & (np.abs(y + off * 4) < w)
            facet = 0.55 + 0.45 * (y + off * 4 > 0)
            img = np.maximum(img, inside * facet)
        frost = np.exp(-(X * X + (Y - n * 0.32) ** 2 * 4) / (n * n * 0.03)) * t * 0.6
        out.append(colorize((img + frost) * fade, RAMPS["ice"]))
    return out


def thunder(n=128, frames=6):
    out = []
    for f in range(frames):
        img = np.zeros((n, n))
        r = np.random.default_rng(f * 7 + 1)
        for b in range(2 if f < 4 else 1):
            x = n / 2 + r.uniform(-6, 6)
            for y in range(n):
                x += r.uniform(-2.2, 2.2)
                xi = int(x)
                w = 2 if f < 3 else 1
                for dx in range(-w - 2, w + 3):
                    if 0 <= xi + dx < n:
                        d = abs(dx)
                        img[y, xi + dx] = max(img[y, xi + dx], 1.0 if d <= w else 0.45 / (d - w + 0.5))
                # branches
                if r.random() < 0.03:
                    bx = x
                    for yy in range(y, min(n, y + 18)):
                        bx += r.uniform(-1, 3)
                        if 0 <= int(bx) < n:
                            img[yy, int(bx)] = max(img[yy, int(bx)], 0.6)
        X, Y = grid(n)
        glow = np.exp(-(X * X) / 120.0) * 0.3 + np.exp(-(X * X + (Y - n * 0.45) ** 2) / 200.0) * 0.8
        k = 1.0 if f < 4 else 0.5
        out.append(colorize((img + glow) * k, RAMPS["thunder"]))
    return out


def sparkle_burst(n=96, frames=8, ramp="heal", rise=True, count=22):
    out = []
    r = np.random.default_rng(5)
    pts = [(r.uniform(-0.4, 0.4) * n, r.uniform(0.0, 0.45) * n, r.uniform(0.2, 1.0), r.uniform(0, 1)) for _ in range(count)]
    X, Y = grid(n)
    for f in range(frames):
        t = (f + 1) / frames
        img = np.zeros((n, n))
        for x0, y0, sp, ph in pts:
            life = (t + ph) % 1.0
            y = y0 - life * n * 0.5 * sp if rise else y0
            cx = int(n / 2 + x0)
            cy = int(n / 2 + y)
            b = math.sin(life * math.pi)
            if 2 <= cx < n - 2 and 2 <= cy < n - 2:
                img[cy, cx] = max(img[cy, cx], b)
                for d in (1, 2):
                    v = b * (0.7 if d == 1 else 0.35)
                    for dy, dx in ((0, d), (0, -d), (d, 0), (-d, 0)):
                        img[cy + dy, cx + dx] = max(img[cy + dy, cx + dx], v)
        ring = np.exp(-((np.sqrt(X * X + (Y * 2.5 - n * 0.6) ** 2) - n * 0.3 * t) ** 2) / 8) * (1 - t) * 0.8
        out.append(colorize(img + ring, RAMPS[ramp]))
    return out


def pillar(n=96, h=192, frames=6, ramp="holy"):
    out = []
    yy, xx = np.mgrid[0:h, 0:n].astype(float)
    X = xx - n / 2
    nz = fbm(n, 8, 21, 3)
    for f in range(frames):
        t = (f + 1) / frames
        w = n * (0.08 + 0.3 * math.sin(t * math.pi))
        beam = np.clip(1 - np.abs(X) / max(w, 1), 0, 1) ** 0.6
        streak = (np.tile(np.roll(nz, int(t * 40), 1)[:1, :], (h, 1)) > 0.55) * 0.35 * np.clip(1 - np.abs(X) / (w * 1.6 + 1), 0, 1)
        vert = np.clip(yy / h * 1.4, 0, 1)
        out.append(colorize((beam + streak) * vert * (1.2 - t * 0.4), RAMPS[ramp]))
    return out


def swirl(n=112, frames=8, ramp="dark"):
    out = []
    X, Y = grid(n)
    r = np.sqrt(X * X + Y * Y)
    a = np.arctan2(Y, X)
    for f in range(frames):
        t = (f + 1) / frames
        arms = np.cos(a * 3 + r * 0.18 - t * 9) * 0.5 + 0.5
        env = np.exp(-((r - n * 0.18 * (0.5 + t)) ** 2) / (n * 3.0)) * (1.2 - t * 0.8)
        core = np.exp(-r * r / (n * 2.0)) * (1 - t)
        out.append(colorize(arms ** 3 * env + core, RAMPS[ramp]))
    return out


def buff(n=80, frames=6, ramp="gold"):
    out = []
    X, Y = grid(n)
    for f in range(frames):
        t = (f + 1) / frames
        img = np.zeros((n, n))
        for k, ox in enumerate((-18, 0, 18)):
            cy = n * 0.25 - t * n * 0.45 + k * 6
            x = X - ox
            y = Y - cy
            chevron = (np.abs(y + np.abs(x) * 0.9) < 2.2) & (np.abs(x) < 8)
            img = np.maximum(img, chevron * (1 - t * 0.6))
        ring = np.exp(-((np.sqrt(X * X + (Y * 3 - n * 0.9) ** 2) - n * 0.35) ** 2) / 10) * (1 - t)
        out.append(colorize(img + ring * 0.7, RAMPS[ramp]))
    return out


def shatter(n=128, frames=8):
    out = []
    r = np.random.default_rng(9)
    sh = [(r.uniform(0, 2 * math.pi), r.uniform(0.3, 1.0), r.uniform(2, 5), r.uniform(-3, 3)) for _ in range(26)]
    X, Y = grid(n)
    for f in range(frames):
        t = (f + 1) / frames
        img = np.zeros((n, n))
        for ang, sp, sz, rot in sh:
            d = t * n * 0.45 * sp
            cx = math.cos(ang) * d
            cy = math.sin(ang) * d + t * t * 20
            ca, sa = math.cos(rot + t * 4), math.sin(rot + t * 4)
            x = (X - cx) * ca - (Y - cy) * sa
            y = (X - cx) * sa + (Y - cy) * ca
            tri = (y > -sz) & (y < sz) & (np.abs(x) < (sz - y) * 0.6)
            img = np.maximum(img, tri * (0.6 + 0.4 * (x > 0)) * (1.1 - t * 0.6))
        flash = np.exp(-(X * X + Y * Y) / (n * 6 * (1 - t) + 1)) * (1 - t) ** 2 * 1.5
        out.append(colorize(img + flash, RAMPS["gold"]))
    return out


def smoke(n=80, frames=6):
    out = []
    X, Y = grid(n)
    nz = fbm(n, 6, 31, 3)
    for f in range(frames):
        t = (f + 1) / frames
        r = np.sqrt(X * X + (Y + t * 10) ** 2)
        body = np.clip(1 - r / (n * (0.18 + 0.25 * t) * (0.7 + nz * 0.6)), 0, 1) * (1 - t) * 0.9
        out.append(colorize(body, RAMPS["smoke"]))
    return out


def magic_circle(n=192, ramp="white"):
    X, Y = grid(n)
    r = np.sqrt(X * X + Y * Y)
    a = np.arctan2(Y, X)
    R0 = n * 0.46
    img = np.zeros((n, n))
    for rr, w in ((R0, 1.6), (R0 * 0.9, 1.0), (R0 * 0.62, 1.2), (R0 * 0.55, 0.8)):
        img = np.maximum(img, np.exp(-((r - rr) ** 2) / w))
    # runes between the outer rings
    band = (r > R0 * 0.91) & (r < R0 * 0.99)
    rune = (np.sin(a * 48) > 0.2) & (np.sin(a * 6 + r * 0.5) > -0.3)
    img = np.maximum(img, band * rune * 0.8)
    # hexagram
    for k in range(6):
        th = k * math.pi / 3
        for th2 in (th, th + math.pi / 3 * 2):
            pass
    for k in range(2):
        pts = [(math.cos(k * math.pi / 3 + i * 2 * math.pi / 3 - math.pi / 2) * R0 * 0.62, math.sin(k * math.pi / 3 + i * 2 * math.pi / 3 - math.pi / 2) * R0 * 0.62) for i in range(3)]
        for i in range(3):
            (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % 3]
            dx, dy = x1 - x0, y1 - y0
            L2 = dx * dx + dy * dy
            tt = np.clip(((X - x0) * dx + (Y - y0) * dy) / L2, 0, 1)
            d = np.sqrt((X - x0 - dx * tt) ** 2 + (Y - y0 - dy * tt) ** 2)
            img = np.maximum(img, np.exp(-d * d / 1.0))
    img = np.maximum(img, np.exp(-r * r / 30) * 0.5)
    return colorize(img, RAMPS[ramp], 0.1)


def glow(n=64):
    X, Y = grid(n)
    r = np.sqrt(X * X + Y * Y) / (n / 2)
    v = np.clip(1 - r, 0, 1) ** 2
    return np.dstack([np.ones((n, n)), np.ones((n, n)), np.ones((n, n)), v])


def ray(w=32, h=256):
    yy, xx = np.mgrid[0:h, 0:w].astype(float)
    X = (xx - w / 2 + 0.5) / (w / 2)
    v = np.clip(1 - np.abs(X), 0, 1) ** 1.5 * (yy / h) ** 0.7 * np.clip((h - yy) / (h * 0.15), 0, 1)
    return np.dstack([np.ones((h, w)), np.ones((h, w)) * 0.97, np.ones((h, w)) * 0.88, v])


def speedlines(n=256):
    X, Y = grid(n)
    a = np.arctan2(Y, X)
    r = np.sqrt(X * X + Y * Y) / (n / 2)
    lines = (np.sin(a * 90 + np.sin(a * 13) * 4) > 0.86).astype(float)
    v = lines * np.clip((r - 0.35) / 0.5, 0, 1)
    return np.dstack([np.ones((n, n)), np.ones((n, n)), np.ones((n, n)), v])


EFFECTS = {
    "slash": (slash, 18),
    "slash_x": (lambda: slash(cross=True), 18),
    "hit": (hit, 18),
    "hit_red": (lambda: hit(ramp="red"), 18),
    "fire": (fire, 14),
    "ice": (ice, 14),
    "thunder": (thunder, 16),
    "heal": (sparkle_burst, 12),
    "holy": (pillar, 12),
    "dark": (swirl, 12),
    "buff": (buff, 12),
    "debuff": (lambda: buff(ramp="dark"), 12),
    "shatter": (shatter, 16),
    "smoke": (smoke, 12),
    "sparkle_gold": (lambda: sparkle_burst(ramp="gold", rise=True, count=30), 12),
}
SINGLE = {"circle": magic_circle, "circle_gold": lambda: magic_circle(ramp="gold"), "glow": glow, "ray": ray, "speedlines": speedlines}


def build():
    os.makedirs(OUT, exist_ok=True)
    meta = {"anims": {}, "single": {}}
    rows = []
    for name, (fn, fps) in EFFECTS.items():
        frames = fn()
        rows.append((name, frames, fps))
    singles = [(k, f()) for k, f in SINGLE.items()]
    W = max(max(sum(fr.shape[1] for fr in r[1]) for r in rows), sum(s[1].shape[1] for s in singles))
    H = sum(max(fr.shape[0] for fr in r[1]) for r in rows) + max(s[1].shape[0] for s in singles)
    atlas = np.zeros((H, W, 4))
    y = 0
    for name, frames, fps in rows:
        x = 0
        fl = []
        for fr in frames:
            h, w = fr.shape[:2]
            atlas[y : y + h, x : x + w] = fr
            fl.append([x, y, w, h])
            x += w
        meta["anims"][name] = {"frames": fl, "fps": fps}
        y += max(fr.shape[0] for fr in frames)
    x = 0
    for name, im in singles:
        h, w = im.shape[:2]
        atlas[y : y + h, x : x + w] = im
        meta["single"][name] = [x, y, w, h]
        x += w
    meta["image"] = "fx.png"
    meta["size"] = [W, H]
    Image.fromarray((np.clip(atlas, 0, 1) * 255).astype(np.uint8), "RGBA").save(os.path.join(OUT, "fx.png"))
    json.dump(meta, open(os.path.join(OUT, "fx.json"), "w"))
    print("fx atlas", W, H)
    return atlas


if __name__ == "__main__":
    a = build()
    im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8), "RGBA")
    bg = Image.new("RGBA", im.size, (10, 12, 24, 255))
    bg.alpha_composite(im)
    bg.save("/tmp/claude-0/-home-user-jy2910/5a38f85b-c21f-5751-aafd-449cad322cff/scratchpad/fx.png")
