"""Humanoid animation keyframes.

Conventions (verified numerically):
  arms/legs: rx < 0 swings forward,   knee rx > 0 bends correctly
  elbow rx < 0 bends forward
  left arm  (+x side) outward = +rz,  right arm outward = -rz
  chest rx > 0 leans forward
Weapon is held in the LEFT hand (the side facing the battle camera).
"""
import math

import numpy as np

from rig import ease, lerp_pose, merge, offset


def level_feet(p):
    p = dict(p)
    for s in ("l", "r"):
        hx = p.get("hip_" + s, (0, 0, 0))[0]
        kx = p.get("kn_" + s, (0, 0, 0))[0]
        px = p.get("pelvis", (0, 0, 0))[0] + p.get("root", (0, 0, 0))[0]
        if ("an_" + s) not in p:
            p["an_" + s] = (-(hx + kx + px), 0, 0)
    return p


# --------------------------------------------------------------------------
# battle (weapon in left hand, character faces +z, viewed from its left)
# --------------------------------------------------------------------------

STANCE = {
    "pelvis_t": (0, -1.2, 0),
    "hip_l": (-28, 0, 5),
    "kn_l": (30, 0, 0),
    "hip_r": (18, 0, -5),
    "kn_r": (18, 0, 0),
    "chest": (6, 0, 0),
    "head": (-4, 0, 0),
    "sh_l": (-38, 0, 14),
    "el_l": (-45, 0, 0),
    "sh_r": (-12, 0, -18),
    "el_r": (-40, 0, 0),
    "aim": 28,
    "scarf": 0.0,
}


def stance(style):
    s = dict(STANCE)
    if style == "staff":
        s.update({"sh_l": (-50, 0, 26), "el_l": (-25, 0, 0), "aim": 66, "hip_l": (-14, 0, 3), "kn_l": (14, 0, 0), "hip_r": (10, 0, -3), "kn_r": (10, 0, 0), "pelvis_t": (0, -0.5, 0), "sh_r": (-25, 0, -14), "el_r": (-60, 0, 0)})
    elif style == "katana":
        s.update({"sh_l": (-52, 0, 4), "el_l": (-35, 0, 0), "sh_r": (-48, 0, -2), "el_r": (-40, 0, 0), "aim": 30, "chest": (10, 0, 0), "hip_l": (-32, 0, 6), "kn_l": (38, 0, 0), "hip_r": (24, 0, -6), "kn_r": (22, 0, 0), "pelvis_t": (0, -2.0, 0)})
    elif style == "dagger":
        s.update({"sh_l": (-35, 0, 22), "el_l": (-70, 0, 0), "sh_r": (-30, 0, -22), "el_r": (-75, 0, 0), "aim": 10, "chest": (14, 0, 0), "hip_l": (-35, 0, 8), "kn_l": (45, 0, 0), "hip_r": (25, 0, -8), "kn_r": (30, 0, 0), "pelvis_t": (0, -2.4, 0)})
    elif style == "royal":
        s.update({"sh_l": (-8, 0, 8), "el_l": (-20, 0, 0), "sh_r": (-8, 0, -8), "el_r": (-20, 0, 0), "hip_l": (-4, 0, 2), "kn_l": (3, 0, 0), "hip_r": (4, 0, -2), "kn_r": (3, 0, 0), "chest": (0, 0, 0), "pelvis_t": (0, 0, 0), "head": (0, 0, 0)})
    return s


def anim_idle(style, n=4):
    base = stance(style)
    frames = []
    for i in range(n):
        ph = math.sin(i / n * 2 * math.pi)
        frames.append(level_feet(offset(base, {"chest": (1.6 * ph, 0, 0), "pelvis_t": (0, 0.35 * ph, 0), "sh_l": (2 * ph, 0, 0), "sh_r": (-2 * ph, 0, 0), "head": (-1.0 * ph, 0, 0), "scarf": 0.25 * ph})))
    return frames


def anim_attack(style):
    b = stance(style)
    if style == "staff":
        keys = [
            merge(b, {"sh_l": (-120, 0, 0), "el_l": (-20, 0, 0), "chest": (-8, -10, 0), "aim": 110}),
            merge(b, {"sh_l": (-160, 0, 0), "el_l": (-10, 0, 0), "chest": (-10, -15, 0), "aim": 140, "pelvis_t": (0, 0.5, 0)}),
            merge(b, {"sh_l": (-60, 0, 0), "el_l": (-10, 0, 0), "chest": (14, 10, 0), "aim": 45, "pelvis_t": (0, -1.5, 2), "hip_l": (-20, 0, 0), "kn_l": (20, 0, 0)}),
            merge(b, {"sh_l": (-40, 0, 0), "el_l": (-10, 0, 0), "chest": (16, 12, 0), "aim": 30, "pelvis_t": (0, -1.8, 2.5), "hip_l": (-24, 0, 0), "kn_l": (24, 0, 0)}),
            merge(b, {"chest": (8, 4, 0)}),
        ]
    elif style == "dagger":
        keys = [
            merge(b, {"sh_l": (30, 0, 30), "el_l": (-60, 0, 0), "chest": (6, -20, 0), "pelvis_t": (0, -2.8, -1)}),
            merge(b, {"sh_l": (-95, 0, 10), "el_l": (-5, 0, 0), "aim": 0, "chest": (18, 18, 0), "pelvis_t": (0, -3.2, 4), "hip_l": (-50, 0, 6), "kn_l": (55, 0, 0)}),
            merge(b, {"sh_r": (-100, 0, -5), "el_r": (-5, 0, 0), "sh_l": (20, 0, 30), "chest": (18, -15, 0), "pelvis_t": (0, -3.2, 4), "hip_l": (-50, 0, 6), "kn_l": (55, 0, 0)}),
            merge(b, {"sh_l": (-100, 0, 20), "el_l": (-5, 0, 0), "chest": (20, 20, 0), "pelvis_t": (0, -3.4, 5), "hip_l": (-52, 0, 6), "kn_l": (58, 0, 0)}),
            merge(b, {"chest": (10, 5, 0)}),
        ]
    else:
        # sword / katana: big overhead diagonal slash
        keys = [
            merge(b, {"sh_l": (-150, 0, 25), "el_l": (-30, 0, 0), "aim": 125, "chest": (-10, -12, 0), "head": (-8, 0, 0), "pelvis_t": (0, -0.5, -1), "scarf": 0.6}),
            merge(b, {"sh_l": (-175, 0, 10), "el_l": (-40, 0, 0), "aim": 160, "chest": (-14, -16, 0), "head": (-10, 0, 0), "pelvis_t": (0, 0.2, -1.5), "scarf": 0.8}),
            merge(b, {"sh_l": (-95, 0, 5), "el_l": (-5, 0, 0), "aim": 60, "chest": (12, 15, 0), "pelvis_t": (0, -2.2, 3.5), "hip_l": (-48, 0, 6), "kn_l": (52, 0, 0), "scarf": 1.0}),
            merge(b, {"sh_l": (-25, 0, 18), "el_l": (-5, 0, 0), "aim": -35, "chest": (22, 14, 0), "head": (6, 0, 0), "pelvis_t": (0, -3.2, 4.5), "hip_l": (-55, 0, 6), "kn_l": (62, 0, 0), "hip_r": (32, 0, -6), "kn_r": (10, 0, 0), "scarf": 1.0}),
            merge(b, {"sh_l": (-20, 0, 20), "el_l": (-10, 0, 0), "aim": -45, "chest": (20, 12, 0), "head": (4, 0, 0), "pelvis_t": (0, -3.0, 4.2), "hip_l": (-52, 0, 6), "kn_l": (58, 0, 0), "hip_r": (30, 0, -6), "kn_r": (12, 0, 0), "scarf": 0.6}),
            merge(b, {"chest": (10, 8, 0), "scarf": 0.4}),
        ]
    return [level_feet(k) for k in keys]


def anim_cast(style):
    b = stance(style)
    if style == "staff":
        up = {"sh_l": (-150, 0, 6), "el_l": (-5, 0, 0), "aim": 95, "sh_r": (-80, 0, -20), "el_r": (-30, 0, 0), "head": (-12, 0, 0), "chest": (-8, 0, 0)}
    else:
        up = {"sh_r": (-100, 0, -14), "el_r": (-15, 0, 0), "sh_l": (-10, 0, 25), "el_l": (-25, 0, 0), "aim": -60, "chest": (-6, -10, 0), "head": (-6, 0, 0)}
    f = []
    f.append(merge(b, {"sh_r": (-30, 0, -10), "el_r": (-70, 0, 0), "chest": (10, 5, 0), "head": (6, 0, 0)}))
    f.append(merge(b, up))
    f.append(merge(b, up, {"pelvis_t": (0, 0.4, 0), "chest": (-2, 0, 0)}))
    f.append(merge(b, up, {"pelvis_t": (0, 0.0, 0), "chest": (2, 0, 0)}))
    return [level_feet(k) for k in f]


def anim_hurt(style):
    b = stance(style)
    return [
        level_feet(merge(b, {"chest": (-18, 6, 0), "head": (-16, 0, 0), "pelvis_t": (0, -0.5, -2.5), "sh_l": (20, 0, 20), "sh_r": (20, 0, -25), "hip_l": (10, 0, 0), "kn_l": (-10, 0, 0), "scarf": 1.0})),
        level_feet(merge(b, {"chest": (-10, 4, 0), "head": (-8, 0, 0), "pelvis_t": (0, -0.8, -1.5), "sh_l": (10, 0, 10), "sh_r": (10, 0, -15), "scarf": 0.7})),
    ]


def anim_guard(style):
    b = stance(style)
    if style == "staff":
        g = {"sh_l": (-75, 0, -10), "el_l": (-60, 0, 0), "aim": 92, "aim_yaw": 0, "sh_r": (-70, 0, 10), "el_r": (-70, 0, 0)}
    else:
        g = {"sh_l": (-70, 0, -15), "el_l": (-85, 0, 0), "aim": 88, "aim_yaw": -10, "chest": (12, 15, 0), "sh_r": (-60, 0, 15), "el_r": (-80, 0, 0)}
    return [level_feet(merge(b, g, {"pelvis_t": (0, -2.4, -0.5), "hip_l": (-35, 0, 6), "kn_l": (50, 0, 0), "hip_r": (20, 0, -6), "kn_r": (35, 0, 0)}))]


def anim_weak(style):
    """kneeling – low HP / KO"""
    b = stance(style)
    p = merge(b, {"pelvis_t": (0, -7.0, 0), "hip_l": (-80, 0, 6), "kn_l": (85, 0, 0), "hip_r": (5, 0, -5), "kn_r": (95, 0, 0), "chest": (22, 0, 0), "head": (18, 0, 0), "sh_l": (-20, 0, 15), "el_l": (-20, 0, 0), "aim": -88, "sh_r": (-30, 0, -6), "el_r": (-30, 0, 0), "scarf": 0.0})
    return [level_feet(p)]


def anim_ko(style):
    b = stance(style)
    p = {"root": (-88, 0, 0), "root_t": (0, 4.0, 16), "pelvis_t": (0, 0, 0), "chest": (6, 0, 0), "head": (10, 30, 0), "sh_l": (-160, 0, 40), "el_l": (-20, 0, 0), "sh_r": (-10, 0, -30), "el_r": (-30, 0, 0), "hip_l": (-10, 0, 8), "kn_l": (30, 0, 0), "hip_r": (5, 0, -6), "kn_r": (10, 0, 0), "an_l": (0, 0, 0), "an_r": (0, 0, 0), "aim": 0, "scarf": 0.0}
    return [p]


def anim_win(style):
    b = stance(style)
    if style == "staff":
        up = {"sh_l": (-165, 0, 10), "el_l": (-5, 0, 0), "aim": 95}
    elif style == "royal":
        up = {}
    else:
        up = {"sh_l": (-170, 0, 6), "el_l": (-5, 0, 0), "aim": 92}
    a = merge(stance("royal"), {"sh_r": (-10, 0, -20), "el_r": (-60, 0, 0)}, up)
    return [level_feet(merge(a, {"head": (-8, 0, 0), "pelvis_t": (0, 0.0, 0)})), level_feet(merge(a, {"head": (-10, 0, 0), "pelvis_t": (0, 0.4, 0), "chest": (-3, 0, 0)}))]


def anim_run(style, n=6):
    """battle dash (side view)"""
    out = []
    for i in range(n):
        ph = i / n * 2 * math.pi
        s = math.sin(ph)
        c = math.cos(ph)
        p = {
            "pelvis_t": (0, -1.6 + 1.0 * abs(c), 0),
            "chest": (16, 0, 0),
            "head": (-10, 0, 0),
            "hip_l": (-45 * s, 0, 3),
            "kn_l": (30 + 35 * max(0, c), 0, 0),
            "hip_r": (45 * s, 0, -3),
            "kn_r": (30 + 35 * max(0, -c), 0, 0),
            "sh_l": (-25 + 30 * s, 0, 18),
            "el_l": (-50, 0, 0),
            "sh_r": (-30 - 40 * s, 0, -12),
            "el_r": (-70, 0, 0),
            "aim": -150 if style not in ("staff",) else 160,
            "scarf": 1.0,
        }
        out.append(level_feet(p))
    return out


# --------------------------------------------------------------------------
# field
# --------------------------------------------------------------------------


def field_idle(style, n=2):
    out = []
    for i in range(n):
        ph = math.sin(i / n * 2 * math.pi + 0.8)
        p = {
            "sh_l": (2, 0, 7),
            "el_l": (-12, 0, 0),
            "sh_r": (2, 0, -7),
            "el_r": (-12, 0, 0),
            "hip_l": (0, 0, 2),
            "hip_r": (0, 0, -2),
            "chest": (0.8 * ph, 0, 0),
            "pelvis_t": (0, 0.25 * ph, 0),
            "sheathed": True, "aim": -95,
            "scarf": 0.2,
        }
        out.append(level_feet(p))
    return out


def field_walk(style, n=6):
    out = []
    for i in range(n):
        ph = i / n * 2 * math.pi
        s = math.sin(ph)
        c = math.cos(ph)
        p = {
            "pelvis_t": (0, -0.4 + 0.7 * abs(c), 0),
            "chest": (5, 0, 0),
            "hip_l": (-28 * s, 0, 2),
            "kn_l": (8 + 30 * max(0, c), 0, 0),
            "hip_r": (28 * s, 0, -2),
            "kn_r": (8 + 30 * max(0, -c), 0, 0),
            "sh_l": (22 * s, 0, 8),
            "el_l": (-20, 0, 0),
            "sh_r": (-22 * s, 0, -8),
            "el_r": (-20, 0, 0),
            "sheathed": True, "aim": -95,
            "scarf": 0.4 + 0.2 * abs(s),
        }
        out.append(level_feet(p))
    return out


BATTLE_ANIMS = {
    "idle": (anim_idle, 6, True),
    "attack": (anim_attack, 14, False),
    "cast": (anim_cast, 8, False),
    "hurt": (anim_hurt, 8, False),
    "guard": (anim_guard, 1, True),
    "weak": (anim_weak, 1, True),
    "ko": (anim_ko, 1, True),
    "win": (anim_win, 4, True),
    "run": (anim_run, 14, True),
}

FIELD_ANIMS = {
    "idle": (field_idle, 2, True),
    "walk": (field_walk, 10, True),
}
