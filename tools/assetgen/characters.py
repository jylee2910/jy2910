"""Hero / NPC definitions.

Each character exposes build(W, B, opts) that adds SDF primitives for the
given solved skeleton W, and some metadata (eye colours, ramps).
"""
import numpy as np

from humanoid import SKIN_LIGHT, SKIN_PALE, SKIN_WARM, Builder, arm, at, head, leg, std_mats, torso
from sdf import Mat, Xf, euler, ramp, ramp_explicit

METAL_SILVER = ramp_explicit("#1f2440", "#3a4566", "#5d6d92", "#8798b8", "#b9c6dc", "#eef3fa")
METAL_GOLD = ramp_explicit("#4a2a1a", "#8a5424", "#c98d33", "#ecc25a", "#fff0a8")
METAL_DARK = ramp_explicit("#15141f", "#2a2838", "#45435a", "#6c6b84", "#a2a3bb")
LEATHER = ramp_explicit("#2a1712", "#4d2c1e", "#74462c", "#9b6740", "#c08d5c")
LEATHER_DARK = ramp_explicit("#17101a", "#2b1d26", "#433039", "#5f4850", "#7e6669")
CLOTH_BLACK = ramp_explicit("#0e0c16", "#1d1a2a", "#2f2b42", "#47405e", "#665d80")
CLOTH_WHITE = ramp_explicit("#5d6182", "#9598b5", "#c4c7dc", "#e7e9f3", "#ffffff")


def mats_metal(B, name, r, spec=0.55):
    B.mat(name, Mat(r, spec=spec, shine=18, band=0.9))


# ========================================================================
# KAEL – blond knight captain of the royal air fleet (lead)
# ========================================================================


class Kael:
    name = "kael"
    eye = ramp_explicit("#1d2a5e", "#3c6fd8", "#7fb4ff")
    eye_style = "normal"

    @staticmethod
    def materials(B):
        std_mats(B, SKIN_LIGHT)
        B.mat("hair", Mat(ramp_explicit("#6b3d1c", "#a8692a", "#d9a443", "#f3d36f", "#fff2b0"), spec=0.35, shine=10, band=0.85))
        B.mat("red", Mat(ramp_explicit("#3c0b18", "#6e1424", "#a8222c", "#d9443a", "#f57b5c"), band=0.9))
        B.mat("redlight", Mat(ramp_explicit("#4a0f1c", "#87202a", "#c43a36", "#ee6a4e", "#ffa078")))
        mats_metal(B, "steel", METAL_SILVER)
        mats_metal(B, "gold", METAL_GOLD, 0.6)
        B.mat("blue", Mat(ramp_explicit("#0f1838", "#1d2f66", "#2f4f9a", "#4f7ac8", "#86aee8")))
        B.mat("black", Mat(CLOTH_BLACK))
        B.mat("leather", Mat(LEATHER))
        B.mat("blade", Mat(ramp_explicit("#26304e", "#4a5d86", "#7f9ac2", "#bcd2ec", "#f2f8ff"), spec=0.7, shine=26))
        B.mat("gem", Mat(ramp_explicit("#3a0820", "#8a1238", "#e0285a", "#ff6a8a", "#ffd0dc"), spec=0.9, shine=20, emissive=0.25))

    @staticmethod
    def build(W, B, o):
        head(B, W)
        # --- hair: spiky blond -----------------------------------------
        h = W["head"]
        B.ell(at(h, 0, 9.0, -0.8), "hair", (7.9, 6.0, 7.8), group="hair", k=1.2)
        B.ell(at(h, 0, 6.5, -3.2), "hair", (7.6, 6.8, 5.2), group="hair", k=1.2)
        spikes = [
            # (start xyz, end xyz, r)
            ((0, 12, 1), (1.5, 17.5, -1.5), 3.0),
            ((-3, 11.5, 0), (-7.5, 15.5, -2.5), 2.6),
            ((3, 11.5, 0), (8.0, 14.0, -3.0), 2.5),
            ((-1, 10, -4), (-3, 13, -10.5), 2.6),
            ((2.5, 9, -4), (5.5, 9.5, -10.5), 2.4),
            ((-4.5, 8, -3), (-9.5, 6.5, -6.0), 2.2),
            ((4.5, 8, -3), (9.5, 7.5, -6.5), 2.2),
            ((0, 7, -5), (0.5, 3.0, -10.0), 2.3),
            # fringe over forehead
            ((-3.0, 10.5, 4.5), (-4.6, 5.8, 7.4), 2.0),
            ((0.5, 11.0, 5.0), (0.8, 6.8, 8.0), 2.1),
            ((3.4, 10.2, 4.5), (5.2, 6.4, 7.0), 1.9),
            # side locks
            ((-6.6, 8.0, 2.0), (-7.4, 2.0, 3.2), 1.7),
            ((6.6, 8.0, 2.0), (7.4, 2.0, 3.2), 1.7),
        ]
        for a, b, r in spikes:
            B.cone(h, "hair", a, b, r, 0.35, group="hair", k=1.0)
        # --- torso: red tunic, steel breastplate ------------------------
        torso(B, W, "black", "red", "red", chest=(5.8, 5.6, 3.9))
        B.ell(at(W["chest"], 0, 3.6, 0.9), "steel", (6.2, 5.0, 3.9), group="plate", k=1.0)
        B.box(at(W["chest"], 0, 4.5, 4.2), "gold", (1.2, 2.5, 0.6), rr=0.5)  # crest
        B.sph(at(W["chest"], 0, 4.8, 4.8), "gem", 1.1)
        # tabard skirt: tapered
        B.add("cyl", at(W["pelvis"], 0, -3.5, 0), "red", (4.8, 5.4, 1.0), taper=(-4.8, 4.8, 1.25, 0.95), group="skirt", k=0.5)
        B.add("box", at(W["pelvis"], 0, -3.2, 0), "red", ((6.5, 6.0, 6.5), 0.1), op="int", group="skirt")
        # belt
        B.add("cyl", at(W["pelvis"], 0, 1.4, 0), "leather", (1.0, 5.6, 0.4))
        B.box(at(W["pelvis"], 0, 1.4, 5.3), "gold", (1.4, 1.1, 0.5), rr=0.4)
        # scarf: big red scarf around neck, tail flowing behind
        B.add("torus", at(W["neck"], 0, 1.8, 0.2, rx=8), "redlight", (3.6, 2.1))
        sw = o.get("scarf", 0.3)
        B.cone(at(W["chest"], -2.0, 6.5, -3.5), "redlight", (0, 0, 0), (-4.0 - sw * 3, -9.0 + sw * 4, -6.0 - sw * 4), 2.2, 1.4, group="scarf", k=1.2)
        B.cone(at(W["chest"], 1.0, 6.5, -3.5), "redlight", (0, 0, 0), (2.0 - sw * 2, -12.0 + sw * 5, -5.5 - sw * 5), 2.0, 1.2, group="scarf", k=1.2)
        # --- shoulders
        for s, sx in (("r", -1), ("l", 1)):
            B.ell(at(W["sh_" + s], 0.0, 0.8, 0.0), "steel", (3.6, 3.0, 3.6), order=1)
            B.ell(at(W["sh_" + s], 0.4 * sx, 0.2, 0.0), "gold", (3.3, 1.0, 3.3), order=0, group="trim" + s)
            arm(B, W, s, "black", "black", glove="leather")
            B.limb(at(W["el_" + s], 0, -2.0, 0), "steel", 4.8, 2.35, 2.0, order=2)
            leg(B, W, s, "black", "black", "leather", boot_top=2.7)
            B.ell(at(W["kn_" + s], 0, 0, 1.0), "steel", (2.4, 2.4, 2.0), order=2)
        # --- weapon: broadsword in right hand
        if o.get("show_weapon", True):
            sword_broad(B, weapon_xf(W, o), 23)


def weapon_xf(W, o, hand="l", grip=1.8):
    """Weapon frame: local +y = blade direction, local z = flat of blade.

    pose key 'aim' = angle in the character's sagittal plane (0 forward,
    90 up, -90 down, 180 back), 'aim_yaw' twists it toward the camera side.
    'sheathed' puts it diagonally on the back."""
    root = W["root"]
    if o.get("sheathed"):
        c = W["chest"]
        return c @ Xf.T(0, 3.5, -4.6) @ Xf(euler(0, 0, 32)) @ Xf.T(0, -9, 0)
    a = np.radians(o.get("aim", 20))
    d = np.array([0, np.sin(a), np.cos(a)])
    from sdf import ry as _ry

    d = _ry(o.get("aim_yaw", 0)) @ d
    d = root.R @ d
    xa = root.R @ (_ry(o.get("aim_yaw", 0)) @ np.array([1.0, 0, 0]))
    xa = xa - d * (xa @ d)
    xa /= np.linalg.norm(xa)
    za = np.cross(xa, d)
    R = np.stack([za, d, xa], axis=1)  # local x -> za (flat faces camera at side views), local z -> xa
    hand_xf = W["wr_" + hand]
    p = hand_xf.apply(np.array([0, -grip, 0.3]))
    return Xf(R, p - d * 2.0)


def sword_broad(B, xf, L=19):
    # grip along +y -> blade along +y
    B.limb(at(xf, 0, 3.0, 0), "leather", 5.0, 0.8, 0.8)
    B.sph(at(xf, 0, -2.6, 0), "gold", 1.2)
    B.box(at(xf, 0, 3.3, 0), "gold", (3.6, 0.9, 1.0), rr=0.5)
    B.sph(at(xf, 0, 3.4, 0.9), "gem", 0.8)
    B.box(at(xf, 0, 4.0 + L / 2, 0), "blade", (2.4, L / 2, 0.55), rr=0.4, taper=(-L / 2, L / 2, 1.0, 0.7), group="blade")
    B.box(at(xf, 0, 4.0 + L / 2, 0.45), "gold", (0.45, L / 2 - 2.0, 0.25), rr=0.2, order=3)
    B.add("cone", at(xf, 0, 4.0 + L, 0), "blade", ((0, -1, 0), (0, 2.8, 0), 1.0, 0.1), group="blade", k=0.6)



# ========================================================================
# ARGEN – stoic black-haired swordsman, long coat, katana
# ========================================================================


class Argen:
    name = "argen"
    style = "katana"
    eye = ramp_explicit("#2a0f3a", "#8a3fc8", "#c99bff")
    eye_style = "narrow"

    @staticmethod
    def materials(B):
        std_mats(B, SKIN_PALE)
        B.mat("hair", Mat(ramp_explicit("#050409", "#0e0c18", "#1b1a2e", "#2c2d4a", "#545c8a"), spec=0.6, shine=12, band=0.8))
        B.mat("coat", Mat(ramp_explicit("#120a1e", "#24143a", "#3a2259", "#56347f", "#7e55a8"), band=0.95))
        B.mat("coatin", Mat(ramp_explicit("#2a0a12", "#4e1020", "#781a30", "#a3304a", "#c85870")))
        B.mat("black", Mat(CLOTH_BLACK))
        mats_metal(B, "steel", METAL_SILVER)
        mats_metal(B, "darksteel", METAL_DARK, 0.4)
        B.mat("white", Mat(CLOTH_WHITE))
        B.mat("leather", Mat(LEATHER_DARK))
        B.mat("blade", Mat(ramp_explicit("#202a44", "#44557c", "#7b92ba", "#c0d4ee", "#ffffff"), spec=0.9, shine=34))
        B.mat("gold", Mat(METAL_GOLD, spec=0.5, shine=16))
        B.mat("gem", Mat(ramp_explicit("#1a0838", "#3c1580", "#6a32d0", "#a070ff", "#e2d0ff"), spec=0.9, shine=20, emissive=0.3))

    @staticmethod
    def build(W, B, o):
        head(B, W, hw=7.0)
        h = W["head"]
        # sleek long black hair with long fringe over one eye and ponytail
        B.ell(at(h, 0, 8.6, -0.6), "hair", (7.8, 6.4, 7.8), group="hair", k=1.4)
        B.ell(at(h, 0, 5.6, -3.2), "hair", (7.4, 7.6, 5.4), group="hair", k=1.4)
        for a, b, r in [
            ((-2.5, 11.0, 5.0), (-5.6, 3.4, 7.4), 2.3),
            ((1.0, 11.4, 5.4), (-0.6, 5.8, 8.0), 2.0),
            ((4.0, 10.6, 4.4), (6.0, 4.8, 6.6), 1.9),
            ((-6.6, 8.5, 2.0), (-7.4, -1.0, 2.0), 2.0),
            ((6.6, 8.5, 2.0), (7.2, -0.5, 1.6), 1.9),
        ]:
            B.cone(h, "hair", a, b, r, 0.4, group="hair", k=1.0)
        # ponytail (tied high, falls down back)
        B.add("torus", at(h, 0, 9.5, -7.4, rx=70), "gold", (1.4, 0.7))
        sw = o.get("scarf", 0.3)
        B.cone(at(h, 0, 9.5, -7.6), "hair", (0, 0, 0), (0, -6, -4.5 - sw * 2), 2.4, 2.0, group="tail", k=1.5)
        B.cone(at(h, 0, 9.5, -7.6), "hair", (0, -6, -4.5 - sw * 2), (0.4, -17 + sw * 3, -6.5 - sw * 5), 2.0, 0.5, group="tail", k=1.5)
        # body: dark undersuit, long open coat
        torso(B, W, "black", "black", "black", chest=(5.6, 5.6, 3.8))
        B.ell(at(W["chest"], 0, 3.0, 0.0), "coat", (6.3, 6.1, 4.3), group="coat", k=1.5)
        B.add("box", at(W["chest"], 0, 3.0, 4.3), "black", ((2.0, 6.5, 1.0), 0.2), group="coat", op="sub")
        B.box(at(W["chest"], 0, 6.8, 2.5, rx=-15), "white", (3.4, 1.4, 1.6), rr=0.8)  # cravat collar
        B.add("torus", at(W["neck"], 0, 0.8, 0), "coat", (3.3, 1.4))
        B.ell(at(W["neck"], 0, 2.6, -2.6), "coat", (4.6, 3.2, 1.6))  # high collar
        # long coat tails – flared cone from waist to calves, open at the front
        flare = o.get("scarf", 0.3)
        B.add("cyl", at(W["pelvis"], 0, -6.5, -0.3 - flare), "coat", (8.5, 6.4, 0.8), taper=(-8.5, 8.5, 1.35 + flare * 0.15, 0.85), group="tails", k=0.5)
        B.add("cyl", at(W["pelvis"], 0, -6.5, -0.3 - flare), "coat", (9.5, 5.3, 0.4), taper=(-8.5, 8.5, 1.25 + flare * 0.15, 0.75), group="tails", op="sub")
        B.add("box", at(W["pelvis"], 0, -6.5, 6.5), "coat", ((2.8, 10, 4.5), 0.5), group="tails", op="sub")
        B.add("cyl", at(W["pelvis"], 0, 1.0, 0), "leather", (0.9, 5.4, 0.3))
        B.box(at(W["pelvis"], 2.5, 1.0, 5.0), "steel", (1.0, 0.9, 0.4), rr=0.3)
        for s, sx in (("r", -1), ("l", 1)):
            B.ell(at(W["sh_" + s], 0.0, 0.6, 0.0), "coat", (3.2, 2.8, 3.3), order=1)
            B.ell(at(W["sh_" + s], 0.0, 1.4, 0.0), "darksteel", (3.0, 1.4, 3.0), order=2)
            arm(B, W, s, "coat", "coat", glove="leather", r=(2.4, 2.2, 2.2, 2.0))
            B.limb(at(W["el_" + s], 0, -4.0, 0), "coatin", 3.0, 2.5, 2.4, order=2)  # cuff
            leg(B, W, s, "black", "black", "leather", r=(2.8, 2.3, 2.2, 1.8), boot_top=2.5)
        # scabbard at left hip
        sc = at(W["pelvis"], 5.2, 0.5, 1.0, rx=-110, rz=8)
        B.box(at(sc, 0, 8.0, 0), "darksteel", (1.0, 9.0, 0.7), rr=0.5)
        if o.get("show_weapon", True) and not o.get("sheathed"):
            katana(B, weapon_xf(W, o))
        else:
            B.box(at(sc, 0, -2.2, 0), "gold", (1.5, 0.4, 1.2), rr=0.3)
            B.limb(at(sc, 0, -2.4, 0), "black", 4.5, 0.8, 0.8)


def katana(B, xf, L=24):
    B.limb(at(xf, 0, 3.2, 0), "black", 5.5, 0.8, 0.8)
    B.add("cyl", at(xf, 0, 3.4, 0), "gold", (0.35, 1.8, 0.2))
    B.box(at(xf, 0, 3.8 + L / 2, 0), "blade", (1.25, L / 2, 0.35), rr=0.3, taper=(-L / 2, L / 2, 1.0, 0.8), group="blade")
    B.add("cone", at(xf, 0, 3.8 + L, 0), "blade", ((0, -1, 0), (0, 2.0, 0), 0.9, 0.1), group="blade", k=0.5)


# ========================================================================
# MIRA – young white mage, long pale hair, staff
# ========================================================================


class Mira:
    name = "mira"
    style = "staff"
    eye = ramp_explicit("#3a0f2e", "#d0407a", "#ff9ec4")
    eye_style = "big"
    skeleton = {"sh_r": (-6.0, 6.0, 0), "sh_l": (6.0, 6.0, 0), "hip_r": (-3.1, -1, 0), "hip_l": (3.1, -1, 0)}
    skscale = 0.94

    @staticmethod
    def materials(B):
        std_mats(B, SKIN_PALE)
        B.mat("hair", Mat(ramp_explicit("#6a3a52", "#b06c88", "#e2a6bb", "#f6d2dc", "#fff4f4"), spec=0.4, shine=10, band=0.9))
        B.mat("dress", Mat(CLOTH_WHITE))
        B.mat("blue", Mat(ramp_explicit("#0c2340", "#1a4878", "#2e76b0", "#58a8dc", "#a6dcf6")))
        B.mat("gold", Mat(METAL_GOLD, spec=0.5, shine=16))
        B.mat("pink", Mat(ramp_explicit("#4a1030", "#8a2050", "#c8407a", "#ec78a4", "#ffb8d2")))
        B.mat("wood", Mat(ramp_explicit("#2a160e", "#4c2a18", "#74462a", "#9e6c40", "#c69a64")))
        B.mat("crystal", Mat(ramp_explicit("#103a5a", "#2a78b0", "#5ec2ee", "#b0eeff", "#ffffff"), spec=0.9, shine=14, emissive=0.45))
        B.mat("tights", Mat(ramp_explicit("#1a1530", "#2d2650", "#463c74", "#635690", "#8478ac")))
        B.mat("boot", Mat(CLOTH_WHITE))

    @staticmethod
    def build(W, B, o):
        head(B, W, hw=7.4, hh=7.5)
        h = W["head"]
        B.ell(at(h, 0, 8.8, -0.6), "hair", (8.2, 6.4, 8.1), group="hair", k=1.5)
        B.ell(at(h, 0, 5.4, -3.0), "hair", (8.0, 7.8, 5.8), group="hair", k=1.5)
        for a, b, r in [
            ((-3.2, 11.0, 5.2), (-4.4, 6.2, 7.6), 2.2),
            ((0.0, 11.4, 5.6), (0.4, 6.6, 8.2), 2.2),
            ((3.4, 11.0, 5.0), (4.6, 6.4, 7.4), 2.1),
            ((-7.0, 8.5, 0.2), (-7.6, 0.0, 0.6), 1.6),
            ((7.0, 8.5, 0.2), (7.6, 0.0, 0.6), 1.6),
        ]:
            B.cone(h, "hair", a, b, r, 0.8, group="hair", k=1.2)
        # long hair down the back (waist length)
        sw = o.get("scarf", 0.3)
        B.cone(at(h, 0, 6.0, -4.6), "hair", (0, 0, 0), (0, -16 + sw * 2, -3.5 - sw * 3), 6.6, 3.0, group="long", k=1.5)
        # ribbon
        B.ell(at(h, 5.0, 11.0, -3.5, rz=-30), "pink", (2.6, 1.6, 1.2))
        B.ell(at(h, 7.2, 12.5, -3.8, rz=-30), "pink", (2.4, 1.3, 1.0))
        B.ell(at(h, 3.2, 12.6, -3.6, rz=-30), "pink", (2.4, 1.3, 1.0))
        # dress
        torso(B, W, "dress", "dress", "dress", chest=(5.0, 5.4, 3.6), waist=(4.2, 4.0, 3.2))
        B.ell(at(W["chest"], 0, 4.4, 1.4), "blue", (5.2, 3.6, 3.2), group="vest", k=1.0)
        B.box(at(W["chest"], 0, 4.0, 4.4), "gold", (0.8, 2.6, 0.5), rr=0.4)
        B.add("torus", at(W["neck"], 0, 0.4, 0.3), "gold", (3.0, 0.8))
        # cape-collar
        B.ell(at(W["chest"], 0, 7.0, -1.0), "blue", (6.6, 2.4, 4.4), group="collar", k=1.0)
        # skirt: wide bell
        fl = o.get("scarf", 0.3)
        B.add("cyl", at(W["pelvis"], 0, -5.0, -fl * 0.6), "dress", (6.0, 7.6, 1.2), taper=(-6.0, 6.0, 1.3 + fl * 0.1, 0.7), group="skirt", k=0.5)
        B.add("cyl", at(W["pelvis"], 0, -10.6, -fl * 0.6), "blue", (0.8, 9.6, 0.5), group="skirt", order=2, op="paint")
        B.add("cyl", at(W["pelvis"], 0, 1.0, 0), "gold", (0.8, 4.5, 0.3))
        for s, sx in (("r", -1), ("l", 1)):
            B.ell(at(W["sh_" + s], 0, 0.4, 0), "dress", (2.8, 2.6, 2.8), order=1)
            arm(B, W, s, "dress", "dress", r=(2.0, 1.8, 1.8, 2.2), hand=1.7)
            B.limb(at(W["el_" + s], 0, -3.6, 0), "blue", 3.0, 2.2, 2.6, order=2)  # wide sleeve cuff
            leg(B, W, s, "tights", "tights", "boot", r=(2.6, 2.1, 2.0, 1.6), boot=(2.0, 1.4, 3.0), boot_top=2.2)
        if o.get("show_weapon", True) and not o.get("sheathed"):
            staff(B, weapon_xf(W, o, grip=1.6))
        else:
            staff(B, W["chest"] @ Xf.T(0, 3.0, -5.2) @ Xf(euler(0, 0, -28)) @ Xf.T(0, -12, 0), short=True)


def staff(B, xf, short=False):
    L = 26 if not short else 24
    B.limb(at(xf, 0, L - 6, 0), "wood", L, 0.85, 0.75)
    B.add("torus", at(xf, 0, L - 3.0, 0, rx=90), "gold", (2.9, 0.6))
    B.add("torus", at(xf, 0, L - 3.0, 0, rx=90, ry=90), "gold", (2.9, 0.5))
    B.ell(at(xf, 0, L - 3.0, 0), "crystal", (1.6, 2.4, 1.6))
    B.box(at(xf, 0, L - 6.5, 0), "gold", (1.3, 0.6, 1.3), rr=0.4)


# ========================================================================
# NELL – red-haired young tinkerer, goggles, mechanical hammer
# ========================================================================


class Nell:
    name = "nell"
    style = "dagger"
    eye = ramp_explicit("#3a1a08", "#d07a1a", "#ffc860")
    eye_style = "big"
    skeleton = {"sh_r": (-5.8, 5.6, 0), "sh_l": (5.8, 5.6, 0), "hip_r": (-3.0, -1, 0), "hip_l": (3.0, -1, 0), "chest": (0, 7.2, 0)}
    skscale = 0.86

    @staticmethod
    def materials(B):
        std_mats(B, SKIN_WARM)
        B.mat("hair", Mat(ramp_explicit("#3a0a0e", "#7a1a14", "#b8341c", "#e86230", "#ffa060"), spec=0.35, shine=10, band=0.9))
        B.mat("orange", Mat(ramp_explicit("#3a1406", "#74300c", "#b25a14", "#e08c2c", "#ffc46a")))
        B.mat("green", Mat(ramp_explicit("#0c2018", "#173a2a", "#25583e", "#3c7c56", "#64a478")))
        B.mat("leather", Mat(LEATHER))
        B.mat("brass", Mat(METAL_GOLD, spec=0.6, shine=18))
        mats_metal(B, "steel", METAL_SILVER)
        B.mat("lens", Mat(ramp_explicit("#0a2a3a", "#1a5a7a", "#40a0c8", "#90e0ff", "#ffffff"), spec=1.0, shine=20, emissive=0.2))
        B.mat("white", Mat(CLOTH_WHITE))

    @staticmethod
    def build(W, B, o):
        head(B, W, hw=7.6, hh=7.6)
        h = W["head"]
        B.ell(at(h, 0, 9.0, -0.4), "hair", (8.3, 6.2, 8.2), group="hair", k=1.4)
        B.ell(at(h, 0, 6.4, -3.4), "hair", (8.0, 6.8, 5.6), group="hair", k=1.4)
        for a, b, r in [
            ((-3.5, 11.0, 4.8), (-6.0, 6.6, 7.6), 2.3),
            ((0.0, 11.6, 5.2), (1.6, 6.8, 8.2), 2.3),
            ((3.6, 11.0, 4.6), (6.4, 7.0, 7.0), 2.0),
            ((-1.0, 13.0, -1.0), (-2.5, 17.5, -4.0), 2.4),
            ((2.0, 12.5, -3.0), (6.0, 15.0, -7.0), 2.2),
            ((-4.0, 9.0, -4.5), (-8.5, 8.0, -9.0), 2.4),
            ((3.0, 8.0, -5.0), (6.0, 5.0, -10.0), 2.3),
            ((-7.2, 7.5, 1.0), (-8.2, 2.0, 2.0), 1.8),
            ((7.2, 7.5, 1.0), (8.2, 2.0, 2.0), 1.8),
        ]:
            B.cone(h, "hair", a, b, r, 0.5, group="hair", k=1.0)
        # goggles on forehead
        B.add("torus", at(h, 0, 10.6, 0.0, rx=-12), "leather", (8.2, 0.8))
        for gx in (-3.0, 3.0):
            B.add("cyl", at(h, gx, 11.4, 6.8, rx=72), "brass", (1.0, 2.4, 0.4), order=2)
            B.ell(at(h, gx, 11.5, 7.6, rx=72), "lens", (1.8, 0.6, 1.8), order=3)
        # body: green jacket, orange scarf, shorts
        torso(B, W, "green", "white", "leather", chest=(5.2, 5.0, 3.6), waist=(4.4, 3.8, 3.2), pelvis=(5.0, 3.4, 3.6))
        B.add("torus", at(W["neck"], 0, 1.0, 0.2), "orange", (3.1, 1.8))
        sw = o.get("scarf", 0.3)
        B.cone(at(W["chest"], 2.0, 6.2, -3.0), "orange", (0, 0, 0), (3.0 - sw * 2, -6.0 + sw * 3, -4.5 - sw * 4), 1.8, 1.2)
        # big tool belt with pouches
        B.add("cyl", at(W["pelvis"], 0, 1.4, 0), "leather", (1.1, 5.4, 0.4))
        B.box(at(W["pelvis"], -4.6, 0.0, 2.4), "leather", (1.6, 1.8, 1.3), rr=0.6)
        B.box(at(W["pelvis"], 4.8, -0.2, 1.0), "leather", (1.4, 1.9, 1.6), rr=0.6)
        B.box(at(W["pelvis"], 0, 1.4, 4.9), "brass", (1.2, 1.0, 0.4), rr=0.3)
        for s, sx in (("r", -1), ("l", 1)):
            arm(B, W, s, "green", "white", glove="leather", r=(2.2, 2.0, 1.8, 1.6), hand=2.0)
            B.limb(at(W["el_" + s], 0, -3.5, 0), "leather", 3.4, 2.2, 2.2, order=2)
            leg(B, W, s, "leather", "skin", "orange", r=(2.8, 2.4, 2.0, 1.7), boot=(2.4, 1.8, 3.4), boot_top=2.6)
        if o.get("show_weapon", True) and not o.get("sheathed"):
            hammer(B, weapon_xf(W, o, grip=1.6))
        else:
            hammer(B, W["chest"] @ Xf.T(0, 2.0, -4.6) @ Xf(euler(0, 0, 40)) @ Xf.T(0, -6, 0))


def hammer(B, xf):
    B.limb(at(xf, 0, 9.0, 0), "leather", 11.0, 0.8, 0.8)
    B.add("cyl", at(xf, 0, 11.5, 0, rz=90), "steel", (4.6, 3.2, 0.8), order=1)
    B.add("cyl", at(xf, 3.6, 11.5, 0, rz=90), "brass", (0.8, 3.5, 0.3), order=2)
    B.add("cyl", at(xf, -3.6, 11.5, 0, rz=90), "brass", (0.8, 3.5, 0.3), order=2)
    B.add("cyl", at(xf, 0, 11.5, 0), "brass", (3.4, 1.2, 0.3), order=2)
    B.sph(at(xf, 0, -2.4, 0), "brass", 1.1)



# ========================================================================
# NPCs
# ========================================================================


class King:
    name = "king"
    style = "royal"
    battle = False
    eye = ramp_explicit("#1a1a2a", "#4a5a7a", "#8a9aba")
    eye_style = "narrow"

    @staticmethod
    def materials(B):
        std_mats(B, SKIN_WARM)
        B.mat("hair", Mat(ramp_explicit("#5a5e72", "#8e93a8", "#c2c6d4", "#e6e8f0", "#ffffff"), band=0.9))
        B.mat("robe", Mat(ramp_explicit("#2a0410", "#55081c", "#8a1428", "#bc2a36", "#e2584e")))
        B.mat("fur", Mat(ramp_explicit("#6e6a80", "#a8a4b8", "#d4d2de", "#f0eff5", "#ffffff"), ao=1.2))
        B.mat("gold", Mat(METAL_GOLD, spec=0.6, shine=16))
        B.mat("gem", Mat(ramp_explicit("#06203a", "#10508a", "#2a90d8", "#7ad0ff", "#e0f6ff"), spec=0.9, emissive=0.3))
        B.mat("cloth", Mat(ramp_explicit("#1a1430", "#2e2650", "#463c74", "#635690", "#8478ac")))

    @staticmethod
    def build(W, B, o):
        head(B, W, hw=7.2)
        h = W["head"]
        B.ell(at(h, 0, 8.4, -1.4), "hair", (7.7, 5.6, 7.4), group="hair", k=1.2)
        B.ell(at(h, 0, 5.0, -3.6), "hair", (7.6, 6.6, 4.8), group="hair", k=1.2)
        # beard & moustache
        B.ell(at(h, 0, 2.0, 4.2), "hair", (5.6, 4.6, 3.6), group="beard", k=1.5)
        B.cone(at(h, 0, 1.0, 5.0), "hair", (0, 0, 0), (0, -6.5, 1.5), 4.2, 1.6, group="beard", k=1.5)
        B.ell(at(h, 0, 4.4, 6.6), "hair", (3.4, 1.0, 1.2), group="beard", k=0.6)
        # brows
        B.ell(at(h, -2.8, 7.0, 6.6), "hair", (1.8, 0.6, 0.8))
        B.ell(at(h, 2.8, 7.0, 6.6), "hair", (1.8, 0.6, 0.8))
        # crown
        B.add("cyl", at(h, 0, 13.4, -0.8), "gold", (1.6, 5.4, 0.3), group="crown", k=0.3)
        B.add("cyl", at(h, 0, 13.4, -0.8), "gold", (2.0, 4.6, 0.0), group="crown", op="sub")
        for k in range(6):
            import math
            a = k / 6 * 2 * math.pi
            B.cone(at(h, 5.2 * math.sin(a), 14.6, -0.8 + 5.2 * math.cos(a)), "gold", (0, 0, 0), (0, 2.8, 0), 0.8, 0.2, group="crown", k=0.3)
        B.sph(at(h, 0, 13.4, 4.6), "gem", 1.0)
        # body: big robe
        torso(B, W, "cloth", "cloth", "cloth", chest=(6.4, 6.0, 4.6), waist=(6.0, 4.6, 4.6), pelvis=(6.2, 4.0, 4.6))
        B.add("cyl", at(W["pelvis"], 0, -10.0, 0), "robe", (11.0, 7.4, 1.4), taper=(-11, 11, 1.35, 0.85), group="robe", k=0.6)
        B.ell(at(W["chest"], 0, 2.5, 0), "robe", (7.0, 7.5, 5.0), group="robe", k=1.0)
        B.add("box", at(W["chest"], 0, -2, 5.2), "cloth", ((2.2, 20, 2.0), 0.4), group="robe", op="sub")
        B.ell(at(W["chest"], 0, 7.4, -0.4), "fur", (8.2, 3.0, 5.6), group="fur", k=1.0)
        B.add("torus", at(W["chest"], 0, 4.0, 0.4, rx=-10), "gold", (5.0, 0.6))
        B.sph(at(W["chest"], 0, 2.0, 5.2), "gem", 1.1)
        for s in ("r", "l"):
            arm(B, W, s, "robe", "robe", r=(2.6, 2.4, 2.4, 3.0))
            B.limb(at(W["el_" + s], 0, -4.6, 0), "fur", 2.0, 3.2, 3.2, order=2)
            leg(B, W, s, "cloth", "cloth", "gold", boot=(2.2, 1.5, 3.0))


class Soldier:
    name = "soldier"
    style = "sword"
    battle = False
    eye = ramp_explicit("#1a1a2a", "#3a3a4a", "#6a6a7a")
    eye_style = "narrow"

    @staticmethod
    def materials(B):
        std_mats(B, SKIN_LIGHT)
        mats_metal(B, "steel", METAL_SILVER)
        B.mat("blue", Mat(ramp_explicit("#0c1430", "#1a2a5c", "#2c468e", "#4a6cbc", "#82a2e2")))
        B.mat("leather", Mat(LEATHER))
        B.mat("black", Mat(CLOTH_BLACK))
        B.mat("hair", Mat(LEATHER))
        B.mat("gold", Mat(METAL_GOLD, spec=0.5))
        B.mat("blade", Mat(ramp_explicit("#26304e", "#4a5d86", "#7f9ac2", "#bcd2ec", "#f2f8ff"), spec=0.7, shine=26))
        B.mat("red", Mat(ramp_explicit("#3c0b18", "#6e1424", "#a8222c", "#d9443a", "#f57b5c")))

    @staticmethod
    def build(W, B, o):
        head(B, W)
        h = W["head"]
        # helmet with nose guard and plume
        B.ell(at(h, 0, 8.4, -0.4), "steel", (8.0, 6.6, 8.0), group="helm", k=1.0)
        B.add("box", at(h, 0, 3.2, 7.0), "steel", ((5.4, 3.4, 3.0), 0.5), group="helm", op="sub", k=0.6)
        B.add("torus", at(h, 0, 6.6, -0.4), "gold", (7.6, 0.7))
        B.cone(at(h, 0, 13.5, -1.0), "red", (0, 0, 0), (0, 1.0, -8.0), 1.8, 1.2, group="plume", k=1.0)
        B.cone(at(h, 0, 13.5, -1.0), "red", (0, 1.0, -8.0), (0, -5.0, -10.5), 1.2, 0.6, group="plume", k=1.0)
        torso(B, W, "steel", "blue", "blue")
        B.add("cyl", at(W["pelvis"], 0, -3.5, 0), "blue", (4.6, 5.3, 1.0), taper=(-4.6, 4.6, 1.2, 0.95), group="skirt", k=0.5)
        B.add("cyl", at(W["pelvis"], 0, 1.4, 0), "leather", (1.0, 5.6, 0.4))
        B.box(at(W["chest"], 0, 3.0, 4.3), "gold", (1.0, 2.0, 0.5), rr=0.4)
        for s in ("r", "l"):
            B.ell(at(W["sh_" + s], 0, 0.8, 0), "steel", (3.4, 2.8, 3.4), order=1)
            arm(B, W, s, "black", "steel", glove="leather")
            leg(B, W, s, "black", "steel", "leather", boot_top=2.6)
        if o.get("show_weapon", True) and not o.get("sheathed"):
            spear(B, weapon_xf(W, o))
        else:
            spear(B, at(W["wr_l"], 0, -1.6, 0.3), upright=True)


def spear(B, xf, upright=False):
    if upright:
        xf = Xf(np.eye(3), xf.t) @ Xf.T(0, -14, 0)
        B.limb(at(xf, 0, 36, 0), "leather", 36, 0.7, 0.7)
        B.add("cone", at(xf, 0, 36, 0), "blade", ((0, 0, 0), (0, 6.0, 0), 1.6, 0.1))
        B.add("torus", at(xf, 0, 36, 0), "gold", (1.0, 0.5))
        return
    B.limb(at(xf, 0, 22, 0), "leather", 30, 0.7, 0.7)
    B.add("cone", at(xf, 0, 22, 0), "blade", ((0, 0, 0), (0, 6.0, 0), 1.6, 0.1))

CAST = {"kael": Kael, "argen": Argen, "mira": Mira, "nell": Nell, "king": King, "soldier": Soldier}


def build_character(cls, W, opts=None):
    B = Builder()
    cls.materials(B)
    cls.build(W, B, opts or {})
    return B
