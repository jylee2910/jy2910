"""
3D SDF -> pixel-art sprite renderer.

Characters, monsters and props are modelled as unions of analytic SDF
primitives attached to a skeleton.  They are ray-marched orthographically at
the final sprite resolution (1 sample per pixel) and shaded with quantized,
hue-shifted colour ramps, ambient occlusion, depth-contour inner lines and a
selective outline.  This is the "3D model rendered to pixels" approach
(as used by e.g. Dead Cells) which gives consistent lighting and animation
from any angle.
"""
import colorsys
import math

import numpy as np

# --------------------------------------------------------------------------
# math helpers
# --------------------------------------------------------------------------


def rx(a):
    a = math.radians(a)
    c, s = math.cos(a), math.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]], dtype=np.float64)


def ry(a):
    a = math.radians(a)
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]], dtype=np.float64)


def rz(a):
    a = math.radians(a)
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]], dtype=np.float64)


def euler(x=0, y=0, z=0):
    # applied Z then X then Y (yaw last) – intuitive for limbs
    return ry(y) @ rx(x) @ rz(z)


class Xf:
    """Rigid transform: world = R @ local + t"""

    __slots__ = ("R", "t")

    def __init__(self, R=None, t=None):
        self.R = np.eye(3) if R is None else np.asarray(R, dtype=np.float64)
        self.t = np.zeros(3) if t is None else np.asarray(t, dtype=np.float64)

    def __matmul__(self, o):
        return Xf(self.R @ o.R, self.R @ o.t + self.t)

    def apply(self, p):
        return self.R @ np.asarray(p, dtype=np.float64) + self.t

    @staticmethod
    def T(x=0, y=0, z=0):
        return Xf(None, (x, y, z))

    @staticmethod
    def E(x=0, y=0, z=0):
        return Xf(euler(x, y, z))


# --------------------------------------------------------------------------
# colour ramps
# --------------------------------------------------------------------------


def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) / 255.0 for i in (0, 2, 4))


def rgb2hex(c):
    return "#%02x%02x%02x" % tuple(int(max(0, min(1, v)) * 255 + 0.5) for v in c)


def ramp(base, n=6, dark=0.62, light=0.42, hue_dark=-0.07, hue_light=0.045, sat_dark=0.18, sat_light=-0.22):
    """Hue-shifted colour ramp, darkest first.

    Shadows drift toward blue/purple and gain saturation, highlights drift
    toward yellow and desaturate – the classic pixel-art ramp.
    """
    r, g, b = hex2rgb(base) if isinstance(base, str) else base
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    mid = (n - 1) * 0.55
    out = []
    for i in range(n):
        t = (i - mid) / max(mid, n - 1 - mid)  # -1 .. 1
        if t < 0:
            k = -t
            # hue drift toward 0.66 (blue/purple)
            hh = h + _hue_toward(h, 0.70) * k * abs(hue_dark) * 4
            ll = l * (1 - dark * k)
            ss = min(1, s + sat_dark * k)
        else:
            k = t
            hh = h + _hue_toward(h, 0.14) * k * hue_light * 4
            ll = l + (1 - l) * light * k
            ss = max(0, min(1, s + sat_light * k))
        out.append(colorsys.hls_to_rgb(hh % 1.0, ll, ss))
    return np.array(out)


def _hue_toward(h, target):
    d = (target - h + 0.5) % 1.0 - 0.5
    return max(-0.25, min(0.25, d))


def ramp_explicit(*hexes):
    return np.array([hex2rgb(h) for h in hexes])


class Mat:
    def __init__(self, ramp_colors, spec=0.0, shine=24, emissive=0.0, rim=0.0, outline=None, ao=1.0, band=1.0):
        self.ramp = np.asarray(ramp_colors)
        self.spec = spec
        self.shine = shine
        self.emissive = emissive
        self.rim = rim
        self.ao = ao
        self.band = band
        self.outline = outline  # override outline colour


# --------------------------------------------------------------------------
# primitives (all evaluated on (N,3) arrays in local space)
# --------------------------------------------------------------------------


def _len(v):
    return np.sqrt(np.sum(v * v, axis=-1))


def sd_sphere(p, r):
    return _len(p) - r


def sd_ellipsoid(p, r):
    r = np.asarray(r, dtype=np.float64)
    k0 = _len(p / r)
    k1 = _len(p / (r * r))
    return k0 * (k0 - 1.0) / np.maximum(k1, 1e-9)


def sd_roundbox(p, h, rr):
    q = np.abs(p) - (np.asarray(h) - rr)
    return _len(np.maximum(q, 0.0)) + np.minimum(np.max(q, axis=-1), 0.0) - rr


def sd_roundcone(p, a, b, r1, r2):
    a = np.asarray(a, dtype=np.float64)
    b = np.asarray(b, dtype=np.float64)
    ba = b - a
    l2 = float(ba @ ba)
    rr = r1 - r2
    a2 = l2 - rr * rr
    il2 = 1.0 / l2
    pa = p - a
    y = pa @ ba
    z = y - l2
    xv = pa * l2 - np.outer(y, ba)
    x2 = np.sum(xv * xv, axis=-1)
    y2 = y * y * l2
    z2 = z * z * l2
    k = np.sign(rr) * rr * rr * x2
    d3 = (np.sqrt(np.maximum(x2 * a2 * il2, 0)) + y * rr) * il2 - r1
    d1 = np.sqrt(x2 + z2) * il2 - r2
    d2 = np.sqrt(x2 + y2) * il2 - r1
    return np.where(np.sign(z) * a2 * z2 > k, d1, np.where(np.sign(y) * a2 * y2 < k, d2, d3))


def sd_tri(p, a, b, c, th):
    a = np.asarray(a, dtype=np.float64)
    b = np.asarray(b, dtype=np.float64)
    c = np.asarray(c, dtype=np.float64)
    ba = b - a
    pa = p - a
    cb = c - b
    pb = p - b
    ac = a - c
    pc = p - c
    nor = np.cross(ba, ac)

    def dot(u, v):
        return np.sum(u * v, axis=-1)

    def d2(v):
        return dot(v, v)

    s = np.sign(dot(np.cross(ba, nor)[None, :], pa)) + np.sign(dot(np.cross(cb, nor)[None, :], pb)) + np.sign(dot(np.cross(ac, nor)[None, :], pc))
    e1 = d2(ba[None, :] * np.clip(dot(ba[None, :], pa) / (ba @ ba), 0, 1)[:, None] - pa)
    e2 = d2(cb[None, :] * np.clip(dot(cb[None, :], pb) / (cb @ cb), 0, 1)[:, None] - pb)
    e3 = d2(ac[None, :] * np.clip(dot(ac[None, :], pc) / (ac @ ac), 0, 1)[:, None] - pc)
    edge = np.minimum(np.minimum(e1, e2), e3)
    face = (pa @ nor) ** 2 / (nor @ nor)
    return np.sqrt(np.where(s < 2, edge, face)) - th


def sd_torus(p, R, r):
    q = np.stack([np.sqrt(p[:, 0] ** 2 + p[:, 2] ** 2) - R, p[:, 1]], axis=-1)
    return _len(q) - r


def sd_cylinder(p, h, r, rr=0.0):
    d = np.stack([np.sqrt(p[:, 0] ** 2 + p[:, 2] ** 2) - r + rr, np.abs(p[:, 1]) - h + rr], axis=-1)
    return np.minimum(np.maximum(d[:, 0], d[:, 1]), 0.0) + _len(np.maximum(d, 0.0)) - rr


class Prim:
    """A primitive placed in world space.

    kind: 'sphere','ell','box','cone','torus','cyl'
    op:   'add' | 'sub' | 'int'  (sub/int act on the group they belong to)
    group: prims in the same group are smooth-unioned with `k`
    taper: (ax, k) scales the cross-section linearly along local y
    """

    def __init__(self, kind, xf, mat, args, group=None, k=0.0, op="add", taper=None, bend=None, noise=None, order=0):
        self.kind = kind
        self.xf = xf
        self.mat = mat
        self.args = args
        self.group = group
        self.k = k
        self.op = op
        self.taper = taper
        self.noise = noise
        self.order = order
        self.s = float(np.linalg.norm(xf.R[:, 0]))

    def eval(self, p):
        # world -> local (supports uniform scale in xf.R)
        q = (p - self.xf.t) @ self.xf.R
        if abs(self.s - 1.0) > 1e-6:
            q = q / (self.s * self.s)
        scale = self.s
        if self.taper is not None:
            ty0, ty1, s0, s1 = self.taper
            t = np.clip((q[:, 1] - ty0) / (ty1 - ty0), 0, 1)
            s = s0 + (s1 - s0) * t
            q = q.copy()
            q[:, 0] /= s
            q[:, 2] /= s
            scale = scale * np.minimum(s, 1.0)
        a = self.args
        if self.kind == "sphere":
            d = sd_sphere(q, a[0])
        elif self.kind == "ell":
            d = sd_ellipsoid(q, a)
        elif self.kind == "box":
            d = sd_roundbox(q, a[0], a[1])
        elif self.kind == "cone":
            d = sd_roundcone(q, a[0], a[1], a[2], a[3])
        elif self.kind == "torus":
            d = sd_torus(q, a[0], a[1])
        elif self.kind == "tri":
            d = sd_tri(q, a[0], a[1], a[2], a[3])
        elif self.kind == "cyl":
            d = sd_cylinder(q, a[0], a[1], a[2] if len(a) > 2 else 0.0)
        else:
            raise ValueError(self.kind)
        d = d * scale
        if self.noise is not None:
            amp, freq, seed = self.noise
            d = d + amp * value_noise3(q * freq, seed)
        return d


# --------------------------------------------------------------------------
# noise
# --------------------------------------------------------------------------


def _hash3(ix, iy, iz, seed):
    h = (ix * 374761393 + iy * 668265263 + iz * 1274126177 + seed * 974711) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    h = h ^ (h >> 16)
    return (h & 0xFFFF) / 65535.0 * 2.0 - 1.0


def value_noise3(p, seed=0):
    f = np.floor(p)
    t = p - f
    t = t * t * (3 - 2 * t)
    i = f.astype(np.int64)
    out = 0.0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (t[:, 0] if dx else 1 - t[:, 0]) * (t[:, 1] if dy else 1 - t[:, 1]) * (t[:, 2] if dz else 1 - t[:, 2])
                out = out + w * _hash3(i[:, 0] + dx, i[:, 1] + dy, i[:, 2] + dz, seed)
    return out


def fbm3(p, seed=0, octaves=3):
    s = 0
    a = 0.5
    f = 1.0
    for o in range(octaves):
        s = s + a * value_noise3(p * f, seed + o * 17)
        a *= 0.5
        f *= 2.03
    return s


# --------------------------------------------------------------------------
# scene evaluation
# --------------------------------------------------------------------------


def smin(a, b, k):
    if k <= 0:
        return np.minimum(a, b)
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b + (a - b) * h - k * h * (1 - h)


class Scene:
    def __init__(self, prims):
        self.prims = prims
        # bounding spheres for culling could go here
        groups = {}
        order = []
        for i, p in enumerate(prims):
            g = p.group if p.group is not None else ("_solo", i)
            if g not in groups:
                groups[g] = []
                order.append(g)
            groups[g].append(p)
        self.groups = [groups[g] for g in order]

    def eval(self, p, want_mat=False):
        n = p.shape[0]
        dist = np.full(n, 1e9)
        mat = np.full(n, -1, dtype=np.int64) if want_mat else None
        for g in self.groups:
            gd = None
            gm_d = None
            gm = None
            for pr in g:
                d = pr.eval(p)
                if pr.op == "add":
                    if gd is None:
                        gd = d
                    else:
                        gd = smin(gd, d, pr.k if pr.k else g[0].k)
                    if want_mat:
                        # material = nearest additive primitive (with priority)
                        dd = d - pr.order * 0.35
                        if gm is None:
                            gm_d, gm = dd, np.full(n, pr.mat, dtype=np.int64)
                        else:
                            better = dd < gm_d
                            gm_d = np.where(better, dd, gm_d)
                            gm = np.where(better, pr.mat, gm)
                elif pr.op == "sub":
                    if pr.k:
                        h = np.clip(0.5 - 0.5 * (gd + d) / pr.k, 0, 1)
                        gd = gd + (-d - gd) * h + pr.k * h * (1 - h)
                    else:
                        gd = np.maximum(gd, -d)
                elif pr.op == "int":
                    gd = np.maximum(gd, d)
                elif pr.op == "paint":
                    # recolour region without changing shape
                    if want_mat:
                        inside = d < 0
                        gm = np.where(inside, pr.mat, gm)
                        gm_d = np.where(inside, -1e9, gm_d)
            if gd is None:
                continue
            if want_mat:
                better = gd < dist
                mat = np.where(better, gm, mat)
            dist = np.minimum(dist, gd)
        return dist, mat


# --------------------------------------------------------------------------
# camera / ray-march
# --------------------------------------------------------------------------


def camera_basis(yaw, pitch):
    """View basis.  yaw rotates the camera around the model (degrees, 0 = front)
    pitch tilts it looking down (degrees)."""
    R = ry(yaw) @ rx(-pitch)
    right = R @ np.array([1.0, 0, 0])
    up = R @ np.array([0, 1.0, 0])
    fwd = R @ np.array([0, 0, -1.0])  # camera looks along -z by default
    return right, up, fwd


class Render:
    def __init__(self, rgba, mat, depth, normal, lit, pos):
        self.rgba = rgba
        self.mat = mat
        self.depth = depth
        self.normal = normal
        self.lit = lit
        self.pos = pos


def raymarch(scene, W, H, center, yaw=0.0, pitch=10.0, scale=1.0, steps=96, far=200.0):
    """center: world point that maps to sprite pixel (W/2, anchor_y)."""
    right, up, fwd = camera_basis(yaw, pitch)
    cx, cy, ax, ay = center  # world anchor (cx,cy) and pixel anchor
    xs = (np.arange(W) + 0.5 - ax) * scale
    ys = (ay - (np.arange(H) + 0.5)) * scale
    X, Y = np.meshgrid(xs, ys)
    origin0 = np.array([cx[0], cx[1], cx[2]]) if hasattr(cx, "__len__") else None
    base = np.asarray(cy, dtype=np.float64) if origin0 is None else origin0
    ro = base[None, :] + X.reshape(-1, 1) * right[None, :] + Y.reshape(-1, 1) * up[None, :] - fwd[None, :] * far * 0.5
    rd = np.broadcast_to(fwd, ro.shape)
    n = ro.shape[0]
    t = np.zeros(n)
    hit = np.zeros(n, dtype=bool)
    alive = np.ones(n, dtype=bool)
    idx = np.arange(n)
    for _ in range(steps):
        a = idx[alive]
        if a.size == 0:
            break
        p = ro[a] + rd[a] * t[a, None]
        d, _m = scene.eval(p)
        h = d < 0.02
        hit[a[h]] = True
        t[a] += np.where(h, 0, d * 0.9)
        dead = h | (t[a] > far)
        alive[a[dead]] = False
    pos = ro + rd * t[:, None]
    return pos, hit, t, (right, up, fwd), (W, H)


def shade(scene, mats, pos, hit, t, basis, WH, light=(-0.55, 0.75, 0.55), ambient=0.22, ao_strength=0.7, rim_dir=None, ink=None):
    W, H = WH
    right, up, fwd = basis
    n = pos.shape[0]
    idx = np.where(hit)[0]
    P = pos[idx]
    _, M = scene.eval(P, want_mat=True)
    e = 0.15
    nx = scene.eval(P + [e, 0, 0])[0] - scene.eval(P - [e, 0, 0])[0]
    ny = scene.eval(P + [0, e, 0])[0] - scene.eval(P - [0, e, 0])[0]
    nz = scene.eval(P + [0, 0, e])[0] - scene.eval(P - [0, 0, e])[0]
    N = np.stack([nx, ny, nz], -1)
    N /= np.maximum(_len(N)[:, None], 1e-9)
    # to view space
    Nv = np.stack([N @ right, N @ up, -(N @ fwd)], -1)
    L = np.asarray(light, dtype=np.float64)
    L /= np.linalg.norm(L)
    ndl = Nv @ L
    # AO
    ao = np.ones(len(idx))
    for i, hh in enumerate((0.8, 1.8, 3.2)):
        d = scene.eval(P + N * hh)[0]
        ao -= (hh - np.clip(d, 0, hh)) / hh * (0.5 ** i) * 0.45
    ao = np.clip(ao, 0, 1)
    V = np.array([0, 0, 1.0])
    Hh = L + V
    Hh /= np.linalg.norm(Hh)
    ndh = np.clip(Nv @ Hh, 0, 1)
    rgba = np.zeros((n, 4))
    lit = np.zeros(n)
    matid = np.full(n, -1, dtype=np.int64)
    matid[idx] = M
    for mi, m in enumerate(mats):
        sel = M == mi
        if not np.any(sel):
            continue
        d = ndl[sel]
        wrap = 0.12
        diff = np.clip((d + wrap) / (1 + wrap), 0, 1)
        v = ambient + (1 - ambient) * diff
        aom = 1 - (1 - ao[sel]) * ao_strength * m.ao
        v = v * aom
        if m.spec:
            v = v + m.spec * ndh[sel] ** m.shine
        if m.rim:
            rim = (1 - np.clip(Nv[sel][:, 2], 0, 1)) ** 2.5 * np.clip(-Nv[sel] @ np.array([L[0], 0, 0]) + 0.3, 0, 1)
            v = v + m.rim * rim
        v = np.clip(v, 0, 0.999)
        k = len(m.ramp)
        # bias toward mid tones so the full ramp is used
        vi = np.clip((v ** (1.0 / m.band)) * k, 0, k - 1e-6).astype(int)
        col = m.ramp[vi]
        if m.emissive:
            col = col * (1 - m.emissive) + m.ramp[-1] * m.emissive
        rgba[idx[sel], :3] = col
        rgba[idx[sel], 3] = 1
        lit[idx[sel]] = vi
    depth = np.full(n, np.inf)
    depth[idx] = t[idx]
    return (
        rgba.reshape(H, W, 4),
        matid.reshape(H, W),
        depth.reshape(H, W),
        lit.reshape(H, W).astype(int),
    )


# --------------------------------------------------------------------------
# pixel art post-processing
# --------------------------------------------------------------------------


def postprocess(rgba, matid, depth, lit, mats, outline=True, inner=True, depth_thresh=2.2, outline_col=None, clean=True):
    H, W, _ = rgba.shape
    out = rgba.copy()
    solid = rgba[..., 3] > 0
    # inner contour lines: pixel is behind a neighbour that is much nearer
    if inner:
        np.seterr(invalid="ignore")
        line = np.zeros((H, W), dtype=bool)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            nb = np.roll(np.roll(depth, dy, 0), dx, 1)
            nbm = np.roll(np.roll(matid, dy, 0), dx, 1)
            cond = solid & np.isfinite(nb) & (depth - nb > depth_thresh)
            # only draw when material differs or very large jump
            cond &= (nbm != matid) | (depth - nb > depth_thresh * 2.5)
            line |= cond
        ys, xs = np.where(line)
        for y, x in zip(ys, xs):
            m = mats[matid[y, x]]
            idx = max(0, lit[y, x] - 2)
            c = m.ramp[idx] * 0.85
            out[y, x, :3] = c
    if outline:
        res = out.copy()
        for y in range(H):
            for x in range(W):
                if solid[y, x]:
                    continue
                best = None
                for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < H and 0 <= xx < W and solid[yy, xx]:
                        mi = matid[yy, xx]
                        if best is None or depth[yy, xx] < best[1]:
                            best = (mi, depth[yy, xx], dy, dx)
                if best is None:
                    continue
                m = mats[best[0]]
                if m.outline is not None:
                    c = np.asarray(m.outline)
                else:
                    c = m.ramp[0] * 0.55 + np.array([0.02, 0.01, 0.05])
                if outline_col is not None:
                    c = np.asarray(outline_col)
                res[y, x, :3] = c
                res[y, x, 3] = 1
        out = res
    if clean:
        out = remove_orphans(out)
    return out


def remove_orphans(img):
    """Remove single isolated opaque pixels and fill single transparent holes."""
    H, W, _ = img.shape
    a = img[..., 3] > 0
    pad = np.pad(a, 1)
    cnt = sum(np.roll(np.roll(pad, dy, 0), dx, 1) for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)))[1:-1, 1:-1]
    out = img.copy()
    out[a & (cnt == 0), 3] = 0
    return out


def to_u8(img):
    return (np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)


def render_sprite(prims, mats, W, H, anchor_world, anchor_px, yaw=0, pitch=12, scale=1.0, light=(-0.55, 0.75, 0.55), ambient=0.3, outline=True, inner=True, depth_thresh=2.2, steps=96, outline_col=None):
    sc = Scene(prims)
    pos, hit, t, basis, WH = raymarch(sc, W, H, (None, anchor_world, anchor_px[0], anchor_px[1]), yaw, pitch, scale, steps=steps)
    rgba, matid, depth, lit = shade(sc, mats, pos, hit, t, basis, WH, light=light, ambient=ambient)
    img = postprocess(rgba, matid, depth, lit, mats, outline=outline, inner=inner, depth_thresh=depth_thresh, outline_col=outline_col)
    return img, dict(matid=matid, depth=depth, basis=basis)


def project(pt, anchor_world, anchor_px, yaw, pitch, scale=1.0):
    right, up, fwd = camera_basis(yaw, pitch)
    d = np.asarray(pt) - np.asarray(anchor_world)
    x = anchor_px[0] + (d @ right) / scale
    y = anchor_px[1] - (d @ up) / scale
    z = -(d @ fwd)
    return x, y, z
