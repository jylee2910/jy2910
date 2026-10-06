"""Billboard prop sprites (trees, bushes, grass, rocks, crystals, castle
furniture).  Output: public/assets/props/<name>.png and props.json with
anchor points (pixel position of the ground contact)."""
import json
import math
import os
import sys
from multiprocessing import Pool

import numpy as np
from PIL import Image

from humanoid import Builder, at
from sdf import Mat, Xf, euler, ramp_explicit, render_sprite, to_u8

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "assets", "props")
SCALE = 0.75
PITCH = 14

LEAF = ramp_explicit("#0c1f18", "#143222", "#1f4a2a", "#2f6632", "#46843a", "#66a244", "#94c25a")
LEAF_B = ramp_explicit("#0e1a20", "#162c2c", "#1f4436", "#2c5e3e", "#3e7a46", "#5c984e", "#86b660")
LEAF_AUT = ramp_explicit("#2a0e0a", "#4e1c10", "#7a3416", "#a8521c", "#d07a26", "#eca43a", "#ffd070")
PINE = ramp_explicit("#06141a", "#0c2224", "#13342e", "#1d4a36", "#2c6440", "#42804a")
BARK = ramp_explicit("#1a0e0c", "#2e1a14", "#48291c", "#643a26", "#825034", "#a06a46")
STONE = ramp_explicit("#1a1a26", "#2c2a3a", "#423e50", "#5c5668", "#7a7284", "#9c94a2", "#c2bac2")
MOSS = ramp_explicit("#122012", "#1e3418", "#2e4c1e", "#446a26", "#5e8a30")


def tree(B, seed=0, leaf=LEAF, h=1.0, wide=1.0):
    r = np.random.default_rng(seed)
    B.mat("bark", Mat(BARK))
    B.mat("leaf", Mat(leaf, ao=1.6, band=0.9))
    root = Xf()
    # trunk
    lean = r.uniform(-6, 6)
    tr = at(root, 0, 0, 0, rz=lean)
    B.cone(tr, "bark", (0, 0, 0), (0, 42 * h, 0), 6.0, 3.4, group="t", k=2, noise=(0.5, 0.6, seed))
    for k in range(4):
        a = k / 4 * 2 * math.pi + r.uniform(0, 1)
        B.cone(tr, "bark", (0, 4, 0), (math.cos(a) * 9, -1, math.sin(a) * 9), 3.6, 1.2, group="t", k=2)
    # branches
    tips = []
    for k in range(5):
        a = k / 5 * 2 * math.pi + r.uniform(-0.4, 0.4)
        y0 = (26 + k * 4) * h
        tip = np.array([math.cos(a) * 18 * wide, y0 + 14 * h, math.sin(a) * 14])
        B.cone(tr, "bark", (0, y0, 0), tuple(tip), 2.4, 1.0, group="t", k=1.5)
        tips.append(tip)
    # foliage clusters
    centers = [np.array([0, 60 * h, 0])] + [t + np.array([0, 4, 0]) for t in tips]
    for k in range(10):
        a = r.uniform(0, 2 * math.pi)
        centers.append(np.array([math.cos(a) * 16 * wide, (46 + r.uniform(0, 26)) * h, math.sin(a) * 13]))
    for k, c in enumerate(centers):
        rad = r.uniform(9, 13) * (1.3 if k == 0 else 1.0)
        B.sph(at(tr, *c), "leaf", rad, group="f", k=2.5, noise=(1.3, 0.5, seed * 10 + k))


def pine(B, seed=0, h=1.0):
    r = np.random.default_rng(seed)
    B.mat("bark", Mat(BARK))
    B.mat("leaf", Mat(PINE, ao=1.3))
    B.cone(Xf(), "bark", (0, 0, 0), (0, 30 * h, 0), 4.0, 2.0)
    for k in range(5):
        y = (16 + k * 15) * h
        rad = (24 - k * 4.4)
        B.cone(Xf(), "leaf", (0, y, 0), (0, y + 22 * h, 0), rad, 1.0, group="f%d" % k, k=1, noise=(1.0, 0.6, seed + k))


def bush(B, seed=0, leaf=LEAF, berries=False):
    r = np.random.default_rng(seed)
    B.mat("leaf", Mat(leaf, ao=1.4))
    B.mat("berry", Mat(ramp_explicit("#3a0010", "#7a0a20", "#c82038", "#ff5a60", "#ffc0b0"), spec=0.6))
    for k in range(5):
        a = k / 5 * 2 * math.pi
        c = (math.cos(a) * 8, 8 + r.uniform(0, 6), math.sin(a) * 6)
        B.sph(at(Xf(), *c), "leaf", r.uniform(8, 11), group="f", k=4, noise=(1.8, 0.35, seed * 7 + k))
    B.sph(at(Xf(), 0, 14, 0), "leaf", 11, group="f", k=4, noise=(1.8, 0.35, seed))
    if berries:
        for k in range(9):
            a = r.uniform(0, 2 * math.pi)
            B.sph(at(Xf(), math.cos(a) * 12, 8 + r.uniform(0, 12), math.sin(a) * 8 + 6), "berry", 1.4)


def grass_tuft(B, seed=0, col=None, n=9, tall=1.0):
    r = np.random.default_rng(seed)
    B.mat("g", Mat(col if col is not None else ramp_explicit("#1a3a1a", "#2a5a22", "#407a2c", "#5c9a36", "#82b846", "#aed060")))
    for k in range(n):
        x = r.uniform(-6, 6)
        z = r.uniform(-3, 3)
        a = (x * 3.5) + r.uniform(-12, 12)
        L = r.uniform(7, 12) * tall
        B.cone(at(Xf(), x, 0, z, rz=-a), "g", (0, 0, 0), (0, L, 0), 1.2, 0.2)


def flowers(B, seed=0, petal="#f4f0ff"):
    r = np.random.default_rng(seed)
    B.mat("stem", Mat(ramp_explicit("#1a3a1a", "#2a5a22", "#407a2c", "#5c9a36", "#82b846")))
    pr = ramp_explicit("#4a3a6a", "#8a7aaa", "#c2b6dc", "#e8e0f6", "#ffffff") if petal == "#f4f0ff" else ramp_explicit("#5a2a00", "#a85a00", "#e89a10", "#ffd040", "#fff4a0") if petal == "y" else ramp_explicit("#4a0a2a", "#8a1a4a", "#c8407a", "#f080aa", "#ffd0e0")
    B.mat("p", Mat(pr))
    B.mat("c", Mat(ramp_explicit("#6a3a00", "#b07000", "#f0b020", "#ffe070", "#ffffff")))
    for k in range(6):
        x = r.uniform(-8, 8)
        z = r.uniform(-4, 4)
        L = r.uniform(6, 11)
        B.cone(at(Xf(), x, 0, z, rz=-x * 2), "stem", (0, 0, 0), (0, L, 0), 0.6, 0.4)
        top = at(Xf(), x, 0, z, rz=-x * 2) @ Xf.T(0, L, 0)
        for p in range(5):
            a = p / 5 * 2 * math.pi
            B.ell(at(top, math.cos(a) * 1.6, 0.3, math.sin(a) * 1.6), "p", (1.4, 0.7, 1.4))
        B.sph(at(top, 0, 0.6, 0), "c", 0.9)
    grass_tuft(B, seed + 3, n=6, tall=0.7)


def rock(B, seed=0, size=1.0, moss=True):
    r = np.random.default_rng(seed)
    B.mat("stone", Mat(STONE, band=0.9))
    B.mat("moss", Mat(MOSS))
    for k in range(3):
        c = (r.uniform(-8, 8) * size, r.uniform(4, 9) * size, r.uniform(-4, 4) * size)
        B.add("box", at(Xf(), *c, rx=r.uniform(-20, 20), ry=r.uniform(0, 90), rz=r.uniform(-20, 20)), "stone", ((r.uniform(7, 11) * size, r.uniform(6, 9) * size, r.uniform(6, 9) * size), 3.0 * size), group="r", k=3, noise=(1.0 * size, 0.25 / size, seed + k))
    if moss:
        B.add("ell", at(Xf(), 0, 16 * size, 0), "moss", (14 * size, 6 * size, 12 * size), group="r", op="paint", noise=(2.0, 0.3, seed))


def crystal(B, seed=0, col="cyan"):
    r = np.random.default_rng(seed)
    ramp = ramp_explicit("#06203a", "#0c4a7a", "#1a86c8", "#46c6f6", "#a8f0ff", "#ffffff") if col == "cyan" else ramp_explicit("#2a0a3a", "#5a1a7a", "#9a3ac8", "#d07af6", "#f4c8ff", "#ffffff")
    B.mat("cr", Mat(ramp, spec=1.2, shine=16, emissive=0.35, band=0.85))
    B.mat("stone", Mat(STONE))
    B.add("box", at(Xf(), 0, 28, 0, ry=45), "cr", ((6, 28, 6), 0.6), taper=(-28, 28, 1.0, 0.1), group="c", k=0.5)
    for k in range(5):
        a = k / 5 * 2 * math.pi + 0.3
        L = r.uniform(10, 18)
        B.add("box", at(Xf(), math.cos(a) * 7, 3, math.sin(a) * 7, rx=math.sin(a) * 30, rz=-math.cos(a) * 30, ry=a * 50), "cr", ((3, L, 3), 0.4), taper=(-L, L, 1.0, 0.1), group="c%d" % k, k=0.5)
    B.add("cyl", at(Xf(), 0, 1.5, 0), "stone", (2.0, 12, 1.0), noise=(0.8, 0.4, 3))


def torch(B, seed=0):
    B.mat("metal", Mat(ramp_explicit("#121018", "#24202c", "#3a3444", "#56506a", "#7a7490"), spec=0.5))
    B.mat("gold", Mat(ramp_explicit("#4a2a10", "#8a5a1c", "#c99030", "#eec25a", "#fff0a8"), spec=0.6))
    B.mat("fire", Mat(ramp_explicit("#a02000", "#e85a00", "#ffa020", "#ffe070", "#fffbe0"), emissive=0.9))
    B.add("cyl", at(Xf(), 0, 22, 0), "metal", (22, 1.6, 0.4))
    B.add("cyl", at(Xf(), 0, 1.5, 0), "metal", (1.5, 6, 0.6))
    B.cone(Xf(), "gold", (0, 44, 0), (0, 52, 0), 3.0, 7.0)
    B.add("torus", at(Xf(), 0, 52, 0), "gold", (6.5, 1.2))


def banner(B, col="#8a1428"):
    B.mat("cloth", Mat(ramp_explicit("#2a0410", "#55081c", "#8a1428", "#bc2a36", "#e2584e") if col == "red" else ramp_explicit("#0a1030", "#141e5a", "#22348a", "#3a56b8", "#6a8ae0")))
    B.mat("gold", Mat(ramp_explicit("#4a2a10", "#8a5a1c", "#c99030", "#eec25a", "#fff0a8"), spec=0.6))
    B.add("cyl", at(Xf(), 0, 88, 0, rz=90), "gold", (14, 1.2, 0.4))
    B.add("box", at(Xf(), 0, 60, 0), "cloth", ((12, 28, 0.8), 0.5))
    B.add("cone", at(Xf(), 0, 32, 0), "cloth", ((-12, 0, 0), (0, -8, 0), 0.8, 0.8))
    B.add("tri", Xf(), "cloth", ((-12, 33, 0), (12, 33, 0), (0, 22, 0), 0.8))
    # crest: gold diamond & wings
    B.add("box", at(Xf(), 0, 64, 1.0, rz=45), "gold", ((4, 4, 0.5), 0.5))
    B.add("box", at(Xf(), -5, 66, 1.0, rz=-30), "gold", ((4.5, 1.2, 0.5), 0.4))
    B.add("box", at(Xf(), 5, 66, 1.0, rz=30), "gold", ((4.5, 1.2, 0.5), 0.4))


def throne(B):
    B.mat("gold", Mat(ramp_explicit("#3a1e0a", "#7a4a18", "#b8822a", "#e6b850", "#fff0a0"), spec=0.7, shine=14))
    B.mat("velvet", Mat(ramp_explicit("#1a0410", "#3a0820", "#621030", "#8a1c40", "#b23656")))
    B.mat("gem", Mat(ramp_explicit("#06203a", "#10508a", "#2a90d8", "#7ad0ff", "#e0f6ff"), spec=0.9, emissive=0.3))
    B.box(at(Xf(), 0, 30, -8), "gold", (16, 30, 3), rr=1.5)
    B.box(at(Xf(), 0, 30, -5.4), "velvet", (11, 24, 1.2), rr=1.0)
    B.cone(Xf(), "gold", (0, 60, -8), (0, 72, -8), 6.0, 0.8)
    for sx in (-1, 1):
        B.cone(Xf(), "gold", (sx * 14, 58, -8), (sx * 15, 66, -8), 3.0, 0.6)
        B.box(at(Xf(), sx * 14, 22, 2), "gold", (2.4, 4, 10), rr=1.2)
        B.box(at(Xf(), sx * 14, 8, 6), "gold", (2.4, 8, 2.4), rr=1.0)
    B.box(at(Xf(), 0, 15, 2), "velvet", (12, 3, 10), rr=1.6)
    B.box(at(Xf(), 0, 7, 2), "gold", (14, 6, 11), rr=1.2)
    B.sph(at(Xf(), 0, 54, -4.6), "gem", 2.6)


def barrel(B):
    B.mat("wood", Mat(BARK))
    B.mat("metal", Mat(ramp_explicit("#121018", "#24202c", "#3a3444", "#56506a", "#7a7490"), spec=0.5))
    B.add("cyl", at(Xf(), 0, 12, 0), "wood", (12, 9, 1.0), group="b")
    B.add("ell", at(Xf(), 0, 12, 0), "wood", (10.5, 12.5, 10.5), op="int", group="b")
    for y in (4, 20):
        B.add("torus", at(Xf(), 0, y, 0), "metal", (9.6, 0.8))


def crate(B):
    B.mat("wood", Mat(ramp_explicit("#2a1a0c", "#4a3016", "#6e4a22", "#946632", "#b88848", "#d6aa6a")))
    B.box(at(Xf(), 0, 10, 0, ry=20), "wood", (10, 10, 10), rr=1.0)
    for a in (-1, 1):
        B.box(at(Xf(), 0, 10, 0, ry=20) @ Xf.T(0, 0, 10.2) @ Xf(euler(0, 0, 45 * a)), "wood", (13, 1.4, 0.6), rr=0.4)


def sign(B):
    B.mat("wood", Mat(BARK))
    B.mat("plank", Mat(ramp_explicit("#2a1a0c", "#4a3016", "#6e4a22", "#946632", "#b88848", "#d6aa6a")))
    B.add("cyl", at(Xf(), 0, 15, 0), "wood", (15, 1.6, 0.6))
    B.box(at(Xf(), 2, 26, 2, rz=-4), "plank", (11, 4, 1.2), rr=0.6)
    B.add("cone", at(Xf(), 13, 26, 2), "plank", ((0, -4, 0), (0, 4, 0), 1.2, 1.2))


def fence(B):
    B.mat("wood", Mat(BARK))
    for x in (-14, 0, 14):
        B.box(at(Xf(), x, 10, 0), "wood", (1.6, 10, 1.6), rr=0.6)
        B.cone(Xf(), "wood", (x, 20, 0), (x, 23, 0), 1.6, 0.3)
    for y in (8, 15):
        B.box(at(Xf(), 0, y, 1.6), "wood", (17, 1.2, 0.8), rr=0.4)


def pillar(B):
    B.mat("stone", Mat(ramp_explicit("#2e2c40", "#46445e", "#62607e", "#82809c", "#a6a4bc", "#cac8da", "#eceaf4")))
    B.mat("gold", Mat(ramp_explicit("#3a1e0a", "#7a4a18", "#b8822a", "#e6b850", "#fff0a0"), spec=0.6))
    B.add("cyl", at(Xf(), 0, 70, 0), "stone", (64, 8, 1.0), group="p")
    for k in range(10):
        a = k / 10 * 2 * math.pi
        B.add("cyl", at(Xf(), math.cos(a) * 8, 70, math.sin(a) * 8), "stone", (60, 1.3, 0.5), op="sub", group="p")
    B.box(at(Xf(), 0, 4, 0), "stone", (12, 4, 12), rr=1.0)
    B.box(at(Xf(), 0, 136, 0), "stone", (12, 4, 12), rr=1.0)
    B.add("torus", at(Xf(), 0, 9, 0), "gold", (8.4, 1.0))
    B.add("torus", at(Xf(), 0, 131, 0), "gold", (8.4, 1.0))


def windmill(B):
    B.mat("plaster", Mat(ramp_explicit("#4a3e3a", "#6e605a", "#988a7e", "#c2b4a2", "#e2d6c2", "#f6eedc")))
    B.mat("roof", Mat(ramp_explicit("#2a0a0c", "#4c1414", "#742020", "#9c3428", "#c45236", "#e48058")))
    B.mat("wood", Mat(BARK))
    B.mat("sail", Mat(ramp_explicit("#5a5048", "#8a7e70", "#b8ac9a", "#ded4c0", "#f6f0e2")))
    B.add("cyl", at(Xf(), 0, 30, 0), "plaster", (30, 16, 1.0), taper=(-30, 30, 1.0, 0.75))
    B.cone(Xf(), "roof", (0, 58, 0), (0, 82, 0), 16, 1.0)
    B.box(at(Xf(), 0, 10, 13.5), "wood", (5, 10, 2), rr=1.0)
    hub = at(Xf(), 0, 62, 15)
    for k in range(4):
        a = k * 90 + 20
        arm = hub @ Xf(euler(0, 0, a))
        B.box(at(arm, 0, 22, 0), "wood", (1.0, 22, 1.0), rr=0.4)
        B.box(at(arm, 4.5, 26, -0.5), "sail", (4.0, 16, 0.5), rr=0.3)
    B.sph(hub, "wood", 3)


def well(B):
    B.mat("stone", Mat(STONE))
    B.mat("wood", Mat(BARK))
    B.mat("roof", Mat(ramp_explicit("#140c24", "#24184a", "#36287a", "#4a3ea6", "#6a62c8", "#9a96e0")))
    B.mat("water", Mat(ramp_explicit("#06203a", "#0c3a5a", "#14587a", "#2a7aa0")))
    B.add("cyl", at(Xf(), 0, 7, 0), "stone", (7, 13, 1.5), noise=(0.6, 0.4, 2), group="w")
    B.add("cyl", at(Xf(), 0, 12, 0), "water", (5, 10.5, 0.5), op="sub", group="w")
    B.add("cyl", at(Xf(), 0, 9, 0), "water", (0.5, 10.6, 0.2))
    for sx in (-1, 1):
        B.box(at(Xf(), sx * 12, 22, 0), "wood", (1.4, 16, 1.4), rr=0.5)
    B.add("tri", Xf(), "roof", ((-17, 36, -9), (17, 36, -9), (0, 46, 0), 1.0))
    B.add("tri", Xf(), "roof", ((-17, 36, 9), (17, 36, 9), (0, 46, 0), 1.0))
    B.add("cyl", at(Xf(), 0, 32, 0, rz=90), "wood", (12, 1.0, 0.3))


def house(B, roof="blue"):
    B.mat("plaster", Mat(ramp_explicit("#4a3e3a", "#6e605a", "#988a7e", "#c2b4a2", "#e2d6c2", "#f6eedc")))
    rr = ramp_explicit("#140c24", "#24184a", "#36287a", "#4a3ea6", "#6a62c8", "#9a96e0") if roof == "blue" else ramp_explicit("#2a0a0c", "#4c1414", "#742020", "#9c3428", "#c45236", "#e48058")
    B.mat("roof", Mat(rr))
    B.mat("wood", Mat(BARK))
    B.mat("win", Mat(ramp_explicit("#3a2a10", "#7a5a20", "#d0a040", "#ffe080", "#fff8d0"), emissive=0.5))
    B.mat("stone", Mat(STONE))
    B.box(at(Xf(), 0, 18, 0), "plaster", (26, 18, 18), rr=0.8)
    B.box(at(Xf(), 0, 3, 0), "stone", (27, 3, 19), rr=0.8)
    # timber frame
    for x in (-26, -9, 9, 26):
        B.box(at(Xf(), x, 18, 18), "wood", (1.4, 18, 0.8), rr=0.3)
    B.box(at(Xf(), 0, 35, 18), "wood", (26, 1.2, 0.8), rr=0.3)
    # roof prism
    B.add("tri", Xf(), "roof", ((-30, 34, 22), (30, 34, 22), (0, 58, 0), 1.6), group="rf", k=0.5)
    B.add("tri", Xf(), "roof", ((-30, 34, -22), (30, 34, -22), (0, 58, 0), 1.6), group="rf", k=0.5)
    B.add("tri", Xf(), "roof", ((-30, 34, 22), (-30, 34, -22), (0, 58, 0), 1.6), group="rf", k=0.5)
    B.add("tri", Xf(), "roof", ((30, 34, 22), (30, 34, -22), (0, 58, 0), 1.6), group="rf", k=0.5)
    B.box(at(Xf(), 12, 60, -6), "stone", (3.5, 8, 3.5), rr=0.5)
    B.box(at(Xf(), -14, 14, 18.6), "wood", (5, 9, 0.8), rr=0.4)
    B.box(at(Xf(), -14, 14, 18.8), "wood", (4, 8, 0.3), rr=0.3)
    for x in (2, 17):
        B.box(at(Xf(), x, 21, 18.4), "wood", (4, 4.5, 0.8), rr=0.3)
        B.box(at(Xf(), x, 21, 18.8), "win", (3, 3.5, 0.4), rr=0.2)


PROPS = {
    "tree1": (lambda B: tree(B, 1), (176, 176, 88, 166)),
    "tree2": (lambda B: tree(B, 2, LEAF_B, h=1.15, wide=0.9), (176, 192, 88, 182)),
    "tree3": (lambda B: tree(B, 3, LEAF, h=0.85, wide=1.1), (176, 160, 88, 150)),
    "tree_aut": (lambda B: tree(B, 4, LEAF_AUT), (176, 176, 88, 166)),
    "pine1": (lambda B: pine(B, 1), (96, 176, 48, 168)),
    "pine2": (lambda B: pine(B, 2, h=1.2), (96, 200, 48, 192)),
    "bush1": (lambda B: bush(B, 1), (64, 56, 32, 48)),
    "bush2": (lambda B: bush(B, 2, LEAF_B, berries=True), (64, 56, 32, 48)),
    "grass1": (lambda B: grass_tuft(B, 1), (32, 24, 16, 20)),
    "grass2": (lambda B: grass_tuft(B, 2, n=12, tall=1.3), (32, 28, 16, 24)),
    "grass3": (lambda B: grass_tuft(B, 3, col=ramp_explicit("#2a3a10", "#4a5a1a", "#6a7a24", "#8c9a32", "#b0ba48", "#d8d870"), n=10), (32, 24, 16, 20)),
    "flowers_w": (lambda B: flowers(B, 1), (40, 28, 20, 22)),
    "flowers_y": (lambda B: flowers(B, 2, "y"), (40, 28, 20, 22)),
    "flowers_p": (lambda B: flowers(B, 3, "p"), (40, 28, 20, 22)),
    "rock1": (lambda B: rock(B, 1), (72, 56, 36, 48)),
    "rock2": (lambda B: rock(B, 2, 1.8), (120, 88, 60, 78)),
    "rock3": (lambda B: rock(B, 3, 0.6, moss=False), (48, 36, 24, 30)),
    "crystal": (lambda B: crystal(B, 1), (80, 96, 40, 88)),
    "crystal_p": (lambda B: crystal(B, 2, "purple"), (80, 96, 40, 88)),
    "torch": (lambda B: torch(B), (40, 96, 20, 90)),
    "banner_red": (lambda B: banner(B, "red"), (48, 104, 24, 98)),
    "banner_blue": (lambda B: banner(B, "blue"), (48, 104, 24, 98)),
    "throne": (lambda B: throne(B), (64, 112, 32, 104)),
    "barrel": (lambda B: barrel(B), (40, 40, 20, 34)),
    "crate": (lambda B: crate(B), (48, 40, 24, 34)),
    "sign": (lambda B: sign(B), (48, 48, 22, 42)),
    "fence": (lambda B: fence(B), (64, 40, 32, 34)),
    "pillar": (lambda B: pillar(B), (40, 200, 20, 194)),
    "windmill": (lambda B: windmill(B), (288, 304, 144, 292), 2.2),
    "well": (lambda B: well(B), (96, 104, 48, 96), 1.4),
}


def render(name):
    entry = PROPS[name]
    fn, (w, h, ax, ay) = entry[0], entry[1]
    K = entry[2] if len(entry) > 2 else 1.0
    B = Builder()
    fn(B)
    if K != 1.0:
        for p in B.prims:
            p.xf = Xf(p.xf.R * K, p.xf.t * K)
            p.s = float(np.linalg.norm(p.xf.R[:, 0]))
    img, _ = render_sprite(B.prims, B.mats, w, h, (0, 0, 0), (ax, ay), yaw=0, pitch=PITCH, scale=SCALE, steps=128, depth_thresh=3.0)
    return name, to_u8(img)


if __name__ == "__main__":
    names = [a for a in sys.argv[1:] if not a.startswith("--")] or list(PROPS)
    os.makedirs(OUT, exist_ok=True)
    meta_path = os.path.join(OUT, "props.json")
    meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {}
    with Pool(4) as pool:
        for name, im in pool.imap(render, names):
            Image.fromarray(im, "RGBA").save(os.path.join(OUT, name + ".png"))
            w, h, ax, ay = PROPS[name][1]
            meta[name] = {"w": w, "h": h, "ax": ax, "ay": ay, "scale": SCALE}
            print(name)
    json.dump(meta, open(meta_path, "w"), indent=0)
    if "--preview" in sys.argv:
        ims = [Image.open(os.path.join(OUT, n + ".png")) for n in names]
        W = sum(i.width for i in ims)
        H = max(i.height for i in ims)
        sheet = Image.new("RGBA", (W, H), (80, 100, 84, 255))
        x = 0
        for i in ims:
            sheet.alpha_composite(i, (x, H - i.height))
            x += i.width
        sheet.resize((W * 2, H * 2), Image.NEAREST).save("/tmp/claude-0/-home-user-jy2910/5a38f85b-c21f-5751-aafd-449cad322cff/scratchpad/props.png")
