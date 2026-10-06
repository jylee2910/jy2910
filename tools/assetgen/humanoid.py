"""Humanoid body builder shared by all human characters."""
import numpy as np

from sdf import Mat, Prim, Xf, euler, ramp, ramp_explicit


class Builder:
    def __init__(self):
        self.prims = []
        self.mats = []
        self.names = {}

    def mat(self, name, m=None):
        if m is None:
            return self.names[name]
        if name in self.names:
            self.mats[self.names[name]] = m
            return self.names[name]
        self.names[name] = len(self.mats)
        self.mats.append(m)
        return self.names[name]

    def add(self, kind, xf, mat, args, **kw):
        mi = self.names[mat] if isinstance(mat, str) else mat
        self.prims.append(Prim(kind, xf, mi, args, **kw))
        return self.prims[-1]

    # convenience -------------------------------------------------------
    def ell(self, xf, mat, r, **kw):
        return self.add("ell", xf, mat, tuple(r), **kw)

    def sph(self, xf, mat, r, **kw):
        return self.add("sphere", xf, mat, (r,), **kw)

    def box(self, xf, mat, h, rr=0.5, **kw):
        return self.add("box", xf, mat, (tuple(h), rr), **kw)

    def cone(self, xf, mat, a, b, r1, r2, **kw):
        return self.add("cone", xf, mat, (tuple(a), tuple(b), r1, r2), **kw)

    def limb(self, xf, mat, L, r1, r2, **kw):
        return self.cone(xf, mat, (0, 0, 0), (0, -L, 0), r1, r2, **kw)


def at(world_xf, x=0, y=0, z=0, rx=0, ry=0, rz=0):
    return world_xf @ Xf.T(x, y, z) @ Xf(euler(rx, ry, rz))


# ------------------------------------------------------------------------
# standard materials
# ------------------------------------------------------------------------

SKIN_LIGHT = ramp_explicit("#7a3f3f", "#b8695a", "#de9a7e", "#f5c3a3", "#ffe0c8")
SKIN_WARM = ramp_explicit("#6a3538", "#a85c52", "#d48c70", "#ecb592", "#fbd7b8")
SKIN_PALE = ramp_explicit("#6f4458", "#b07a86", "#dcaaa8", "#f6d5c8", "#fff0e6")


def std_mats(B, skin=SKIN_LIGHT):
    B.mat("skin", Mat(skin, ao=0.6))
    B.mat("eye_w", Mat(ramp_explicit("#ffffff", "#ffffff")))


# ------------------------------------------------------------------------
# body parts
# ------------------------------------------------------------------------


def head(B, W, hw=7.2, hh=7.4, skin="skin", jaw=True):
    h = W["head"]
    B.ell(at(h, 0, 6.6, 0.2), skin, (hw, hh, hw * 0.96), group="head", k=1.5)
    if jaw:
        B.ell(at(h, 0, 3.6, 1.6), skin, (hw * 0.72, hh * 0.52, hw * 0.7), group="head", k=1.5)
    # ears
    B.ell(at(h, -hw * 0.93, 5.2, 0.2), skin, (1.2, 1.8, 1.0), group="head", k=0.8)
    B.ell(at(h, hw * 0.93, 5.2, 0.2), skin, (1.2, 1.8, 1.0), group="head", k=0.8)
    # neck
    B.limb(at(W["neck"], 0, 2.5, 0), skin, 4.0, 2.2, 2.4)


def torso(B, W, mat_chest, mat_waist=None, mat_pelvis=None, chest=(6.0, 6.0, 4.0), waist=(4.8, 4.0, 3.5), pelvis=(5.4, 3.6, 3.8), k=2.0, group="torso"):
    mat_waist = mat_waist or mat_chest
    mat_pelvis = mat_pelvis or mat_waist
    B.ell(at(W["chest"], 0, 3.0, 0.2), mat_chest, chest, group=group, k=k)
    B.ell(at(W["spine"], 0, 3.0, 0), mat_waist, waist, group=group, k=k)
    B.ell(at(W["pelvis"], 0, 0.0, 0), mat_pelvis, pelvis, group=group, k=k)


def arm(B, W, side, mat_upper, mat_fore, mat_hand="skin", r=(2.3, 2.0, 1.9, 1.6), hand=1.9, glove=None):
    s = side
    B.limb(W["sh_" + s], mat_upper, 8.0, r[0], r[1], group="arm" + s, k=1.0)
    B.limb(W["el_" + s], mat_fore, 7.0, r[2], r[3], group="arm" + s, k=1.0)
    B.ell(at(W["wr_" + s], 0, -1.6, 0.2), glove or mat_hand, (hand, hand * 1.1, hand * 0.9), group="arm" + s, k=0.8)


def leg(B, W, side, mat_thigh, mat_shin, mat_boot, r=(3.0, 2.5, 2.4, 1.9), boot=(2.3, 1.6, 3.4), boot_top=None):
    s = side
    B.limb(W["hip_" + s], mat_thigh, 10.0, r[0], r[1], group="leg" + s, k=1.0)
    B.limb(W["kn_" + s], mat_shin, 9.5, r[2], r[3], group="leg" + s, k=1.0)
    B.box(at(W["an_" + s], 0, -0.4, 1.2), mat_boot, boot, rr=1.4, group="leg" + s, k=1.0)
    if boot_top:
        B.limb(at(W["kn_" + s], 0, -2.5, 0), mat_boot, 6.5, boot_top, boot_top * 0.85, group="leg" + s, k=1.0, order=1)


# ------------------------------------------------------------------------
# face decal painting (eyes) – done in 2D after the render
# ------------------------------------------------------------------------


def paint_eyes(img, info, W, anchor_world, anchor_px, yaw, pitch, eye_ramp, style="normal", ex=2.7, ey=5.0, ez=6.9, lash=None, scale=1.0, closed=False):
    """Paint 2D eyes onto the rendered head.  style: normal | big | narrow"""
    from sdf import camera_basis, project

    right, up, fwd = camera_basis(yaw, pitch)
    h = W["head"]
    view = -fwd
    lash = np.asarray(lash if lash is not None else (0.13, 0.07, 0.12))
    depth = info["depth"]
    Hh, Ww = depth.shape
    head_right = h.R @ np.array([1.0, 0, 0])
    for sx in (-1, 1):
        pt = h.apply(np.array([sx * ex, ey, ez]))
        nrm = h.R @ np.array([sx * 0.38, 0.05, 0.92])
        nrm /= np.linalg.norm(nrm)
        facing = nrm @ view
        if facing < 0.2:
            continue
        x, y, z = project(pt, anchor_world, anchor_px, yaw, pitch, scale)
        xi, yi = int(np.floor(x)), int(np.floor(y))
        if not (1 <= xi < Ww - 1 and 2 <= yi < Hh - 2):
            continue
        if img[yi, xi, 3] == 0 or not np.isfinite(depth[yi, xi]):
            continue
        ray_t = 100.0 - z
        if depth[yi, xi] < ray_t - 1.6:
            continue  # occluded (hair / arm in front)
        # which screen direction is "outer" for this eye
        outer = 1 if (head_right @ right) * sx > 0 else -1

        def put(yy, xx, c):
            if 0 <= yy < Hh and 0 <= xx < Ww and img[yy, xx, 3] > 0:
                img[yy, xx, :3] = c

        if closed:
            put(yi + 1, xi, lash)
            put(yi + 1, xi + outer, lash * 1.6)
            continue
        if style == "big":
            put(yi - 1, xi, lash)
            put(yi - 1, xi + outer, lash)
            put(yi, xi, eye_ramp[1])
            put(yi + 1, xi, eye_ramp[2])
            if facing > 0.55:
                put(yi, xi + outer, np.array([0.98, 0.98, 1.0]))
                put(yi + 1, xi + outer, eye_ramp[1] * 0.7 + 0.3)
        elif style == "narrow":
            put(yi, xi, lash)
            put(yi, xi + outer, lash)
            put(yi + 1, xi, eye_ramp[1])
        else:
            put(yi - 1, xi, lash)
            put(yi, xi, eye_ramp[1])
            put(yi + 1, xi, eye_ramp[2])
            if facing > 0.55:
                put(yi - 1, xi + outer, lash * 1.4)
    return img
