"""Seamless pixel-art material textures.

Every texture is built from a tileable height field (periodic value noise /
voronoi), lit with a fixed top-left light and quantized onto a hand-picked
hue-shifted ramp, so terrain shares the same pixel language as the sprites.
"""
import os

import numpy as np
from PIL import Image

from sdf import hex2rgb

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "assets", "tex")

rng = np.random.default_rng(7)


def R(*hexes):
    return np.array([hex2rgb(h) for h in hexes])


# ---------------------------------------------------------------- noise


def pnoise(n, cells, seed):
    """periodic value noise, n x n, `cells` lattice cells per side"""
    r = np.random.default_rng(seed)
    g = r.random((cells, cells))
    x = np.arange(n) / n * cells
    i0 = np.floor(x).astype(int)
    f = x - i0
    f = f * f * (3 - 2 * f)
    i1 = (i0 + 1) % cells
    i0 = i0 % cells
    a = g[np.ix_(i0, i0)]
    b = g[np.ix_(i0, i1)]
    c = g[np.ix_(i1, i0)]
    d = g[np.ix_(i1, i1)]
    fy = f[:, None]
    fx = f[None, :]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def fbm(n, base, seed, oct=4, gain=0.5):
    s = np.zeros((n, n))
    a = 1.0
    tot = 0
    c = base
    for o in range(oct):
        if c > n:
            break
        s += a * pnoise(n, c, seed + o * 31)
        tot += a
        a *= gain
        c *= 2
    return s / tot


def voronoi(n, count, seed, jitter=1.0):
    """periodic voronoi: returns (f1, f2, cell id)"""
    r = np.random.default_rng(seed)
    pts = r.random((count, 2)) * n
    yy, xx = np.mgrid[0:n, 0:n].astype(float)
    f1 = np.full((n, n), 1e9)
    f2 = np.full((n, n), 1e9)
    cid = np.zeros((n, n), dtype=int)
    for k, (px, py) in enumerate(pts):
        for ox in (-n, 0, n):
            for oy in (-n, 0, n):
                d = np.sqrt((xx - px - ox) ** 2 + (yy - py - oy) ** 2)
                closer = d < f1
                f2 = np.where(closer, f1, np.minimum(f2, d))
                cid = np.where(closer, k, cid)
                f1 = np.where(closer, d, f1)
    return f1, f2, cid


def lightmap(h, strength=1.0):
    gy = np.roll(h, 1, 0) - np.roll(h, -1, 0)
    gx = np.roll(h, 1, 1) - np.roll(h, -1, 1)
    # light from top-left
    return (gx * -0.7 + gy * -0.7) * strength


BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0 - 0.5


def quant(v, ramp, dither=0.0):
    n = v.shape[0]
    b = np.tile(BAYER, (n // 4 + 1, n // 4 + 1))[:n, :n]
    v = np.clip(v + b * dither / len(ramp), 0, 0.9999)
    return ramp[(v * len(ramp)).astype(int)]


def save(name, rgb, alpha=None):
    os.makedirs(OUT, exist_ok=True)
    a = (np.clip(rgb, 0, 1) * 255 + 0.5).astype(np.uint8)
    if alpha is not None:
        a = np.dstack([a, (alpha * 255).astype(np.uint8)])
        Image.fromarray(a, "RGBA").save(os.path.join(OUT, name + ".png"))
    else:
        Image.fromarray(a, "RGB").save(os.path.join(OUT, name + ".png"))
    return a


def norm(v):
    v = v - v.min()
    return v / max(v.max(), 1e-9)


# ---------------------------------------------------------------- materials

N = 64


def tex_grass(name="grass", ramp=None, seed=1, n=N, blades=900, flowers=0, contrast=0.16):
    ramp = ramp if ramp is not None else R("#24401f", "#335a26", "#46762e", "#5d9036", "#7aaa40", "#9cc452", "#c2dc72")
    h = fbm(n, 4, seed, 3)
    v = 0.42 + (norm(h) - 0.5) * contrast * 2 + (norm(fbm(n, 16, seed + 5, 2)) - 0.5) * 0.08
    r = np.random.default_rng(seed)
    img_v = v.copy()
    for _ in range(blades):
        x, y = r.integers(0, n, 2)
        L = r.integers(2, 4)
        lean = r.choice([-1, 0, 0, 1])
        base = img_v[y, x]
        for k in range(L):
            yy = (y - k) % n
            xx = (x + (lean if k == L - 1 else 0)) % n
            img_v[yy, xx] = min(0.99, base + 0.13 + 0.07 * k)
        img_v[(y + 1) % n, x] = max(0, base - 0.16)
    rgb = quant(img_v, ramp, dither=0.0)
    for _ in range(flowers):
        x, y = r.integers(0, n, 2)
        col = r.choice([0, 1, 2])
        c = [hex2rgb("#fff4d0"), hex2rgb("#ffd84a"), hex2rgb("#f08ab0")][col]
        rgb[y, x] = c
        rgb[(y + 1) % n, x] = ramp[1]
    return save(name, rgb)


def tex_dirt(name="dirt", ramp=None, seed=2, n=N, pebbles=60):
    ramp = ramp if ramp is not None else R("#3a2414", "#5a3a20", "#7a5430", "#9a7044", "#b88c5c", "#d4ac7c")
    h = fbm(n, 4, seed, 5)
    f1, f2, cid = voronoi(n, 26, seed + 9)
    cracks = np.clip(1 - (f2 - f1) / 2.0, 0, 1) ** 4
    v = norm(h) * 0.55 + 0.25 - cracks * 0.25 + lightmap(h, 6)
    r = np.random.default_rng(seed)
    for _ in range(pebbles):
        x, y = r.integers(0, n, 2)
        v[y, x] += 0.3
        v[(y + 1) % n, x] -= 0.25
        if r.random() < 0.5:
            v[y, (x + 1) % n] += 0.2
            v[(y + 1) % n, (x + 1) % n] -= 0.2
    return save(name, quant(v, ramp, dither=0.5))


def tex_sand(name="sand", seed=3, n=N):
    ramp = R("#8a5a30", "#b07a44", "#cf9c5c", "#e4ba7a", "#f2d49c", "#fbe9c4")
    h = fbm(n, 4, seed, 4)
    yy, xx = np.mgrid[0:n, 0:n] / n
    rip = np.sin((yy * 6 + h * 1.8 + xx * 1.0) * 2 * np.pi * 1.0)
    v = 0.48 + rip * 0.12 + (norm(h) - 0.5) * 0.3 + lightmap(rip * 0.15 + h * 0.5, 4)
    r = np.random.default_rng(seed)
    for _ in range(40):
        x, y = r.integers(0, n, 2)
        v[y, x] += 0.25
    return save(name, quant(v, ramp, dither=0.7))


def tex_rock(name="rock", ramp=None, seed=4, n=N, strata=True):
    ramp = ramp if ramp is not None else R("#1c1a26", "#33303e", "#4c4856", "#686270", "#88808a", "#aaa2a6", "#cac2c0")
    f1, f2, cid = voronoi(n, 14 * (n // 64) ** 2 // 2 + 6, seed)
    edge = np.clip((f2 - f1) / 5.0, 0, 1)
    r = np.random.default_rng(seed)
    cellh = r.random(cid.max() + 1)[cid] * 0.35
    h = edge ** 0.6 * 0.8 + cellh + fbm(n, 8, seed + 1, 3) * 0.35
    if strata:
        yy = np.mgrid[0:n, 0:n][0] / n
        h += np.sin((yy + fbm(n, 2, seed + 3, 2) * 0.3) * 2 * np.pi * 4) * 0.08
    v = 0.18 + h * 0.45 + lightmap(h, 3.5)
    v = np.where(edge < 0.08, v * 0.45, v)
    return save(name, quant(v, ramp, dither=0.35))


def tex_cliff(name="cliff", seed=14, n=N):
    """vertical cliff face: horizontal layered slabs"""
    ramp = R("#1e1a22", "#342c34", "#4e4246", "#6a5a58", "#8a766c", "#ab9482", "#c8b29a")
    yy, xx = np.mgrid[0:n, 0:n].astype(float)
    warp = fbm(n, 4, seed, 3) * 10
    band = ((yy + warp * n / 64) / (n / 6)) % 1.0
    f1, f2, cid = voronoi(n, 40, seed + 2)
    edge = np.clip((f2 - f1) / 4.0, 0, 1)
    h = (1 - np.abs(band - 0.5) * 2) ** 0.4 * 0.7 + edge * 0.3 + fbm(n, 8, seed + 5, 3) * 0.3
    v = 0.15 + h * 0.5 + lightmap(h, 3.0)
    v = np.where((band < 0.08) | (edge < 0.06), v * 0.5, v)
    return save(name, quant(v, ramp, dither=0.3))


def tex_cobble(name="cobble", seed=5, n=N, ramp=None, count=20):
    ramp = ramp if ramp is not None else R("#2a2630", "#454050", "#625c6a", "#827a86", "#a29aa2", "#c4bcbe", "#e0d8d4")
    f1, f2, cid = voronoi(n, count, seed)
    edge = np.clip((f2 - f1) / 3.2, 0, 1)
    r = np.random.default_rng(seed)
    tint = r.random(cid.max() + 1)[cid] * 0.18
    h = np.sqrt(edge) * 0.9 + fbm(n, 8, seed + 2, 2) * 0.15
    v = 0.12 + h * 0.5 + tint + lightmap(h, 4.0)
    v = np.where(edge < 0.12, 0.05 + fbm(n, 16, seed + 4, 1) * 0.08, v)
    return save(name, quant(v, ramp, dither=0.3))


def tex_bricks(name="bricks", seed=6, n=N, ramp=None, rows=8, cols=4, mortar=None):
    ramp = ramp if ramp is not None else R("#2a2430", "#433a48", "#5e5462", "#7c707c", "#9c8e98", "#bcaeb4", "#ddd0d0")
    yy, xx = np.mgrid[0:n, 0:n]
    bh = n // rows
    bw = n // cols
    row = yy // bh
    off = (row % 2) * (bw // 2)
    bx = (xx + off) % n
    lx = bx % bw
    ly = yy % bh
    cid = row * cols + bx // bw
    r = np.random.default_rng(seed)
    tint = r.random((rows + 2) * (cols + 2))[cid] * 0.2
    ex = np.minimum(lx, bw - 1 - lx)
    ey = np.minimum(ly, bh - 1 - ly)
    e = np.minimum(ex, ey * 1.0)
    h = np.clip(e / 2.0, 0, 1) * 0.6 + fbm(n, 8, seed, 3) * 0.3
    v = 0.18 + h * 0.5 + tint + lightmap(h, 3.0)
    v = np.where(e < 1, 0.06, v)
    return save(name, quant(v, ramp, dither=0.25))


def tex_marble(name="marble", seed=7, n=N):
    ramp = R("#5a5470", "#7e7894", "#a49eb4", "#c6c2d2", "#e2e0ea", "#f6f4fa")
    yy, xx = np.mgrid[0:n, 0:n]
    t = n // 2
    tile = ((yy // t) + (xx // t)) % 2
    vein = np.abs(np.sin((xx + yy) / n * 2 * np.pi * 2 + fbm(n, 4, seed, 4) * 6))
    v = 0.62 + tile * 0.12 - (vein < 0.08) * 0.25 + fbm(n, 8, seed + 1, 2) * 0.12
    lx = xx % t
    ly = yy % t
    v = np.where((lx == 0) | (ly == 0), 0.25, v)
    v = np.where((lx == 1) | (ly == 1), v + 0.12, v)
    v = np.where((lx == t - 1) | (ly == t - 1), v - 0.12, v)
    return save(name, quant(v, ramp, dither=0.3))


def tex_carpet(name="carpet", n=N):
    """red carpet with gold border along x edges (tile repeats along y)"""
    ramp = R("#2a0610", "#4e0a1a", "#761428", "#9e2234", "#c43a42", "#e46454")
    gold = R("#4a2a10", "#8a5a1c", "#c99030", "#eec25a", "#fff0a8")
    yy, xx = np.mgrid[0:n, 0:n]
    pat = (np.sin(xx / n * 2 * np.pi * 4) * np.sin(yy / n * 2 * np.pi * 4) > 0.5) * 0.1
    v = 0.5 + pat + fbm(n, 16, 3, 2) * 0.12
    rgb = quant(v, ramp, dither=0.4)
    border = (xx < 5) | (xx > n - 6)
    bv = 0.6 + ((yy % 8) < 4) * 0.2 - ((xx == 0) | (xx == n - 1)) * 0.5
    rgb = np.where(border[..., None], quant(bv, gold, 0.2), rgb)
    return save(name, rgb)


def tex_wood(name="wood", seed=8, n=N, ramp=None):
    ramp = ramp if ramp is not None else R("#2a160c", "#4a2a16", "#6c4024", "#8e5a34", "#b07a4a", "#cc9c68")
    yy, xx = np.mgrid[0:n, 0:n]
    plank = yy // (n // 4)
    grain = np.sin((xx / n * 2 * np.pi * 2) + fbm(n, 4, seed, 3) * 8 + plank * 3) * 0.08
    r = np.random.default_rng(seed)
    tint = r.random(5)[plank] * 0.15
    ly = yy % (n // 4)
    v = 0.45 + grain + tint + fbm(n, 16, seed + 1, 2) * 0.1
    v = np.where(ly == 0, 0.05, v)
    v = np.where(ly == 1, v + 0.12, v)
    # nails
    for p in range(4):
        for x0 in (6, n // 2 + 6):
            v[p * (n // 4) + 3, (x0 + p * 9) % n] = 0.95
    return save(name, quant(v, ramp, dither=0.3))


def tex_roof(name="roof", seed=9, n=N, ramp=None):
    ramp = ramp if ramp is not None else R("#121a2c", "#1e2a44", "#2c3c5e", "#3e5278", "#566c92", "#7a90b0")
    yy, xx = np.mgrid[0:n, 0:n]
    rows = 8
    rh = n // rows
    row = yy // rh
    off = (row % 2) * (n // 16)
    lx = (xx + off) % (n // 8)
    ly = yy % rh
    h = (ly / rh) * 0.7 + 0.2 - (lx == 0) * 0.3
    v = 0.15 + h * 0.6 + fbm(n, 8, seed, 2) * 0.15
    v = np.where(ly == rh - 1, 0.04, v)
    return save(name, quant(v, ramp, dither=0.25))


def tex_plaster(name="plaster", seed=10, n=N):
    ramp = R("#6a5a54", "#8e7c72", "#b09e8e", "#cec0ac", "#e6dcc8", "#f6f0e2")
    h = fbm(n, 8, seed, 4)
    v = 0.55 + (h - 0.5) * 0.4 + lightmap(h, 2)
    # timber frame beams
    yy, xx = np.mgrid[0:n, 0:n]
    rgb = quant(v, ramp, 0.4)
    beam = (xx < 4) | (yy < 3) | (np.abs(xx - yy) < 2)
    bv = 0.45 + fbm(n, 16, seed + 2, 1) * 0.2 - ((xx == 3) | (yy == 2)) * 0.3
    rgb = np.where(beam[..., None], quant(bv, R("#24140c", "#3a2214", "#58361e", "#7a4e2c", "#9a6a40"), 0.2), rgb)
    return save(name, rgb)


def tex_leaves_ground(name="forest", seed=11, n=N):
    return tex_grass(name, R("#14241a", "#1c3220", "#284426", "#365a2c", "#4a7032", "#62883c", "#80a24c"), seed=seed, blades=500, contrast=0.22)


def tex_water_noise(name="water_noise", seed=12, n=128):
    """greyscale periodic noise used by the water shader"""
    h = fbm(n, 4, seed, 5)
    v = norm(h)
    rgb = np.dstack([v, norm(fbm(n, 8, seed + 3, 4)), norm(fbm(n, 2, seed + 7, 3))])
    return save(name, rgb)


def tex_path_mask(name="noise", seed=13, n=256):
    v = norm(fbm(n, 8, seed, 5))
    rgb = np.dstack([v, norm(fbm(n, 16, seed + 1, 4)), norm(fbm(n, 4, seed + 2, 4))])
    return save(name, rgb)


def build_all():
    tex_grass()
    tex_grass("grass2", R("#2a441e", "#3c6026", "#527c2c", "#6c9634", "#8cae3e", "#b0c852", "#d4e078"), seed=21, flowers=18)
    tex_leaves_ground()
    tex_dirt()
    tex_dirt("dirt_dark", R("#20140e", "#36241a", "#4e3826", "#664c34", "#806446", "#9c7e5a"), seed=22)
    tex_sand()
    tex_rock(n=128)
    tex_cliff(n=192)
    tex_cobble()
    tex_cobble("castle_floor", seed=25, ramp=R("#2a2a3a", "#40405a", "#5a5a78", "#767898", "#9698b4", "#b8bacc", "#dadbe6"), count=26, n=128)
    tex_bricks()
    tex_bricks("castle_wall", seed=26, ramp=R("#22202e", "#36324a", "#4c4864", "#666080", "#80799a", "#9e98b4", "#c0bcd0"), rows=8, cols=3, n=128)
    tex_marble(n=128)
    tex_carpet()
    tex_wood()
    tex_roof()
    tex_roof("roof_red", seed=27, ramp=R("#2a100c", "#4a1c14", "#6e2c1e", "#8e3e28", "#ae5636", "#ca7a52"))
    tex_plaster()
    tex_water_noise()
    tex_path_mask()


if __name__ == "__main__":
    build_all()
    print("textures ->", OUT)
