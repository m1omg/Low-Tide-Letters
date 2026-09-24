#!/usr/bin/env python3
"""Shared helpers for the art pipeline (Pillow + numpy only, no scipy / opencv).

Everything here works on numpy arrays:
  * "arr"   = uint8  H x W x 4 straight (non premultiplied) RGBA
  * "mask"  = bool   H x W
  * "alpha" = float32 H x W in 0..1

Main entry points used by the CLI tools
  load_rgba(path)                 -> arr
  prepare_cutout(arr, bg='auto')  -> arr with clean alpha + defringed colours (raw scale)
  label_components(mask)          -> (labels int32 HxW, [Component])
  detect_items(mask, ...)         -> [Item] in reading order (grid aware, merges fragments)
  extract_item(arr, labels, item) -> cropped arr that only contains that item
  resize_rgba(arr, (w, h), box)   -> premultiplied LANCZOS resize
  trim(arr, margin)               -> cropped arr
  save_png(arr, path)
"""
from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ASSETS_IMG = ROOT / 'assets' / 'img'
ART_RAW = ROOT / 'art_raw'
PREVIEW_DIR = ART_RAW / '_preview'

TILE_REAL = 96            # one map tile in real (2x) pixels
PAPER = (246, 241, 228)   # default paper colour used when a background has to be invented

# Defringe defaults for raw generations with real alpha (tuned on the R&D sheets):
#   alpha below LO is treated as garbage (red/yellow fringe lives at alpha 1..60, a whitish paper halo
#   lives up to about alpha 215), alpha above HI is fully opaque. Colours are only trusted where the raw
#   alpha is >= TRUST and at least TRUST_ERODE px away from the matte edge; everything else gets its colour
#   from the nearest trusted pixel (bleed).
DEFRINGE = dict(lo=150, hi=245, trust=240, trust_erode=1, bleed=12, fill_interior=3)


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def resolve(path) -> Path:
    """Resolve a user supplied path; relative paths are relative to the project ROOT."""
    p = Path(path)
    return p if p.is_absolute() else (ROOT / p)


def ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


# --------------------------------------------------------------------------------------------------
# loading / saving
# --------------------------------------------------------------------------------------------------

def load_rgba(path) -> np.ndarray:
    im = Image.open(resolve(path))
    im.load()
    return np.array(im.convert('RGBA'))


def save_png(arr: np.ndarray, path, optimize=True) -> Path:
    path = resolve(path)
    ensure_dir(path.parent)
    a = np.asarray(arr)
    if a.dtype != np.uint8:
        a = np.clip(np.rint(a), 0, 255).astype(np.uint8)
    if a.ndim == 3 and a.shape[2] == 4:
        a = a.copy()
        a[a[..., 3] == 0] = 0      # fully transparent pixels carry no colour (smaller files, no surprises)
    Image.fromarray(a).save(path, optimize=optimize)
    return path


def write_json(obj, path) -> Path:
    path = resolve(path)
    ensure_dir(path.parent)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, indent=2)
        f.write('\n')
    return path


def has_real_alpha(arr: np.ndarray, min_frac=0.02) -> bool:
    """True when the image really uses transparency (not just an opaque RGBA)."""
    if arr.ndim != 3 or arr.shape[2] < 4:
        return False
    return float((arr[..., 3] < 16).mean()) >= min_frac


# --------------------------------------------------------------------------------------------------
# morphology / filters (numpy only)
# --------------------------------------------------------------------------------------------------

def dilate(mask: np.ndarray, r: int = 1) -> np.ndarray:
    """Binary dilation by r px. Alternates 4- and 8-neighbourhoods so the shape stays roundish."""
    m = np.asarray(mask, dtype=bool)
    for i in range(int(r)):
        n = m.copy()
        n[1:] |= m[:-1]
        n[:-1] |= m[1:]
        n[:, 1:] |= m[:, :-1]
        n[:, :-1] |= m[:, 1:]
        if i % 2 == 1:
            n[1:, 1:] |= m[:-1, :-1]
            n[1:, :-1] |= m[:-1, 1:]
            n[:-1, 1:] |= m[1:, :-1]
            n[:-1, :-1] |= m[1:, 1:]
        m = n
    return m


def erode(mask: np.ndarray, r: int = 1) -> np.ndarray:
    """Binary erosion by r px (the outside of the image counts as foreground, so shapes that touch the
    image border, e.g. busts cut at the bottom, are not eaten from that side)."""
    return ~dilate(~np.asarray(mask, dtype=bool), r)


def box_blur(a: np.ndarray, r: int, passes: int = 1) -> np.ndarray:
    """Box blur with radius r along both axes (edge-replicated). Works for HxW and HxWxC float arrays.
    passes=3 approximates a gaussian."""
    a = np.asarray(a, dtype=np.float32)
    r = int(r)
    if r <= 0:
        return a.copy()
    for _ in range(passes):
        for axis in (0, 1):
            pad = [(0, 0)] * a.ndim
            pad[axis] = (r + 1, r)
            p = np.pad(a, pad, mode='edge').astype(np.float64)
            c = np.cumsum(p, axis=axis)
            n = a.shape[axis]
            hi = np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=axis)
            lo = np.take(c, np.arange(0, n), axis=axis)
            a = ((hi - lo) / (2 * r + 1)).astype(np.float32)
    return a


def smoothstep(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3.0 - 2.0 * x)


def bleed_colors(rgb: np.ndarray, known: np.ndarray, iters: int = 12) -> tuple[np.ndarray, np.ndarray]:
    """Push colours of `known` pixels outward into unknown pixels, one ring per iteration (each new pixel
    becomes the mean of its already known 8-neighbours). Returns (rgb float32, known mask)."""
    rgb = np.asarray(rgb, dtype=np.float32).copy()
    known = np.asarray(known, dtype=bool).copy()
    rgb[~known] = 0
    H, W = known.shape
    for _ in range(int(iters)):
        if known.all():
            break
        acc = np.zeros_like(rgb)
        cnt = np.zeros((H, W), np.float32)
        k = known.astype(np.float32)
        src = rgb * k[..., None]
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dy == 0 and dx == 0:
                    continue
                w = 1.0 if (dx == 0 or dy == 0) else 0.7
                ys_d = slice(max(dy, 0), H + min(dy, 0))
                ys_s = slice(max(-dy, 0), H + min(-dy, 0))
                xs_d = slice(max(dx, 0), W + min(dx, 0))
                xs_s = slice(max(-dx, 0), W + min(-dx, 0))
                acc[ys_d, xs_d] += src[ys_s, xs_s] * w
                cnt[ys_d, xs_d] += k[ys_s, xs_s] * w
        new = (~known) & (cnt > 0)
        if not new.any():
            break
        rgb[new] = acc[new] / cnt[new][:, None]
        known |= new
    return rgb, known


# --------------------------------------------------------------------------------------------------
# connected components (run based union-find, 8-connectivity)
# --------------------------------------------------------------------------------------------------

@dataclass
class Component:
    label: int
    area: int
    x0: int
    y0: int
    x1: int      # exclusive
    y1: int      # exclusive
    cx: float
    cy: float

    @property
    def w(self):
        return self.x1 - self.x0

    @property
    def h(self):
        return self.y1 - self.y0


def label_components(mask: np.ndarray) -> tuple[np.ndarray, list[Component]]:
    """Label 8-connected components. Returns (labels int32 with 0 = background, list of Component)."""
    mask = np.ascontiguousarray(mask, dtype=bool)
    H, W = mask.shape
    pad = np.zeros((H, W + 2), np.int8)
    pad[:, 1:-1] = mask
    d = np.diff(pad, axis=1)
    rs, cs = np.nonzero(d == 1)      # run starts (inclusive col)
    _, ce = np.nonzero(d == -1)      # run ends (exclusive col)
    n = len(rs)
    labels = np.zeros((H, W), np.int32)
    if n == 0:
        return labels, []
    row_ptr = np.searchsorted(rs, np.arange(H + 1)).tolist()
    s_l = cs.tolist()
    e_l = ce.tolist()
    parent = list(range(n))

    def find(i):
        root = i
        while parent[root] != root:
            root = parent[root]
        while parent[i] != root:
            parent[i], i = root, parent[i]
        return root

    for y in range(1, H):
        a0, a1 = row_ptr[y - 1], row_ptr[y]
        b0, b1 = row_ptr[y], row_ptr[y + 1]
        if a0 == a1 or b0 == b1:
            continue
        i, j = a0, b0
        while i < a1 and j < b1:
            if s_l[i] <= e_l[j] and s_l[j] <= e_l[i]:      # touching incl. diagonals
                ri, rj = find(i), find(j)
                if ri != rj:
                    if ri < rj:
                        parent[rj] = ri
                    else:
                        parent[ri] = rj
            if e_l[i] < e_l[j]:
                i += 1
            else:
                j += 1

    roots = np.fromiter((find(i) for i in range(n)), dtype=np.int64, count=n)
    uniq, run_label = np.unique(roots, return_inverse=True)
    run_label = (run_label + 1).astype(np.int32)
    k = len(uniq)
    lengths = (ce - cs).astype(np.int64)
    # paint runs
    total = int(lengths.sum())
    flat_start = rs.astype(np.int64) * W + cs
    before = np.cumsum(lengths) - lengths
    pos = np.repeat(flat_start - before, lengths) + np.arange(total)
    labels.reshape(-1)[pos] = np.repeat(run_label, lengths)
    # stats
    area = np.bincount(run_label, weights=lengths, minlength=k + 1)
    sx = np.bincount(run_label, weights=lengths * (cs + ce - 1) / 2.0, minlength=k + 1)
    sy = np.bincount(run_label, weights=lengths * rs, minlength=k + 1)
    x0 = np.full(k + 1, W, np.int64)
    x1 = np.zeros(k + 1, np.int64)
    y0 = np.full(k + 1, H, np.int64)
    y1 = np.zeros(k + 1, np.int64)
    np.minimum.at(x0, run_label, cs)
    np.maximum.at(x1, run_label, ce)
    np.minimum.at(y0, run_label, rs)
    np.maximum.at(y1, run_label, rs + 1)
    comps = [Component(l, int(area[l]), int(x0[l]), int(y0[l]), int(x1[l]), int(y1[l]),
                       float(sx[l] / area[l]), float(sy[l] / area[l])) for l in range(1, k + 1)]
    return labels, comps


def flood_from_border(passable: np.ndarray) -> np.ndarray:
    """Pixels of `passable` that are connected to the image border."""
    labels, _ = label_components(passable)
    border = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    border = border[border > 0]
    if len(border) == 0:
        return np.zeros_like(passable, dtype=bool)
    lut = np.zeros(labels.max() + 1, bool)
    lut[border] = True
    return lut[labels]


# --------------------------------------------------------------------------------------------------
# background removal + defringe
# --------------------------------------------------------------------------------------------------

def estimate_bg_color(arr: np.ndarray) -> np.ndarray:
    """Median colour of a thin frame along the image border (RGB float)."""
    rgb = arr[..., :3]
    t = max(2, min(arr.shape[0], arr.shape[1]) // 100)
    px = np.concatenate([rgb[:t].reshape(-1, 3), rgb[-t:].reshape(-1, 3),
                         rgb[:, :t].reshape(-1, 3), rgb[:, -t:].reshape(-1, 3)])
    return np.median(px, axis=0).astype(np.float32)


def defringe_alpha(arr: np.ndarray, lo=None, hi=None, trust=None, trust_erode=None, bleed=None,
                   fill_interior=None) -> np.ndarray:
    """Clean a raw generation that has REAL alpha.

    1. alpha levels: a' = smoothstep((a-lo)/(hi-lo)) - removes the low-alpha colour garbage and pulls the
       matte in by roughly one raw pixel; pixels deeper than `fill_interior` px inside the shape are forced
       fully opaque (the generator leaves alpha 200..250 speckles inside shapes).
    2. colours: trusted = erode(alpha >= trust, trust_erode); all other pixels take the colour of the
       nearest trusted pixels (bleed), which removes the red/yellow fringe and the whitish paper halo.
    """
    p = dict(DEFRINGE)
    for k_, v in dict(lo=lo, hi=hi, trust=trust, trust_erode=trust_erode, bleed=bleed,
                      fill_interior=fill_interior).items():
        if v is not None:
            p[k_] = v
    a = arr[..., 3].astype(np.float32)
    new_a = smoothstep((a - p['lo']) / float(p['hi'] - p['lo']))
    if p['fill_interior'] > 0:
        inner = erode(a >= 128, p['fill_interior'])
        new_a = np.maximum(new_a, inner.astype(np.float32))
    trusted = a >= p['trust']
    if p['trust_erode'] > 0:
        trusted = erode(trusted, p['trust_erode'])
    # thin features (hair wisps, finials) may lose every trusted pixel through the erosion:
    # give them back their own best pixels so they are not recoloured from far away.
    lost = (a >= p['trust']) & ~dilate(trusted, p['trust_erode'] + 1)
    trusted |= lost
    rgb, _ = bleed_colors(arr[..., :3], trusted, p['bleed'])
    out = np.empty(arr.shape, np.uint8)
    out[..., :3] = np.clip(np.rint(rgb), 0, 255).astype(np.uint8)
    out[..., 3] = np.clip(np.rint(new_a * 255), 0, 255).astype(np.uint8)
    return out


def paper_to_alpha(arr: np.ndarray, tol=26, band=3, bg=None, pockets: int = 0, holes: int = 0) -> np.ndarray:
    """Cut a subject out of a flat white / near-white PAPER background.

    Flood fill from the image borders through near-background pixels (tolerance `tol`, max channel
    difference; 1-px leaks are closed first), so enclosed whites such as eyes and teeth survive. The edge
    gets a soft alpha: inside a `band` px wide rim next to the removed background the alpha comes from
    "colour to alpha" un-mixing against the paper colour (pencil lines stay soft and lose their white
    contamination), deeper pixels are fully opaque.
    """
    rgb = arr[..., :3].astype(np.float32)
    bgc = estimate_bg_color(arr) if bg is None else np.asarray(bg, np.float32)
    diff = np.abs(rgb - bgc).max(-1)
    near = diff <= tol
    # close one-pixel leaks: flood only through the opened mask, then grow back
    core = erode(near, 1)
    flooded = flood_from_border(core)
    bgmask = dilate(flooded, 2) & near
    # enclosed paper pockets (between hair strands, inside handles ...) are NOT connected to the border and
    # stay opaque by default. pockets=N lets the fill jump across lines thinner than N px (up to 4 hops).
    if pockets and pockets > 0:
        plabels, pcomps = label_components(core & ~bgmask)
        if pcomps:
            big = np.array([c.label for c in pcomps if c.area >= 12], dtype=np.int64)
            for _ in range(4):
                zone = dilate(bgmask, int(pockets)) & (plabels > 0)
                hit = np.intersect1d(np.unique(plabels[zone]), big)
                if len(hit) == 0:
                    break
                add = np.isin(plabels, hit)
                bgmask |= dilate(add, 2) & near
                plabels[add] = 0
    # holes=A removes EVERY enclosed paper region of at least A px (gaps under a table, inside a handle).
    # Meant for props; never use it for anything with white eyes / teeth.
    if holes and holes > 0:
        hlabels, hcomps = label_components(core & ~bgmask)
        sel = np.array([c.label for c in hcomps if c.area >= holes], dtype=np.int64)
        if len(sel):
            bgmask |= dilate(np.isin(hlabels, sel), 2) & near
    fg = ~bgmask
    # "haze": paper-ish pixels (relaxed tolerance) that hang on to the removed background without a dark
    # line in between. They get a pure colour-to-alpha value (almost transparent) instead of the depth
    # based opacity, otherwise thin pencil strands would carry a whitish halo.
    relaxed = (diff <= 2.5 * tol) & fg
    haze = np.zeros_like(fg)
    cur = bgmask
    for _ in range(4):
        grow = dilate(cur, 1) & relaxed & ~haze
        if not grow.any():
            break
        haze |= grow
        cur = grow
    if pockets and pockets > 0:      # tiny paper specks between strands, too small to be "pockets"
        haze |= near & fg & dilate(bgmask, int(pockets))
    # depth (px) of the remaining foreground pixels from background + haze, limited to band
    depth = np.zeros(fg.shape, np.float32)
    cur = fg & ~haze
    for i in range(band):
        cur = erode(cur, 1)
        depth += cur
    w = np.clip(depth / float(band), 0, 1)           # 0 at the rim, 1 deep inside
    # colour-to-alpha against the paper colour
    bsafe = np.maximum(bgc, 1.0)
    dark = np.clip((bgc - rgb) / bsafe, 0, 1).max(-1)                     # channels darker than paper
    light = np.clip((rgb - bgc) / np.maximum(255.0 - bgc, 1.0), 0, 1).max(-1)
    c2a = np.maximum(dark, light)
    noise = float(tol) / 255.0 * 0.6
    c2a = np.clip((c2a - noise) / max(1e-3, (0.75 - noise)), 0, 1)       # paper grain -> 0, mid tones -> 1
    alpha = np.where(fg, c2a * (1 - w) + w, 0.0).astype(np.float32)
    # un-mix colours where alpha is partial: P = a F + (1-a) B
    a3 = np.maximum(alpha, 0.08)[..., None]
    un = (rgb - (1 - a3) * bgc) / a3
    un = np.clip(un, 0, 255)
    part = (alpha > 0) & (alpha < 0.999)
    rgb_out = rgb.copy()
    rgb_out[part] = un[part]
    # very low alpha pixels: colour from neighbours is more stable than the un-mix
    known = alpha >= 0.35
    bled, _ = bleed_colors(rgb_out, known, 6)
    lowa = alpha < 0.35
    rgb_out[lowa] = bled[lowa]
    out = np.empty(arr.shape[:2] + (4,), np.uint8)
    out[..., :3] = np.clip(np.rint(rgb_out), 0, 255).astype(np.uint8)
    out[..., 3] = np.clip(np.rint(alpha * 255), 0, 255).astype(np.uint8)
    return out


def prepare_cutout(arr: np.ndarray, bg: str = 'auto', tol: int = 26, pockets: int = 0, holes: int = 0,
                   **defringe_kw) -> np.ndarray:
    """Return a raw-scale RGBA array with clean alpha and defringed colours.
    bg: 'auto' (real alpha if the image has it, else paper), 'alpha', 'white'/'paper'.
    tol / pockets / holes only matter for paper backgrounds (see paper_to_alpha)."""
    if bg == 'auto':
        bg = 'alpha' if has_real_alpha(arr) else 'paper'
    if bg == 'alpha':
        return defringe_alpha(arr, **defringe_kw)
    if bg in ('white', 'paper'):
        if has_real_alpha(arr):      # flatten first, then treat as paper
            arr = flatten(arr, (255, 255, 255))
        return paper_to_alpha(arr, tol=tol, pockets=pockets, holes=holes)
    raise ValueError('unknown bg mode: %s' % bg)


def add_bg_args(ap) -> None:
    """The background options shared by every cut-out tool (argparse)."""
    ap.add_argument('--bg', default='auto', choices=['auto', 'alpha', 'white', 'paper'],
                    help='background of the raw image: auto = real alpha if present, else white paper')
    ap.add_argument('--tol', type=int, default=26,
                    help='paper only: flood-fill tolerance (max channel difference to the paper colour)')
    ap.add_argument('--pockets', type=int, default=0,
                    help='paper only: also clear enclosed paper pockets separated from the outside by lines '
                         'thinner than N raw px (gaps between hair strands). OFF by default: it can punch '
                         'out white eyes/teeth that sit right at the silhouette')
    ap.add_argument('--holes', type=int, default=0,
                    help='paper only: clear EVERY enclosed paper region of at least N raw px (gaps under a '
                         'table, inside a handle). For props only - it would also remove white eyes')


def bg_opts(args) -> dict:
    """argparse namespace -> keyword arguments for prepare_cutout."""
    return dict(bg=args.bg, tol=args.tol, pockets=args.pockets, holes=args.holes)


def flatten(arr: np.ndarray, color=PAPER) -> np.ndarray:
    """Composite RGBA over an opaque colour. Returns opaque RGBA."""
    a = arr[..., 3:4].astype(np.float32) / 255.0
    rgb = arr[..., :3].astype(np.float32) * a + np.asarray(color, np.float32) * (1 - a)
    out = np.empty(arr.shape, np.uint8)
    out[..., :3] = np.clip(np.rint(rgb), 0, 255).astype(np.uint8)
    out[..., 3] = 255
    return out


# --------------------------------------------------------------------------------------------------
# resize / trim / paste
# --------------------------------------------------------------------------------------------------

def resize_rgba(arr: np.ndarray, size: tuple[int, int], box=None, resample=Image.LANCZOS) -> np.ndarray:
    """High quality resize of straight RGBA through premultiplied float channels (no dark/white halos).
    size = (w, h); box = optional float source box (x0, y0, x1, y1) inside the array."""
    a = arr[..., 3].astype(np.float32) / 255.0
    chans = [arr[..., c].astype(np.float32) * a for c in range(3)] + [a * 255.0]
    out = []
    for ch in chans:
        im = Image.fromarray(ch, mode='F').resize(size, resample=resample, box=box)
        out.append(np.asarray(im, dtype=np.float32))
    na = np.clip(out[3], 0, 255)
    res = np.zeros((size[1], size[0], 4), np.float32)
    safe = np.maximum(na / 255.0, 1e-4)
    for c in range(3):
        res[..., c] = np.clip(out[c] / safe, 0, 255)
    res[..., 3] = na
    res8 = np.clip(np.rint(res), 0, 255).astype(np.uint8)
    res8[res8[..., 3] == 0] = 0
    return res8


def resize_rgb(rgb: np.ndarray, size: tuple[int, int], resample=Image.LANCZOS) -> np.ndarray:
    return np.asarray(Image.fromarray(np.ascontiguousarray(rgb[..., :3]).astype(np.uint8), 'RGB')
                      .resize(size, resample=resample))


def alpha_bbox(alpha: np.ndarray, thr: int = 8):
    """Bounding box (x0, y0, x1, y1) (exclusive max) of alpha > thr, or None."""
    m = alpha > thr
    ys = np.flatnonzero(m.any(1))
    xs = np.flatnonzero(m.any(0))
    if len(ys) == 0:
        return None
    return int(xs[0]), int(ys[0]), int(xs[-1]) + 1, int(ys[-1]) + 1


def trim(arr: np.ndarray, margin: int = 0, thr: int = 8) -> np.ndarray:
    """Crop to the alpha bounding box and add `margin` transparent px on every side."""
    bb = alpha_bbox(arr[..., 3], thr)
    if bb is None:
        return arr
    x0, y0, x1, y1 = bb
    c = arr[y0:y1, x0:x1]
    if margin > 0:
        out = np.zeros((c.shape[0] + 2 * margin, c.shape[1] + 2 * margin, 4), np.uint8)
        out[margin:margin + c.shape[0], margin:margin + c.shape[1]] = c
        c = out
    return c


def paste(dst: np.ndarray, src: np.ndarray, x: int, y: int) -> None:
    """Copy src (RGBA) into dst at (x, y), clipping at the borders (plain copy where src alpha > 0)."""
    H, W = dst.shape[:2]
    h, w = src.shape[:2]
    sx0, sy0 = max(0, -x), max(0, -y)
    sx1, sy1 = min(w, W - x), min(h, H - y)
    if sx1 <= sx0 or sy1 <= sy0:
        return
    s = src[sy0:sy1, sx0:sx1]
    d = dst[y + sy0:y + sy1, x + sx0:x + sx1]
    m = s[..., 3] > 0
    d[m] = s[m]


def pad_canvas(arr: np.ndarray, left: int, top: int, right: int, bottom: int) -> np.ndarray:
    out = np.zeros((arr.shape[0] + top + bottom, arr.shape[1] + left + right, arr.shape[2]), arr.dtype)
    out[top:top + arr.shape[0], left:left + arr.shape[1]] = arr
    return out


def render_to_frame(crop: np.ndarray, frame_w: int, frame_h: int, scale: float,
                    src_x0: float, src_y0: float) -> np.ndarray:
    """Resample `crop` (raw-scale RGBA) straight into a frame_w x frame_h frame with ONE LANCZOS pass.
    The frame's top-left corner corresponds to the (float) source position (src_x0, src_y0) and one frame
    pixel covers 1/scale source pixels, so placement is sub-pixel exact. Parts outside the frame are cut."""
    inv = 1.0 / scale
    bw, bh = frame_w * inv, frame_h * inv
    pl = int(max(0, np.ceil(-src_x0))) + 2
    pt = int(max(0, np.ceil(-src_y0))) + 2
    pr = int(max(0, np.ceil(src_x0 + bw - crop.shape[1]))) + 2
    pb = int(max(0, np.ceil(src_y0 + bh - crop.shape[0]))) + 2
    canvas = pad_canvas(crop, pl, pt, pr, pb)
    box = (src_x0 + pl, src_y0 + pt, src_x0 + pl + bw, src_y0 + pt + bh)
    return resize_rgba(canvas, (frame_w, frame_h), box=box)


def measure_figure(crop: np.ndarray, head_frac: float = 0.4, thr: int = 127) -> dict:
    """Bounding box of the solid part of a cut-out figure plus the centroid of its HEAD region (the upper
    `head_frac` of the figure). All values in crop pixels; right/bottom are exclusive."""
    solid = crop[..., 3] > thr
    ys = np.flatnonzero(solid.any(1))
    xs = np.flatnonzero(solid.any(0))
    if len(ys) == 0:
        raise ValueError('empty figure')
    top, bottom = int(ys[0]), int(ys[-1]) + 1
    left, right = int(xs[0]), int(xs[-1]) + 1
    h = bottom - top
    head = solid[top:top + max(4, int(round(head_frac * h)))]
    colsum = head.sum(0).astype(np.float64)
    rowsum = head.sum(1).astype(np.float64)
    tot = max(colsum.sum(), 1.0)
    head_cx = float((colsum * np.arange(solid.shape[1])).sum() / tot) + 0.5
    head_cy = float((rowsum * np.arange(len(rowsum))).sum() / tot) + 0.5 + top
    return dict(top=top, bottom=bottom, left=left, right=right, w=right - left, h=h,
                head_cx=head_cx, head_cy=head_cy, profile=solid.sum(1).astype(np.float32))


# --------------------------------------------------------------------------------------------------
# item detection (grid sheets and free prop sheets)
# --------------------------------------------------------------------------------------------------

@dataclass
class Item:
    labels: list = field(default_factory=list)
    x0: int = 0
    y0: int = 0
    x1: int = 0
    y1: int = 0
    area: int = 0
    cx: float = 0.0
    cy: float = 0.0
    row: int = 0
    col: int = 0

    def add(self, c: Component):
        if not self.labels:
            self.x0, self.y0, self.x1, self.y1 = c.x0, c.y0, c.x1, c.y1
            self.cx, self.cy = c.cx, c.cy
        else:
            self.cx = (self.cx * self.area + c.cx * c.area) / (self.area + c.area)
            self.cy = (self.cy * self.area + c.cy * c.area) / (self.area + c.area)
            self.x0, self.y0 = min(self.x0, c.x0), min(self.y0, c.y0)
            self.x1, self.y1 = max(self.x1, c.x1), max(self.y1, c.y1)
        self.labels.append(c.label)
        self.area += c.area


def _rect_dist(a, b) -> float:
    dx = max(b.x0 - a.x1, a.x0 - b.x1, 0)
    dy = max(b.y0 - a.y1, a.y0 - b.y1, 0)
    return float(np.hypot(dx, dy))


def _cluster_rows(items: list) -> list[list]:
    """Group items into rows (reading order): an item joins the current row when its centre lies inside
    the vertical band spanned by the row so far."""
    rows: list[list] = []
    for it in sorted(items, key=lambda c: c.cy):
        if rows:
            top = min(c.y0 for c in rows[-1])
            bot = max(c.y1 for c in rows[-1])
            band = bot - top
            if it.cy < bot - 0.15 * band and it.y0 < bot - 0.35 * min(band, it.y1 - it.y0):
                rows[-1].append(it)
                continue
        rows.append([it])
    for r in rows:
        r.sort(key=lambda c: c.cx)
    return rows


def detect_items(mask: np.ndarray, rows: int | None = None, cols: int | None = None,
                 count: int | None = None, speck_area: int = 24, max_merge_dist: float | None = None,
                 force_grid: bool = False, verbose: bool = True):
    """Find the drawn items of a sheet.

    Returns (labels, items) with items in reading order. Strategy:
      * label connected components, ignore specks (< speck_area px),
      * the N biggest components (N = rows*cols or `count`) are the item bodies; they are put in reading
        order by row clustering; remaining fragments are merged into the nearest body,
      * if that does not yield a consistent grid (wrong count, bodies sharing a cell, ...) or `force_grid`
        is set, fall back to an even rows x cols split: every component belongs to the cell that contains
        its centre.
    """
    H, W = mask.shape
    labels, comps = label_components(mask)
    comps = [c for c in comps if c.area >= speck_area]
    n_expected = rows * cols if (rows and cols) else count
    if not comps:
        return labels, []
    comps_by_area = sorted(comps, key=lambda c: -c.area)

    def pixel_grid():
        """Last resort: cut the mask along the even grid lines (figures that touch each other)."""
        keep_lut = np.zeros(labels.max() + 1, bool)
        keep_lut[[c.label for c in comps]] = True
        m2 = keep_lut[labels]
        lab2 = np.zeros_like(labels)
        out = []
        for r in range(rows):
            for k in range(cols):
                y0, y1 = int(round(r * H / rows)), int(round((r + 1) * H / rows))
                x0, x1 = int(round(k * W / cols)), int(round((k + 1) * W / cols))
                sub = m2[y0:y1, x0:x1]
                it = Item(row=r, col=k)
                if sub.any():
                    idx = r * cols + k + 1
                    lab2[y0:y1, x0:x1][sub] = idx
                    ys, xs = np.flatnonzero(sub.any(1)), np.flatnonzero(sub.any(0))
                    it.labels = [idx]
                    it.x0, it.x1 = x0 + int(xs[0]), x0 + int(xs[-1]) + 1
                    it.y0, it.y1 = y0 + int(ys[0]), y0 + int(ys[-1]) + 1
                    it.area = int(sub.sum())
                    it.cx, it.cy = (it.x0 + it.x1) / 2.0, (it.y0 + it.y1) / 2.0
                elif verbose:
                    log(f'  [detect] WARNING: grid cell r{r} c{k} is empty')
                out.append(it)
        return lab2, out

    def even_grid():
        if not (rows and cols):
            raise RuntimeError('cannot fall back to an even grid without rows/cols')
        cells = [[Item(row=r, col=c) for c in range(cols)] for r in range(rows)]
        spanning = False
        for c in comps:
            r = min(rows - 1, int(c.cy / (H / rows)))
            k = min(cols - 1, int(c.cx / (W / cols)))
            cells[r][k].add(c)
            if c.w > 1.35 * W / cols or c.h > 1.35 * H / rows:
                spanning = True
        out = [cells[r][k] for r in range(rows) for k in range(cols)]
        if spanning or any(not it.labels for it in out):
            if verbose:
                log('  [detect] items touch each other or a cell is empty -> cutting along the grid lines')
            return pixel_grid()
        return labels, out

    if force_grid:
        return even_grid()

    if n_expected is None:
        # free sheet without a known count: bodies = everything >= 8 % of the biggest component
        bodies = [c for c in comps_by_area if c.area >= 0.08 * comps_by_area[0].area]
    else:
        bodies = comps_by_area[:n_expected]
        ok = len(bodies) == n_expected
        if ok:
            med = float(np.median([c.area for c in bodies]))
            ok = bodies[-1].area >= 0.04 * med
        if not ok:
            if verbose:
                log(f'  [detect] expected {n_expected} bodies, found {len(bodies)} usable -> even grid fallback')
            if rows and cols:
                return even_grid()
            bodies = [c for c in bodies if c.area >= 0.04 * float(np.median([b.area for b in bodies]))]

    body_items = []
    for c in bodies:
        it = Item()
        it.add(c)
        body_items.append(it)

    if rows and cols:
        # consistency check against the grid: every body in its own cell
        seen = set()
        ok = True
        for it in body_items:
            r = min(rows - 1, int(it.cy / (H / rows)))
            k = min(cols - 1, int(it.cx / (W / cols)))
            it.row, it.col = r, k
            if (r, k) in seen:
                ok = False
            seen.add((r, k))
        if not ok:
            # uneven sheet: try pure row clustering before giving up
            rws = _cluster_rows(body_items)
            if len(rws) == rows and all(len(r) == cols for r in rws):
                for r, rw in enumerate(rws):
                    for k, it in enumerate(rw):
                        it.row, it.col = r, k
            else:
                if verbose:
                    log('  [detect] bodies do not form a clean grid -> even grid fallback')
                return even_grid()
        body_items.sort(key=lambda it: (it.row, it.col))
    else:
        rws = _cluster_rows(body_items)
        body_items = []
        for r, rw in enumerate(rws):
            for k, it in enumerate(rw):
                it.row, it.col = r, k
                body_items.append(it)

    # merge fragments into the nearest body
    body_labels = {it.labels[0] for it in body_items}
    if max_merge_dist is None:
        ref = float(np.median([max(it.x1 - it.x0, it.y1 - it.y0) for it in body_items]))
        max_merge_dist = 0.35 * ref
    snapshot = [Item(labels=list(it.labels), x0=it.x0, y0=it.y0, x1=it.x1, y1=it.y1) for it in body_items]
    dropped = 0
    for c in comps:
        if c.label in body_labels:
            continue
        dists = [_rect_dist(c, s) for s in snapshot]
        j = int(np.argmin(dists))
        if dists[j] <= max_merge_dist:
            body_items[j].add(c)
        else:
            dropped += 1
    if dropped and verbose:
        log(f'  [detect] dropped {dropped} stray fragment(s) far away from every item')
    return labels, body_items


def extract_item(arr: np.ndarray, labels: np.ndarray, item: Item, pad: int = 6) -> tuple[np.ndarray, int, int]:
    """Crop `item` out of the cleaned sheet. Pixels that belong to other items / dropped fragments are
    made transparent; the soft alpha rim around the item's own components is kept.
    Returns (crop RGBA, crop_x0, crop_y0)."""
    H, W = labels.shape
    x0, y0 = max(0, item.x0 - pad), max(0, item.y0 - pad)
    x1, y1 = min(W, item.x1 + pad), min(H, item.y1 + pad)
    crop = arr[y0:y1, x0:x1].copy()
    lab = labels[y0:y1, x0:x1]
    own = np.isin(lab, np.asarray(item.labels))
    keep = dilate(own, 4)
    other = (lab > 0) & ~own
    keep &= ~dilate(other, 1)
    crop[..., 3] = np.where(keep, crop[..., 3], 0)
    return crop, x0, y0


def prune_far_fragments(labels: np.ndarray, comps_by_label: dict, item: Item, dist: int) -> int:
    """Keep the item's biggest component plus every fragment that lies within `dist` px (real pixel
    distance, grown transitively) of the kept set; stray doodles, text or sparkles further away are
    removed from item.labels. Returns the number of removed fragments."""
    if len(item.labels) <= 1:
        return 0
    comps = [comps_by_label[l] for l in item.labels]
    main = max(comps, key=lambda c: c.area)
    f = 4                                                   # work on a 4x reduced label map
    x0, y0 = max(0, item.x0 - dist - f), max(0, item.y0 - dist - f)
    x1, y1 = item.x1 + dist + f, item.y1 + dist + f
    lab = labels[y0:y1, x0:x1]
    hh, ww = (lab.shape[0] // f) * f, (lab.shape[1] // f) * f
    if hh == 0 or ww == 0:
        return 0
    small = lab[:hh, :ww].reshape(hh // f, f, ww // f, f).max(axis=(1, 3))
    own = np.isin(small, np.asarray(item.labels))
    kept = {main.label}
    r = max(1, int(np.ceil(dist / f)))
    for _ in range(8):
        zone = dilate(np.isin(small, np.asarray(sorted(kept))), r)
        touched = set(np.unique(small[zone & own]).tolist()) - {0}
        new = (touched & set(item.labels)) - kept
        if not new:
            break
        kept |= new
    removed = [l for l in item.labels if l not in kept]
    if removed:
        keep_comps = [comps_by_label[l] for l in item.labels if l in kept]
        fresh = Item(row=item.row, col=item.col)
        for c in sorted(keep_comps, key=lambda c: -c.area):
            fresh.add(c)
        item.labels, item.area = fresh.labels, fresh.area
        item.x0, item.y0, item.x1, item.y1 = fresh.x0, fresh.y0, fresh.x1, fresh.y1
        item.cx, item.cy = fresh.cx, fresh.cy
    return len(removed)


# --------------------------------------------------------------------------------------------------
# small drawing helpers for previews
# --------------------------------------------------------------------------------------------------

def checkerboard(w: int, h: int, cell: int = 16, c0=(200, 200, 205), c1=(150, 150, 160)) -> np.ndarray:
    yy, xx = np.mgrid[0:h, 0:w]
    m = ((xx // cell) + (yy // cell)) % 2 == 0
    out = np.empty((h, w, 3), np.uint8)
    out[m] = c0
    out[~m] = c1
    return out


def composite_over(bg_rgb: np.ndarray, arr: np.ndarray, x: int = 0, y: int = 0) -> None:
    """Alpha composite RGBA `arr` onto the RGB array `bg_rgb` in place at (x, y)."""
    H, W = bg_rgb.shape[:2]
    h, w = arr.shape[:2]
    sx0, sy0 = max(0, -x), max(0, -y)
    sx1, sy1 = min(w, W - x), min(h, H - y)
    if sx1 <= sx0 or sy1 <= sy0:
        return
    s = arr[sy0:sy1, sx0:sx1].astype(np.float32)
    d = bg_rgb[y + sy0:y + sy1, x + sx0:x + sx1].astype(np.float32)
    a = s[..., 3:4] / 255.0 if s.shape[2] == 4 else 1.0
    bg_rgb[y + sy0:y + sy1, x + sx0:x + sx1] = np.clip(np.rint(s[..., :3] * a + d * (1 - a)), 0, 255).astype(np.uint8)


def get_font(size: int = 14):
    from PIL import ImageFont
    for cand in (ROOT / 'assets' / 'fonts' / 'PatrickHand-Regular.ttf',):
        try:
            return ImageFont.truetype(str(cand), size)
        except Exception:
            pass
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


SKIP_TOKENS = ('', '-', '_', 'skip')


def is_skip(name: str) -> bool:
    """True for the "skip this cell" placeholders in --names / --spec lists ('-', '_', 'skip', '').
    Tip: argparse treats a value that starts with '-' as an option, so write --names=-,a,b or use '_'."""
    return name.strip().lower() in SKIP_TOKENS


def parse_size(text: str) -> tuple[int, int]:
    t = str(text).lower().replace(' ', '')
    if 'x' in t:
        w, h = t.split('x')
        return int(w), int(h)
    return int(t), int(t)


def rel(path) -> str:
    """Path relative to ROOT for log output."""
    try:
        return os.path.relpath(str(path), str(ROOT))
    except Exception:
        return str(path)
