"""Skeleton + forward kinematics + pose interpolation."""
import numpy as np

from sdf import Xf, euler

# joint: (parent, rest offset in parent space)
HUMANOID = {
    "root": (None, (0, 0, 0)),
    "pelvis": ("root", (0, 22, 0)),
    "spine": ("pelvis", (0, 2, 0)),
    "chest": ("spine", (0, 8, 0)),
    "neck": ("chest", (0, 8.5, 0)),
    "head": ("neck", (0, 2.5, 0)),
    "sh_r": ("chest", (-6.6, 6.2, 0)),
    "el_r": ("sh_r", (0, -8, 0)),
    "wr_r": ("el_r", (0, -7, 0)),
    "sh_l": ("chest", (6.6, 6.2, 0)),
    "el_l": ("sh_l", (0, -8, 0)),
    "wr_l": ("el_l", (0, -7, 0)),
    "hip_r": ("pelvis", (-3.4, -1, 0)),
    "kn_r": ("hip_r", (0, -10, 0)),
    "an_r": ("kn_r", (0, -9.5, 0)),
    "hip_l": ("pelvis", (3.4, -1, 0)),
    "kn_l": ("hip_l", (0, -10, 0)),
    "an_l": ("kn_l", (0, -9.5, 0)),
}


class Skeleton:
    def __init__(self, joints=HUMANOID, scale=1.0, overrides=None):
        self.joints = dict(joints)
        if overrides:
            for k, v in overrides.items():
                self.joints[k] = (self.joints[k][0], v)
        self.scale = scale

    def solve(self, pose):
        """pose: {joint: (rx,ry,rz)} plus optional 'root_t': (x,y,z)"""
        world = {}
        for name, (parent, off) in self.joints.items():
            rot = pose.get(name, (0, 0, 0))
            off = np.asarray(off, dtype=np.float64) * self.scale
            if name == "root":
                t = pose.get("root_t", (0, 0, 0))
                world[name] = Xf.T(*t) @ Xf(euler(*rot))
                continue
            extra = pose.get(name + "_t", (0, 0, 0))
            world[name] = world[parent] @ Xf.T(*(off + np.asarray(extra))) @ Xf(euler(*rot))
        return world


def lerp_pose(a, b, t):
    keys = set(a) | set(b)
    out = {}
    for k in keys:
        va = np.asarray(a.get(k, (0, 0, 0)), dtype=np.float64)
        vb = np.asarray(b.get(k, (0, 0, 0)), dtype=np.float64)
        out[k] = tuple(va + (vb - va) * t)
    return out


def ease(t):
    return t * t * (3 - 2 * t)


def merge(*poses):
    """later poses override earlier ones"""
    out = {}
    for p in poses:
        out.update(p)
    return out


def offset(base, delta):
    """add rotation / translation offsets"""
    out = dict(base)
    for k, v in delta.items():
        if k in out and not np.isscalar(v):
            out[k] = tuple(np.asarray(out[k], dtype=float) + np.asarray(v, dtype=float))
        elif k in out and np.isscalar(v) and np.isscalar(out[k]):
            out[k] = out[k] + v
        else:
            out[k] = v
    return out
