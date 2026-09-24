#!/usr/bin/env python3
"""Swatch sheet -> seamless terrain blocks assets/img/terrain/ter_<name>.png (opaque, 192 or 288 px).

How it works
  1. the swatch cells are located by their gutters (transparent or light lines); falls back to an even
     rows x cols split; every cell is cropped well inside its border (--inset),
  2. large scale brightness blotches are flattened a little (--flatten) so repeats are less obvious,
  3. the block is made seamless on both axes:
       blend (default)   wrap-around cross-blend: the strip that continues past the crop is blended over
                         the opposite side; low frequencies are cross-faded linearly, details switch
                         along a minimum-error seam (no ghosting of grass tufts / stones),
       pattern:<n>       regular patterns (checker tiles, planks, polka dots): the pattern period is
                         measured by autocorrelation, exactly n periods are cropped per axis, only a
                         narrow seam is blended and the result is rolled so a pattern edge sits on the
                         tile boundary. pattern:<nx>x<ny> sets the axes separately; 0 = "this axis is
                         not periodic, use blend" (planks: pattern:0x4). An axis without a clear period
                         falls back to blend automatically.
  4. LANCZOS downscale on a 3x3 tiling (so the resize itself cannot create a seam),
  5. ALWAYS writes a 5x5 tiled preview art_raw/_preview/ter_<name>_tiled.png + an overview sheet.

CLI
  python3 tools/art/make_terrain.py art_raw/terrain/ground_a.png --grid 3x3 \
      --names "grass,forest_grass,dirt,cobble,planks=pattern:0x4,water,carpet=pattern:3,checker=pattern:2,void"
      [--size 192|288] [--mode blend|pattern:<n>] [--overlap 0.22] [--inset 0.035] [--flatten 0.6]
      [--prefix ter_] [--out-dir assets/img/terrain] [--format png|jpg]
  Names are in reading order, "_" (or "-" / "skip") skips a cell, "name=mode" overrides --mode for that
  swatch. (A list that STARTS with "-" must be written as --names=-,a,b because of argparse.)
  A single swatch image (no grid) works with --grid 1x1.

Import: from make_terrain import make_terrain_sheet, make_seamless
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C  # noqa: E402
from contact_sheet import make_contact_sheet  # noqa: E402


# ---- cell detection --------------------------------------------------------------------------------

def _gutter_mask(arr: np.ndarray) -> np.ndarray:
    if C.has_real_alpha(arr, 0.003):
        return arr[..., 3] < 128
    rgb = arr[..., :3].astype(np.int16)
    return (rgb.min(-1) >= 232) & ((rgb.max(-1) - rgb.min(-1)) <= 14)


def _axis_bounds(profile: np.ndarray, n: int) -> list[tuple[int, int]] | None:
    """profile = fraction of gutter pixels per column. Returns n (start, end) cell spans or None."""
    L = len(profile)
    g = profile > 0.6
    cell = L / float(n)
    cuts = []      # (gutter_start, gutter_end) for the n-1 interior gutters
    for k in range(1, n):
        c = int(round(k * cell))
        lo, hi = int(c - 0.18 * cell), int(c + 0.18 * cell)
        idx = np.flatnonzero(g[lo:hi]) + lo
        if len(idx) == 0:
            return None
        # the run closest to the expected position
        best = idx[np.argmin(np.abs(idx - c))]
        s = e = int(best)
        while s - 1 >= 0 and g[s - 1]:
            s -= 1
        while e + 1 < L and g[e + 1]:
            e += 1
        cuts.append((s, e + 1))
    # outer margins
    start = 0
    while start < L and g[start]:
        start += 1
    end = L
    while end > 0 and g[end - 1]:
        end -= 1
    spans = []
    prev = start
    for s, e in cuts:
        spans.append((prev, s))
        prev = e
    spans.append((prev, end))
    if any(b - a < 0.5 * cell for a, b in spans):
        return None
    return spans


def find_cells(arr: np.ndarray, rows: int, cols: int) -> list[tuple[int, int, int, int]]:
    """Cell rectangles (x0, y0, x1, y1) in reading order."""
    H, W = arr.shape[:2]
    gm = _gutter_mask(arr)
    xs = _axis_bounds(gm.mean(0), cols) if cols > 1 else None
    ys = _axis_bounds(gm.mean(1), rows) if rows > 1 else None
    if xs is None:
        if cols > 1:
            C.log('  [cells] no clear vertical gutters -> even split')
        xs = [(int(round(k * W / cols)), int(round((k + 1) * W / cols))) for k in range(cols)]
    if ys is None:
        if rows > 1:
            C.log('  [cells] no clear horizontal gutters -> even split')
        ys = [(int(round(k * H / rows)), int(round((k + 1) * H / rows))) for k in range(rows)]
    return [(x0, y0, x1, y1) for (y0, y1) in ys for (x0, x1) in xs]


# ---- seam machinery --------------------------------------------------------------------------------

def _dp_seam(err: np.ndarray, margin: int, cyclic: bool) -> np.ndarray:
    """Minimum-error path through err (n x o): one position per line, moving at most 1 px per line and
    staying inside [margin, o-margin). cyclic=True forces the path to end where it started (+-1)."""
    n, o = err.shape
    lo, hi = margin, o - margin
    if hi - lo < 2:
        return np.full(n, o // 2, np.int64)
    e = err[:, lo:hi].astype(np.float64)
    m = e.shape[1]
    INF = 1e18
    if not cyclic:
        cost = e[0].copy()
        back = np.zeros((n, m), np.int8)
        for i in range(1, n):
            left = np.concatenate([[INF], cost[:-1]])
            right = np.concatenate([cost[1:], [INF]])
            stack = np.stack([left, cost, right])
            k = np.argmin(stack, 0)
            back[i] = k - 1
            cost = e[i] + np.take_along_axis(stack, k[None], 0)[0]
        x = int(np.argmin(cost))
        path = np.zeros(n, np.int64)
        for i in range(n - 1, -1, -1):
            path[i] = x
            x = x + int(back[i, x])
        return path + lo
    # cyclic: one DP per start position, vectorised over the starts
    cost = np.full((m, m), INF)
    cost[np.arange(m), np.arange(m)] = e[0]
    back = np.zeros((n, m, m), np.int8)
    pad = np.full((m, 1), INF)
    for i in range(1, n):
        left = np.concatenate([pad, cost[:, :-1]], 1)
        right = np.concatenate([cost[:, 1:], pad], 1)
        stack = np.stack([left, cost, right])
        k = np.argmin(stack, 0)
        back[i] = k - 1
        cost = e[i][None, :] + np.take_along_axis(stack, k[None], 0)[0]
    best, bs, bx = INF, 0, 0
    for s in range(m):
        for x in (s - 1, s, s + 1):
            if 0 <= x < m and cost[s, x] < best:
                best, bs, bx = cost[s, x], s, x
    path = np.zeros(n, np.int64)
    x = bx
    for i in range(n - 1, -1, -1):
        path[i] = x
        x = x + int(back[i, bs, x])
    return path + lo


def _wrap_x(src: np.ndarray, W: int, o: int, feather: float, cyclic: bool, low_r: int) -> np.ndarray:
    """src: (h, >= W+o, 3) float32. Returns (h, W, 3) that tiles seamlessly along x."""
    src = src[:, :W + o]
    low = C.box_blur(src, low_r, passes=2) if low_r > 0 else np.zeros_like(src)
    high = src - low
    A_lo, B_lo = low[:, W:W + o], low[:, :o]
    A_hi, B_hi = high[:, W:W + o], high[:, :o]
    A, B = src[:, W:W + o], src[:, :o]
    err = ((A - B) ** 2).sum(-1)
    err = C.box_blur(err, 2)
    margin = int(np.ceil(feather)) + 1
    path = _dp_seam(err, margin, cyclic)                      # per line: first column that shows B
    xs = np.arange(o, dtype=np.float32)[None, :]
    m = C.smoothstep((xs - path[:, None].astype(np.float32)) / (2.0 * feather) + 0.5)[..., None]
    t = C.smoothstep((xs + 0.5) / o)[..., None]               # wide cross-fade for the low band
    out = src[:, :W].copy()
    out[:, :o] = A_lo * (1 - t) + B_lo * t + A_hi * (1 - m) + B_hi * m
    return out


def estimate_period(img: np.ndarray, axis: int, min_p: int | None = None, max_p: int | None = None) -> tuple[float, float]:
    """Dominant pattern period (px, float) along `axis` by autocorrelation; returns (period, strength).
    Periods below max(24, size/16) px are ignored (that is pencil grain, not the pattern)."""
    g = img.mean(-1).astype(np.float32)
    g = g - C.box_blur(g, 24, passes=2)
    if axis == 0:
        g = g.T
    n = g.shape[1]
    max_p = int(max_p or n // 2)
    min_p = int(min_p or max(24, n // 16))
    F = np.fft.rfft(g, axis=1)
    ac = np.fft.irfft((F * np.conj(F)).mean(0), n=n).real
    ac = ac / max(ac[0], 1e-9)
    # circular autocorrelation is fine here, lags <= n/2
    lags = np.arange(min_p, min(max_p, n // 2))
    if len(lags) < 3:
        return 0.0, 0.0
    v = ac[lags]
    peaks = [i for i in range(1, len(v) - 1) if v[i] >= v[i - 1] and v[i] >= v[i + 1]]
    if not peaks:
        return 0.0, 0.0
    top = max(peaks, key=lambda i: v[i])
    best = top
    for k in (4, 3, 2):                         # prefer the fundamental over its multiples
        target = lags[top] / k
        cand = [i for i in peaks if abs(lags[i] - target) <= 0.12 * target]
        if cand:
            c = max(cand, key=lambda i: v[i])
            if v[c] >= 0.75 * v[top]:
                best = c
                break
    i = best
    y0, y1, y2 = v[i - 1], v[i], v[i + 1]
    den = (y0 - 2 * y1 + y2)
    off = 0.5 * (y0 - y2) / den if abs(den) > 1e-9 else 0.0
    return float(lags[i] + off), float(v[i])


def _edge_profile(img: np.ndarray, axis: int) -> np.ndarray:
    """Mean gradient energy per position along `axis` (strong for straight pattern edges)."""
    g = img.mean(-1)
    d = np.abs(np.diff(g, axis=axis))
    prof = d.mean(1 - axis)
    return np.concatenate([prof, prof[-1:]])


def _plan_axis(cell: np.ndarray, axis: int, n_periods: int, overlap_frac: float, force_len: int | None):
    """Decide crop start / length / overlap / roll for one axis. Returns dict."""
    size = cell.shape[axis]
    if n_periods > 0:
        P, strength = estimate_period(cell, axis, max_p=int(size / max(1.2, n_periods * 0.98)))
        if P > 0 and strength >= 0.12:
            n = n_periods
            while n > 1 and n * P + 8 > size:
                n -= 1
            if n != n_periods:
                C.log(f'    axis {"y" if axis == 0 else "x"}: only {n} of {n_periods} period(s) fit into the swatch')
            L = int(round(n * P))
            o = int(max(6, min(round(0.10 * P), 16, size - L)))
            prof = _edge_profile(cell, axis)
            # choose the crop start where BOTH blend zones are calm and agree
            g = cell.mean(-1)
            if axis == 0:
                g = g.T
            best, x0 = None, 0
            for s in range(0, size - L - o + 1):
                a = g[:, s + L:s + L + o]
                b = g[:, s:s + o]
                score = float(((a - b) ** 2).mean()) + 0.5 * float(prof[s:s + o].mean() ** 2 + prof[s + L:s + L + o].mean() ** 2)
                if best is None or score < best:
                    best, x0 = score, s
            # roll so that a pattern edge (or, for soft patterns, the calmest line) lands on coordinate 0
            Pi = max(2, int(round(P)))
            fold = np.zeros(Pi, np.float64)
            cnt = np.zeros(Pi, np.float64)
            idx = (np.arange(size) - x0) % Pi
            np.add.at(fold, idx, prof[:size])
            np.add.at(cnt, idx, 1)
            fold = fold / np.maximum(cnt, 1)
            fold_s = np.convolve(np.concatenate([fold[-2:], fold, fold[:2]]), np.ones(3) / 3, 'same')[2:-2]
            peaked = fold_s.max() > 1.8 * np.median(fold_s)
            phase = int(np.argmax(fold_s) if peaked else np.argmin(fold_s))
            if peaked:
                phase += 1          # diff index i = edge between i and i+1
            return dict(kind='pattern', x0=x0, L=L, o=o, feather=max(1.5, o / 5.0), roll=-phase,
                        period=P, strength=strength, peaked=bool(peaked), n=n)
        C.log(f'    axis {"y" if axis == 0 else "x"}: no clear period (strength {strength:.2f}) -> blend')
    L = force_len if force_len else int(size / (1.0 + overlap_frac))
    o = size - L
    return dict(kind='blend', x0=0, L=L, o=o, feather=3.0, roll=0)


def make_seamless(cell_rgb: np.ndarray, mode: str = 'blend', overlap: float = 0.22, flatten: float = 0.6):
    """cell_rgb: uint8/float (h, w, 3) crop from inside a swatch. Returns (seamless float32 block, info)."""
    cell = np.asarray(cell_rgb[..., :3], dtype=np.float32)
    h, w = cell.shape[:2]
    if flatten > 0:
        r = max(8, min(h, w) // 5)
        low = C.box_blur(cell, r, passes=3)
        cell = np.clip(cell - flatten * (low - low.mean((0, 1), keepdims=True)), 0, 255)
    nx = ny = 0
    if mode.startswith('pattern'):
        spec = mode.split(':', 1)[1] if ':' in mode else '2'
        if 'x' in spec:
            a, b = spec.split('x')
            nx, ny = int(a), int(b)
        else:
            nx = ny = int(spec)
    elif mode != 'blend':
        raise ValueError(f'unknown mode {mode}')
    # blend axes keep the block square in source pixels unless the other axis is a pattern axis
    side = int(min(h, w) / (1.0 + overlap))
    px = _plan_axis(cell, 1, nx, overlap, side)
    py = _plan_axis(cell, 0, ny, overlap, side)
    if px['kind'] == 'blend' and py['kind'] == 'pattern':
        px['L'] = min(px['L'], max(py['L'], int(0.6 * side)))
        px['o'] = min(w - px['L'], int(overlap * px['L']) + 8)
    if py['kind'] == 'blend' and px['kind'] == 'pattern':
        py['L'] = min(py['L'], max(px['L'], int(0.6 * side)))
        py['o'] = min(h - py['L'], int(overlap * py['L']) + 8)
    src = cell[py['x0']:py['x0'] + py['L'] + py['o'], px['x0']:px['x0'] + px['L'] + px['o']]
    low_rx = max(2, px['o'] // 4) if px['kind'] == 'blend' else 0
    low_ry = max(2, py['o'] // 4) if py['kind'] == 'blend' else 0
    r1 = _wrap_x(src, px['L'], px['o'], px['feather'], cyclic=False, low_r=low_rx)
    r1t = np.ascontiguousarray(np.transpose(r1, (1, 0, 2)))
    r2t = _wrap_x(r1t, py['L'], py['o'], py['feather'], cyclic=True, low_r=low_ry)
    out = np.ascontiguousarray(np.transpose(r2t, (1, 0, 2)))
    seam = seam_score(out)          # measured BEFORE rolling a pattern edge onto the block boundary
    if px['roll']:
        out = np.roll(out, px['roll'], axis=1)
    if py['roll']:
        out = np.roll(out, py['roll'], axis=0)
    return np.clip(out, 0, 255), dict(x=px, y=py, seam=seam)


def seam_score(block: np.ndarray) -> tuple[float, float]:
    """Ratio of the colour jump across the wrap boundary to the typical jump between neighbouring
    lines, for x and y. About 1.0 = invisible; > 1.6 deserves a look."""
    b = block.astype(np.float32)
    dx = np.abs(np.diff(b, axis=1)).mean((0, 2))
    dy = np.abs(np.diff(b, axis=0)).mean((1, 2))
    wx = np.abs(b[:, 0] - b[:, -1]).mean()
    wy = np.abs(b[0] - b[-1]).mean()
    return float(wx / max(np.median(dx), 1e-6)), float(wy / max(np.median(dy), 1e-6))


def downscale_tileable(block: np.ndarray, size: int) -> np.ndarray:
    b8 = np.clip(np.rint(block), 0, 255).astype(np.uint8)
    tiled = np.tile(b8, (3, 3, 1))
    im = Image.fromarray(tiled, 'RGB').resize((size * 3, size * 3), Image.LANCZOS)
    return np.asarray(im)[size:2 * size, size:2 * size].copy()


def tiled_preview(block: np.ndarray, path: Path, n: int = 5) -> Path:
    size = block.shape[0]
    m = 14
    canvas = np.full((size * n + 2 * m, size * n + 2 * m, 3), 40, np.uint8)
    canvas[m:m + size * n, m:m + size * n] = np.tile(block, (n, n, 1))
    im = Image.fromarray(canvas)
    d = ImageDraw.Draw(im)
    for k in range(n + 1):          # ticks in the margin mark the block boundaries
        p = m + k * size
        d.line([(p, 0), (p, m - 3)], fill=(255, 80, 80), width=2)
        d.line([(p, m + size * n + 3), (p, 2 * m + size * n)], fill=(255, 80, 80), width=2)
        d.line([(0, p), (m - 3, p)], fill=(255, 80, 80), width=2)
        d.line([(m + size * n + 3, p), (2 * m + size * n, p)], fill=(255, 80, 80), width=2)
    C.ensure_dir(path.parent)
    im.save(path, optimize=True)
    return path


def make_terrain_sheet(sheet_path, names: list[str], grid=(3, 3), size: int = 192, mode: str = 'blend',
                       overlap: float = 0.22, inset: float = 0.035, flatten: float = 0.6,
                       prefix: str = 'ter_', out_dir='assets/img/terrain', fmt: str = 'png',
                       preview_name: str | None = None) -> list[dict]:
    if size % C.TILE_REAL != 0:
        raise ValueError('--size must be a multiple of 96 (192 or 288)')
    arr = C.load_rgba(sheet_path)
    rows, cols = grid
    C.log(f'[make_terrain] {C.rel(C.resolve(sheet_path))}  {arr.shape[1]}x{arr.shape[0]}  grid {rows}x{cols}')
    cells = find_cells(arr, rows, cols)
    if len(names) > len(cells):
        raise ValueError(f'{len(names)} names for {len(cells)} cells')
    out_dir = C.resolve(out_dir)
    results, blocks = [], []
    for name_spec, (x0, y0, x1, y1) in zip(names, cells):
        name_spec = name_spec.strip()
        if C.is_skip(name_spec):
            continue
        name, m = (name_spec.split('=', 1) + [mode])[:2] if '=' in name_spec else (name_spec, mode)
        cw, ch = x1 - x0, y1 - y0
        ins = max(6, int(round(inset * min(cw, ch))))
        # grow the inset until no transparent / gutter pixels are left inside the crop
        for _ in range(6):
            crop = arr[y0 + ins:y1 - ins, x0 + ins:x1 - ins]
            if crop[..., 3].min() >= 200:
                break
            ins += 4
        C.log(f'  {name}: cell ({x0},{y0})-({x1},{y1}) inset {ins} -> {crop.shape[1]}x{crop.shape[0]}  mode {m}')
        block, info = make_seamless(crop[..., :3], mode=m, overlap=overlap, flatten=flatten)
        for ax in ('x', 'y'):
            i = info[ax]
            if i['kind'] == 'pattern':
                C.log(f'    {ax}: pattern period {i["period"]:.1f}px strength {i["strength"]:.2f} n={i["n"]} '
                      f'crop {i["L"]}px seam {i["o"]}px {"edge-aligned" if i["peaked"] else "calm-aligned"}')
            else:
                C.log(f'    {ax}: blend crop {i["L"]}px overlap {i["o"]}px')
        final = downscale_tileable(block, size)
        sx, sy = info['seam']
        ext = 'jpg' if fmt in ('jpg', 'jpeg') else 'png'
        path = out_dir / f'{prefix}{name}.{ext}'
        C.ensure_dir(path.parent)
        if ext == 'jpg':
            Image.fromarray(final, 'RGB').save(path, quality=92, subsampling=0, optimize=True)
        else:
            Image.fromarray(final, 'RGB').save(path, optimize=True)
        prev = tiled_preview(final, C.PREVIEW_DIR / f'{prefix}{name}_tiled.png')
        flag = '' if max(sx, sy) < 1.6 else '   <-- check the seam'
        C.log(f'    wrote {C.rel(path)} {size}x{size}  seam score x={sx:.2f} y={sy:.2f}{flag}  preview {C.rel(prev)}')
        results.append(dict(name=name, path=str(path), preview=str(prev), seam=(sx, sy), mode=m))
        blocks.append((name, final))
    if blocks:
        pname = preview_name or (Path(str(sheet_path)).stem + '_terrains')
        sheet = make_contact_sheet([np.tile(b, (2, 2, 1)) for _, b in blocks], C.PREVIEW_DIR / f'{pname}.png',
                                   labels=[f'{prefix}{n} (2x2 tiled)' for n, _ in blocks], cell=size * 2,
                                   upscale=False, title=f'make_terrain: {Path(str(sheet_path)).name}')
        C.log(f'[make_terrain] overview {C.rel(sheet)}')
    return results


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('sheet')
    ap.add_argument('--names', required=True, help='comma list in reading order; "-" skips; "name=mode" per swatch')
    ap.add_argument('--grid', default='3x3', help='RxC (rows x cols), default 3x3; 1x1 for a single swatch')
    ap.add_argument('--size', type=int, default=192, choices=[96, 192, 288, 384])
    ap.add_argument('--mode', default='blend', help='blend | pattern:<n> | pattern:<nx>x<ny>')
    ap.add_argument('--overlap', type=float, default=0.22, help='blend overlap as a fraction of the block')
    ap.add_argument('--inset', type=float, default=0.035, help='crop this fraction inside every cell')
    ap.add_argument('--flatten', type=float, default=0.6, help='0..1 removal of large brightness blotches')
    ap.add_argument('--prefix', default='ter_')
    ap.add_argument('--out-dir', default='assets/img/terrain')
    ap.add_argument('--format', default='png', choices=['png', 'jpg'])
    ap.add_argument('--preview-name', default=None)
    args = ap.parse_args(argv)
    r, c = args.grid.lower().split('x')
    res = make_terrain_sheet(args.sheet, [n for n in args.names.split(',')], grid=(int(r), int(c)),
                             size=args.size, mode=args.mode, overlap=args.overlap, inset=args.inset,
                             flatten=args.flatten, prefix=args.prefix, out_dir=args.out_dir,
                             fmt=args.format, preview_name=args.preview_name)
    for x in res:
        print(C.rel(x['path']))
    return 0


if __name__ == '__main__':
    sys.exit(main())
