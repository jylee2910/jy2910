"""Monster definitions.  Each monster: materials(B), build(B, anim, t) with
t in [0,1) cycle phase or frame index fraction.  Monsters face +z; they are
rendered from their right side so that they look toward screen-right."""
import math

import numpy as np

from humanoid import Builder, at
from sdf import Mat, Xf, euler, ramp, ramp_explicit

S = math.sin
C = math.cos
TAU = 2 * math.pi


def eye_mat(B, name="eye", col=("#3a0a00", "#c83000", "#ff8a00", "#ffe040", "#ffffff")):
    B.mat(name, Mat(ramp_explicit(*col), emissive=0.75))


# ==========================================================================
# IMP – hunched purple-pink demon with claws (group enemy)
# ==========================================================================


class Imp:
    name = "imp"
    size = (128, 112, 70, 104)  # w,h,anchor x, anchor y
    anims = {"idle": (4, 6, True), "attack": (5, 12, False), "hurt": (2, 8, False), "cast": (4, 8, False)}

    @staticmethod
    def materials(B):
        B.mat("skin", Mat(ramp_explicit("#1e0a2a", "#3e1452", "#6a2280", "#9a3aa8", "#c86ac8", "#f0a8e6"), band=0.95))
        B.mat("belly", Mat(ramp_explicit("#3a0e30", "#6e1e50", "#a03a72", "#d0649a", "#f0a0c4")))
        B.mat("horn", Mat(ramp_explicit("#1a1210", "#3a2a22", "#6a5444", "#a08a70", "#e0d0b0"), spec=0.3))
        B.mat("claw", Mat(ramp_explicit("#201820", "#4a3a44", "#8a7a86", "#c8bcc4", "#ffffff"), spec=0.5))
        B.mat("wing", Mat(ramp_explicit("#12061c", "#2a0c3a", "#481860", "#6a2a88", "#9050b0")))
        eye_mat(B, "eye", ("#3a0000", "#a00020", "#ff2040", "#ff9090", "#ffffff"))

    @staticmethod
    def build(B, anim, i, n):
        t = i / max(n, 1)
        bob = S(t * TAU) * 0.8 if anim == "idle" else 0
        lean = {"idle": 20, "attack": [10, 0, 45, 50, 25][i] if anim == "attack" else 0, "hurt": -10, "cast": 5}.get(anim, 20)
        lunge = [0, -2, 8, 9, 3][i] if anim == "attack" else (-3 if anim == "hurt" else 0)
        root = Xf.T(0, 18 + bob, lunge) @ Xf(euler(lean, 0, 0))
        # body
        B.ell(at(root, 0, 0, 0), "skin", (7.5, 9, 6.5), group="body", k=3)
        B.ell(at(root, 0, -2, 2.5), "belly", (5.2, 6.5, 4.6), group="body", k=3, order=1)
        B.ell(at(root, 0, 7, -1), "skin", (8.5, 6, 6.5), group="body", k=3)
        # head
        hd = root @ Xf.T(0, 13, 3) @ Xf(euler(-lean * 0.8 + (S(t * TAU) * 4 if anim == "idle" else 0), 0, 0))
        B.ell(at(hd, 0, 0, 0), "skin", (6, 5.5, 6), group="head", k=2)
        B.ell(at(hd, 0, -2.5, 3.5), "skin", (4.4, 3.2, 4.0), group="head", k=2)  # snout
        for sx in (-1, 1):
            B.cone(at(hd, sx * 3.5, 3.0, -1), "horn", (0, 0, 0), (sx * 6, 7, -5), 1.8, 0.3, group="horn" + str(sx), k=0.5)
            B.cone(at(hd, sx * 3.5, 3.0, -1), "horn", (sx * 6, 7, -5), (sx * 5, 12, -10), 0.9, 0.2, group="horn" + str(sx), k=0.5)
            B.ell(at(hd, sx * 2.6, 0.8, 5.0), "eye", (1.4, 0.9, 0.8), order=2)
            # pointed ears
            B.cone(at(hd, sx * 5.5, 0.5, -1), "skin", (0, 0, 0), (sx * 6, 2.5, -3), 1.5, 0.2)
        # spikes on back
        for k in range(5):
            y = 10 - k * 4
            B.cone(at(root, 0, y, -5.5 + k * 0.3), "horn", (0, 0, 0), (0, 2, -5), 1.6, 0.2, group="spk", k=0.5)
        # arms – long with claws
        for sx in (-1, 1):
            if anim == "attack":
                sw = [-20, -110, 40, 70, 10][i] if sx == 1 else [-10, -60, 20, 50, 0][i]
            elif anim == "cast":
                sw = -120
            elif anim == "hurt":
                sw = 30
            else:
                sw = -20 + S(t * TAU + sx) * 8
            sh = root @ Xf.T(sx * 8, 7, 0) @ Xf(euler(sw, 0, sx * 25))
            B.limb(sh, "skin", 9, 2.6, 2.0, group="arm" + str(sx), k=1)
            el = sh @ Xf.T(0, -9, 0) @ Xf(euler(-40, 0, 0))
            B.limb(el, "skin", 8, 2.2, 1.8, group="arm" + str(sx), k=1)
            hn = el @ Xf.T(0, -8.5, 0)
            B.ell(hn, "skin", (2.4, 2.2, 2.2), group="arm" + str(sx), k=1)
            for c in (-1, 0, 1):
                B.cone(at(hn, c * 1.3, -1, 1.2), "claw", (0, 0, 0), (c * 1.2, -4.5, 2.5), 0.8, 0.15)
        # legs – digitigrade
        for sx in (-1, 1):
            hp = root @ Xf.T(sx * 4.5, -6, 0) @ Xf(euler(-50 - lean, 0, sx * 8))
            B.limb(hp, "skin", 7, 3.2, 2.4, group="leg" + str(sx), k=1)
            kn = hp @ Xf.T(0, -7, 0) @ Xf(euler(90, 0, 0))
            B.limb(kn, "skin", 6, 2.2, 1.6, group="leg" + str(sx), k=1)
            an = kn @ Xf.T(0, -6, 0) @ Xf(euler(-40, 0, 0))
            B.ell(at(an, 0, -1, 1.5), "skin", (2.2, 1.4, 3.2), group="leg" + str(sx), k=1)
        # small wings
        fl = S(t * TAU * 2) * 15 if anim == "idle" else 30
        for sx in (-1, 1):
            w = root @ Xf.T(sx * 4, 8, -5) @ Xf(euler(-20, sx * (40 + fl), sx * 30))
            B.box(at(w, 0, 0, -6), "wing", (0.4, 5.5, 6.5), rr=0.3, taper=(-5.5, 5.5, 0.5, 1.0))
        # tail
        tw = S(t * TAU) * 15
        tl = root @ Xf.T(0, -6, -4) @ Xf(euler(120, tw, 0))
        B.cone(tl, "skin", (0, 0, 0), (0, -10, 0), 2.2, 1.0, group="tail", k=1)
        B.cone(tl, "skin", (0, -10, 0), (0, -16, 4), 1.0, 0.5, group="tail", k=1)
        B.cone(at(tl, 0, -16, 4), "horn", (0, 0, 0), (0, -2.5, 2), 1.4, 0.1)


# ==========================================================================
# CRAWLER – giant red/gold spiked crab-beetle (desert)
# ==========================================================================


class Crawler:
    name = "crawler"
    size = (192, 150, 96, 136)
    anims = {"idle": (4, 6, True), "attack": (5, 12, False), "hurt": (2, 8, False), "cast": (4, 8, False)}

    @staticmethod
    def materials(B):
        B.mat("shell", Mat(ramp_explicit("#3a1408", "#7a3410", "#b86a1c", "#e6a838", "#ffe07a", "#fff6c8"), spec=0.45, shine=12, band=0.9))
        B.mat("body", Mat(ramp_explicit("#2e040c", "#5e0a14", "#9a1820", "#d43a2c", "#ff7a4a")))
        B.mat("leg", Mat(ramp_explicit("#300608", "#661010", "#a42218", "#dc4a26", "#ff8a50"), spec=0.3))
        B.mat("claw", Mat(ramp_explicit("#2a0808", "#601818", "#a83020", "#e86a3a", "#ffc08a"), spec=0.5))
        B.mat("tip", Mat(ramp_explicit("#2a2020", "#5a4a40", "#9a8a70", "#e0d4b0", "#ffffff"), spec=0.6))
        eye_mat(B, "eye", ("#202000", "#80a000", "#d0ff20", "#f0ff90", "#ffffff"))

    @staticmethod
    def build(B, anim, i, n):
        t = i / max(n, 1)
        bob = S(t * TAU) * 1.0 if anim == "idle" else 0
        lunge = [0, -4, 12, 12, 4][i] if anim == "attack" else (-4 if anim == "hurt" else 0)
        rearing = [0, 18, -8, -8, 0][i] if anim == "attack" else (-8 if anim == "hurt" else (10 if anim == "cast" else 0))
        root = Xf.T(0, 20 + bob, lunge) @ Xf(euler(-rearing, 0, 0))
        # body underside
        B.ell(at(root, 0, -2, 0), "body", (17, 9, 20), group="b", k=3)
        B.ell(at(root, 0, 0, 16), "body", (11, 8, 8), group="b", k=3)  # head
        # shell: big dome w/ ridges + spikes
        B.ell(at(root, 0, 5, -3), "shell", (19, 12, 22), group="shell", k=2, noise=(0.35, 0.3, 3))
        B.add("ell", at(root, 0, -6, -3), "shell", (30, 8, 30), group="shell", op="sub", k=2)
        for k in range(7):
            a = (k - 3) / 3.0
            B.cone(at(root, a * 13, 9 + (1 - abs(a)) * 5, -10 + abs(a) * 4), "tip", (0, 0, 0), (a * 6, 9, -9), 2.8, 0.3, group="spk%d" % k, k=0.5)
        for k in range(5):
            a = (k - 2) / 2.0
            B.cone(at(root, a * 10, 14, 2), "shell", (0, 0, 0), (a * 3, 6, -3), 2.6, 0.3)
        # eyes on stalks
        for sx in (-1, 1):
            st = root @ Xf.T(sx * 5, 5, 21) @ Xf(euler(-40 + bob * 4, 0, sx * 15))
            B.limb(st, "body", 6, 1.2, 1.0)
            B.sph(at(st, 0, 6.5, 0), "eye", 2.2)
        # mandibles
        for sx in (-1, 1):
            B.cone(at(root, sx * 4, -4, 23), "tip", (0, 0, 0), (-sx * 3, -5, 6), 1.8, 0.3)
        # legs: 3 per side
        for sx in (-1, 1):
            for k in range(3):
                ph = t * TAU + k * 2.1 + (0 if sx > 0 else 1)
                lift = max(0, S(ph)) * 10 if anim == "idle" else 0
                hip = root @ Xf.T(sx * 14, -4, 8 - k * 9) @ Xf(euler(0, sx * (-30 + k * 25), sx * (100 + lift)))
                B.limb(hip, "leg", 13, 2.8, 2.2, group="lg%d%d" % (sx, k), k=1)
                kn = hip @ Xf.T(0, -13, 0) @ Xf(euler(0, 0, -sx * 82))
                B.limb(kn, "leg", 16, 2.2, 0.8, group="lg%d%d" % (sx, k), k=1)
                B.sph(at(kn, 0, 0, 0), "shell", 2.6)
        # claws
        for sx in (-1, 1):
            if anim == "attack":
                ang = [-30, -100, 10, 20, -20][i]
                pinch = [10, 30, 0, 0, 10][i]
            elif anim == "hurt":
                ang, pinch = -60, 20
            elif anim == "cast":
                ang, pinch = -90 - S(t * TAU) * 10, 25
            else:
                ang, pinch = -30 + S(t * TAU + sx) * 6, 8 + S(t * TAU * 2) * 6
            sh = root @ Xf.T(sx * 13, 0, 18) @ Xf(euler(ang, sx * 30, sx * -40))
            B.limb(sh, "leg", 12, 3.4, 3.0, group="cl%d" % sx, k=1)
            el = sh @ Xf.T(0, -12, 0) @ Xf(euler(-70, 0, 0))
            B.limb(el, "leg", 8, 3.0, 3.4, group="cl%d" % sx, k=1)
            pz = el @ Xf.T(0, -12, 0)
            B.ell(pz, "claw", (6.5, 7.5, 5.0), group="cl%d" % sx, k=1.5, noise=(0.4, 0.5, 5))
            fu = pz @ Xf.T(0, -5, 1) @ Xf(euler(-pinch, 0, 0))
            B.cone(fu, "claw", (0, 0, 0), (0, -10, 2), 3.6, 0.6, group="cf%d" % sx, k=1)
            fl = pz @ Xf.T(0, -5, -2) @ Xf(euler(pinch, 0, 0))
            B.cone(fl, "claw", (0, 0, 0), (0, -9, -1), 2.8, 0.5, group="cf%d" % sx, k=1)
            for k in range(3):
                B.cone(at(pz, 0, 3 - k * 3, 4.2), "tip", (0, 0, 0), (0, 1.0, 3.0), 1.2, 0.2)


# ==========================================================================
# WOLF – dusk wolf (field)
# ==========================================================================


class Wolf:
    name = "wolf"
    size = (176, 120, 88, 110)
    anims = {"idle": (4, 6, True), "attack": (5, 12, False), "hurt": (2, 8, False), "cast": (4, 8, False)}

    @staticmethod
    def materials(B):
        B.mat("fur", Mat(ramp_explicit("#0c1020", "#1c2440", "#2e3c64", "#4a5e8c", "#7a92ba", "#b4c8e4"), band=0.95))
        B.mat("fur2", Mat(ramp_explicit("#2a3046", "#4e5a78", "#7c8aa8", "#aebcd4", "#e4ecf6")))
        B.mat("mane", Mat(ramp_explicit("#2a0a1a", "#4e1430", "#7a2448", "#a83a62", "#d46a8a")))
        B.mat("claw", Mat(ramp_explicit("#202020", "#4a4a4a", "#8a8a8a", "#d0d0d0", "#ffffff"), spec=0.5))
        B.mat("nose", Mat(ramp_explicit("#050508", "#101018", "#20202c", "#383848", "#606070")))
        eye_mat(B, "eye", ("#202000", "#a07000", "#ffcc20", "#fff090", "#ffffff"))

    @staticmethod
    def build(B, anim, i, n):
        t = i / max(n, 1)
        br = S(t * TAU) * 0.8 if anim == "idle" else 0
        lunge = [0, -5, 14, 16, 4][i] if anim == "attack" else (-4 if anim == "hurt" else 0)
        jump = [0, -2, 6, 2, 0][i] if anim == "attack" else 0
        pitch = [0, 10, -12, 5, 0][i] if anim == "attack" else (-10 if anim == "hurt" else (-15 if anim == "cast" else 0))
        root = Xf.T(0, 24 + br + jump, lunge) @ Xf(euler(pitch, 0, 0))
        B.ell(at(root, 0, 1, 8), "fur", (8.5, 9, 11), group="b", k=4)
        B.ell(at(root, 0, 0, -8), "fur", (7.0, 7.5, 11), group="b", k=4)
        B.ell(at(root, 0, -4, 6), "fur2", (6.5, 5, 9), group="b", k=4, order=1)
        # mane spikes
        for k in range(6):
            a = (k - 2.5) / 2.5
            B.cone(at(root, a * 5, 8, 10 - k * 2.0), "mane", (0, 0, 0), (a * 2, 5, -7), 2.6, 0.3, group="mane", k=1.2)
        # neck & head
        hd = root @ Xf.T(0, 7, 18) @ Xf(euler(-10 - pitch * 0.5 + br * 3, 0, 0))
        B.cone(at(root, 0, 3, 14), "fur", (0, 0, 0), (0, 4, 4), 6.5, 5.0, group="b", k=3)
        B.ell(at(hd, 0, 0, 0), "fur", (5.4, 5.0, 5.8), group="h", k=2)
        mo = [0, 0, 25, 30, 5][i] if anim == "attack" else (15 if anim == "cast" else 3)
        B.box(at(hd, 0, 0.0, 6.5, rx=-5), "fur", (2.8, 2.0, 4.5), rr=1.6, group="h", k=2)
        jaw = hd @ Xf.T(0, -2.5, 3) @ Xf(euler(mo, 0, 0))
        B.box(at(jaw, 0, 0, 3.5), "fur2", (2.4, 1.0, 4.0), rr=0.9, group="h", k=1)
        B.sph(at(hd, 0, 1.2, 11), "nose", 1.4)
        for sx in (-1, 1):
            B.cone(at(hd, sx * 3.2, 3.5, -1), "fur", (0, 0, 0), (sx * 2.0, 6.5, -2.5), 2.4, 0.3, group="h", k=1)
            B.ell(at(hd, sx * 3.0, 1.6, 4.4), "eye", (1.2, 0.7, 0.8), order=3)
            if mo > 10:
                B.cone(at(jaw, sx * 1.6, 1.4, 6.5), "claw", (0, 0, 0), (0, 2.0, 0), 0.6, 0.1)
        # legs
        for sx in (-1, 1):
            for front, z in ((1, 12), (0, -12)):
                ph = t * TAU + (0 if front else 3.1) + (0 if sx > 0 else 1.5)
                if anim == "attack":
                    sw = ([0, 20, -60, -40, 0][i] if front else [0, -20, 40, 30, 0][i])
                else:
                    sw = S(ph) * 4
                hp = root @ Xf.T(sx * 5.0, -3, z) @ Xf(euler(sw, 0, 0))
                B.limb(hp, "fur", 10, 3.6 if front else 4.2, 2.4, group="l%d%d" % (sx, front), k=1.5)
                kn = hp @ Xf.T(0, -10, 0) @ Xf(euler((-sw - 10) if front else (35 - sw), 0, 0))
                B.limb(kn, "fur", 9 if front else 8, 2.2, 1.7, group="l%d%d" % (sx, front), k=1.2)
                if not front:
                    an = kn @ Xf.T(0, -8, 0) @ Xf(euler(-30, 0, 0))
                    B.limb(an, "fur", 5, 1.7, 1.5, group="l%d%d" % (sx, front), k=1)
                    pw = an @ Xf.T(0, -5, 0)
                else:
                    pw = kn @ Xf.T(0, -9, 0)
                B.ell(at(pw, 0, -0.5, 1.5), "fur2", (2.2, 1.5, 3.0), group="l%d%d" % (sx, front), k=1)
        # tail
        tw = S(t * TAU) * 12
        tl = root @ Xf.T(0, 4, -17) @ Xf(euler(-120 + tw, 0, 0))
        B.cone(tl, "fur", (0, 0, 0), (0, -9, 0), 3.4, 2.6, group="t", k=1.5)
        B.cone(tl, "mane", (0, -9, 0), (0, -16, -3), 2.6, 0.5, group="t", k=1.5)


# ==========================================================================
# EMBER – floating fire spirit (bomb-like)
# ==========================================================================


class Ember:
    name = "ember"
    size = (112, 112, 56, 104)
    anims = {"idle": (6, 10, True), "attack": (5, 12, False), "hurt": (2, 8, False), "cast": (4, 8, False)}

    @staticmethod
    def materials(B):
        B.mat("core", Mat(ramp_explicit("#5a0a00", "#a82000", "#e85a00", "#ffa020", "#ffe070", "#fffbe0"), emissive=0.55, band=0.85))
        B.mat("flame", Mat(ramp_explicit("#7a1400", "#c83400", "#f87010", "#ffb030", "#fff0a0"), emissive=0.8))
        B.mat("face", Mat(ramp_explicit("#1a0000", "#3a0400", "#5a0a00", "#7a1400", "#9a2000")))
        B.mat("rock", Mat(ramp_explicit("#120a0a", "#2a1a18", "#4a3028", "#6e4c3c", "#8a6a54"), spec=0.2))

    @staticmethod
    def build(B, anim, i, n):
        t = i / max(n, 1)
        fl = S(t * TAU) * 1.5
        lunge = [0, -3, 10, 10, 2][i] if anim == "attack" else (-4 if anim == "hurt" else 0)
        swell = {"cast": 1.1 + 0.05 * S(t * TAU * 2), "attack": [1.0, 1.15, 0.95, 0.95, 1.0][i] if anim == "attack" else 1.0, "hurt": 0.9}.get(anim, 1.0)
        root = Xf.T(0, 34 + fl, lunge)
        R = 11 * swell
        B.sph(root, "core", R, group="c", k=2, noise=(0.8, 0.3, 7))
        for k in range(9):
            a = k / 9 * TAU + t * TAU / 3
            h = 10 + 4 * S(a * 2 + t * TAU * 2)
            B.cone(at(root, S(a) * R * 0.6, R * 0.4, C(a) * R * 0.6), "flame", (0, 0, 0), (S(a) * 4, h, C(a) * 4 - 2), 4.0, 0.3, group="c", k=3)
        B.cone(at(root, 0, R * 0.6, 0), "flame", (0, 0, 0), (0, 16 + fl * 2, -3), 5.0, 0.4, group="c", k=3)
        # carved face (paint)
        B.add("ell", at(root, -4.0, 2.5, R - 1.5), "face", (1.8, 2.6, 2.5), op="paint", group="c")
        B.add("ell", at(root, 4.0, 2.5, R - 1.5), "face", (1.8, 2.6, 2.5), op="paint", group="c")
        mo = 3.5 if anim in ("attack", "cast") else 2.0
        B.add("ell", at(root, 0, -4.0, R - 1.5), "face", (5.0, mo, 2.5), op="paint", group="c")
        # orbiting rocks
        for k in range(3):
            a = k / 3 * TAU + t * TAU
            B.add("box", at(root, S(a) * (R + 6), -6 + k * 3, C(a) * (R + 6), rx=a * 40, ry=a * 30), "rock", ((2.0, 1.6, 1.8), 0.6), noise=(0.4, 0.8, k))


# ==========================================================================
# WYVERN – boss
# ==========================================================================


class Wyvern:
    name = "wyvern"
    size = (352, 320, 196, 306)
    anims = {"idle": (6, 7, True), "attack": (6, 12, False), "hurt": (2, 8, False), "cast": (4, 8, False)}

    @staticmethod
    def materials(B):
        B.mat("scale", Mat(ramp_explicit("#0a1a14", "#123226", "#1e5038", "#2e7448", "#4e9c5a", "#8ccf7a"), spec=0.3, shine=10, band=0.95))
        B.mat("belly", Mat(ramp_explicit("#3a2410", "#6a4420", "#a06e34", "#d2a050", "#f6d488")))
        B.mat("wing", Mat(ramp_explicit("#1a0810", "#3a1020", "#62202c", "#923a3a", "#c86a50"), ao=0.4))
        B.mat("bone", Mat(ramp_explicit("#2a2420", "#5a5044", "#948670", "#d0c4a4", "#fff8e0"), spec=0.3))
        B.mat("claw", Mat(ramp_explicit("#141014", "#2e2830", "#5a5260", "#9a90a0", "#e0dae6"), spec=0.6))
        B.mat("armor", Mat(ramp_explicit("#1a1022", "#2c1c3c", "#46305e", "#684c86", "#9478b4"), spec=0.5, shine=14))
        eye_mat(B, "eye", ("#200000", "#9a0000", "#ff2a00", "#ffa040", "#ffffff"))
        B.mat("glow", Mat(ramp_explicit("#401000", "#a03000", "#ff7000", "#ffc040", "#ffffff"), emissive=0.8))

    @staticmethod
    def build(B, anim, i, n):
        K = 1.35  # global size
        t = i / max(n, 1)
        br = S(t * TAU) if anim == "idle" else 0
        if anim == "attack":
            rear = [0, 0.6, 1.0, -0.4, -0.5, 0][i]
            lunge = [0, -6, -8, 16, 18, 4][i]
            flap = [0, 0.6, 1.0, -0.6, -0.8, 0][i]
            jaw = [5, 10, 35, 40, 20, 5][i]
        elif anim == "cast":
            rear, lunge, flap, jaw = 0.7, -4, 0.8 + S(t * TAU * 2) * 0.2, 45
        elif anim == "hurt":
            rear, lunge, flap, jaw = -0.3, -10, -0.3, 30
        else:
            rear, lunge, flap, jaw = br * 0.08, 0, S(t * TAU) * 0.45, 6
        root = Xf(np.eye(3) * K, (0, 0, 0)) @ Xf.T(0, 52 + br * 1.2, lunge) @ Xf(euler(-rear * 12, 0, 0))

        def P(x, y, z):
            return np.array([x, y, z], dtype=float)

        def seg(a, b, r1, r2, mat="scale", group=None, k=0.0):
            B.cone(root, mat, tuple(a), tuple(b), r1, r2, group=group, k=k)

        # torso
        B.ell(at(root, 0, 0, 4), "scale", (15, 17, 20), group="b", k=6)
        B.ell(at(root, 0, -6, 7), "belly", (10.5, 12, 16), group="b", k=6, order=1)
        B.ell(at(root, 0, 6, 18), "scale", (11, 12, 11), group="b", k=6)
        # neck chain: S-curve up then forward
        nb = P(0, 12, 24)
        n1 = P(0, 26 + rear * 6, 32 - rear * 4)
        n2 = P(0, 38 + rear * 8, 36 - rear * 6)
        hp = P(0, 44 + rear * 6, 46 - rear * 8 + max(0, -rear) * 14)
        seg(nb, n1, 8.5, 7.0, group="b", k=4)
        seg(n1, n2, 7.0, 6.0, group="b", k=4)
        seg(n2, hp, 6.0, 5.5, group="b", k=4)
        for a, b in ((nb, n1), (n1, n2), (n2, hp)):
            m = (a + b) / 2
            B.cone(root, "bone", tuple(m + P(0, 1, -6.5)), tuple(m + P(0, 3, -12)), 1.8, 0.2)
        # chest belly plates along neck front
        for a, b in ((nb, n1), (n1, n2)):
            m = (a + b) / 2
            B.ell(at(root, *(m + P(0, -1, 5.0))), "belly", (4.4, 5.0, 2.5), order=1)
        hd = root @ Xf.T(*hp) @ Xf(euler(-10 + rear * 25, 0, 0))
        B.ell(at(hd, 0, 0, 0), "scale", (7.5, 6.5, 8.5), group="h", k=3)
        B.box(at(hd, 0, -0.5, 9.5), "scale", (4.8, 3.4, 7.5), rr=2.4, group="h", k=3)
        jw = hd @ Xf.T(0, -4.0, 3) @ Xf(euler(jaw, 0, 0))
        B.box(at(jw, 0, 0, 6.5), "belly", (4.2, 1.5, 7.5), rr=1.3, group="h", k=2)
        for sx in (-1, 1):
            B.cone(at(hd, sx * 4.0, 4, -3), "bone", (0, 0, 0), (sx * 3, 7, -13), 2.4, 0.4)
            B.cone(at(hd, sx * 5.5, 1, -1), "bone", (0, 0, 0), (sx * 6, -1, -8), 1.6, 0.3)
            B.ell(at(hd, sx * 4.2, 2.0, 6.5), "eye", (1.6, 1.0, 1.4), order=4)
            for k in range(4):
                B.cone(at(hd, sx * 3.4, -3.0, 7 + k * 2.4), "bone", (0, 0, 0), (0, -2.2, 0), 0.7, 0.1)
        B.ell(at(hd, 0, 5.2, 1), "armor", (3.4, 1.6, 5.5), order=2)
        if jaw > 25:
            B.sph(at(hd, 0, -3.0, 11), "glow", 3.2)
        # back plates & spikes
        for k in range(6):
            B.box(at(root, 0, 15 - k * 1.8, 14 - k * 7, rx=20), "armor", (6 - k * 0.4, 2.0, 4.0), rr=1.0, order=2)
            B.cone(at(root, 0, 17 - k * 1.7, 14 - k * 7), "bone", (0, 0, 0), (0, 7 - k * 0.6, -4), 2.4, 0.3)
        # wings: arm bones + triangle membranes, raised up & back
        for sx in (-1, 1):
            f = flap
            sh = P(sx * 9, 12, 10)
            el = P(sx * (22 + f * 4), 34 + f * 14, -4 - f * 6)
            wr = P(sx * (30 + f * 6), 60 + f * 14, -18 - f * 4)
            tips = [
                P(sx * (36 + f * 6), 72 + f * 10, -40 - f * 2),
                P(sx * (34 + f * 4), 52 + f * 6, -58),
                P(sx * (28 + f * 2), 30 + f * 2, -62 + f * 4),
                P(sx * (20), 12, -48 + f * 4),
            ]
            g = "w%d" % sx
            seg(sh, el, 3.8, 3.0, group=g, k=1)
            seg(el, wr, 3.0, 2.2, group=g, k=1)
            B.cone(root, "claw", tuple(wr), tuple(wr + P(sx * 1, 5, 4)), 1.6, 0.2)
            for tp in tips:
                seg(wr, tp, 1.5, 0.6, mat="bone")
            prev = wr
            mem = [wr] + tips + [P(sx * 8, 8, -14)]
            for a_, b_ in zip(mem[1:-1], mem[2:]):
                B.add("tri", root, "wing", (tuple(wr), tuple(a_), tuple(b_), 0.6), group="m%d" % sx, k=0.6)
            B.add("tri", root, "wing", (tuple(sh), tuple(el), tuple(mem[-1]), 0.6), group="m%d" % sx, k=0.6)
            B.add("tri", root, "wing", (tuple(el), tuple(wr), tuple(mem[-1]), 0.6), group="m%d" % sx, k=0.6)
        # legs
        for sx in (-1, 1):
            hpx = P(sx * 11, -6, -2)
            kn = P(sx * 13, -18, 12 + rear * 4)
            an = P(sx * 12, -36, 0 + rear * 4)
            ft = P(sx * 12, -50 - br * 1.2 + rear * 4, 6)
            seg(hpx, kn, 9, 6, group="lg%d" % sx, k=3)
            seg(kn, an, 5, 3.6, group="lg%d" % sx, k=2)
            seg(an, ft, 3.6, 3.0, group="lg%d" % sx, k=2)
            B.ell(at(root, *(ft + P(0, -1, 3))), "scale", (4.4, 2.6, 6), group="lg%d" % sx, k=2)
            for c in (-1, 0, 1):
                B.cone(root, "claw", tuple(ft + P(c * 2.6, -1, 7)), tuple(ft + P(c * 3.2, -3.5, 11)), 1.2, 0.2)
            B.cone(root, "armor", tuple(kn + P(0, 0, 4)), tuple(kn + P(0, 3, 9)), 2.6, 0.4)
        # tail curling on the ground behind
        pts = [P(0, -2, -14)]
        for k in range(6):
            w = S(t * TAU + k * 0.8) * 3
            pts.append(P(w * (k / 6), -12 - k * 6.5 + k * k * 0.6, -24 - k * 9))
        for k in range(6):
            r1 = 9 - k * 1.3
            seg(pts[k], pts[k + 1], max(r1, 1.2), max(r1 - 1.3, 0.8), group="t", k=3)
            B.cone(root, "bone", tuple(pts[k] + P(0, r1 - 1, 0)), tuple(pts[k] + P(0, r1 + 3, -3)), 1.6, 0.2)
        B.cone(root, "bone", tuple(pts[-1]), tuple(pts[-1] + P(0, 4, -8)), 2.6, 0.2)


BESTIARY = {"imp": Imp, "crawler": Crawler, "wolf": Wolf, "ember": Ember, "wyvern": Wyvern}
