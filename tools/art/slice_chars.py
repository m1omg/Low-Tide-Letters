#!/usr/bin/env python3
"""Walk sheet (4 rows x 3 cols) -> normalized character sheet assets/img/chars/char_<id>.png

Output layout (TECH_SPEC section 8): 3 cols x 4 rows, frame 128x176 real px, rows down/left/right/up,
cols stepA/stand/stepB, feet on a baseline 8 px above the frame bottom, body centred on the HEAD so the
sprite does not jitter. Sidecar char_<id>.json = {"frameW":128,"frameH":176}.

CLI
  python3 tools/art/slice_chars.py art_raw/chars/mira_walk.png --id mira
      [--height 150]                       standing front figure height in real px
      [--rows-order down,left,right,up]    what the sheet rows show, top to bottom (as generated)
      [--cols-order stepA,stand,stepB]     what the sheet columns show, left to right
      [--swap-lr]                          sheet has the left/right rows mixed up
      [--mirror left|right]                build the OTHER side row by mirroring this one
      [--per-row-height]                   normalise every row to the same standing height
      [--bob 2]                            step frames sit this many real px lower than the stand frame
      [--bg auto|alpha|white] [--tol 26] [--pockets N] [--holes N]   background handling (see README)
      [--out-dir assets/img/chars]

Previews: art_raw/_preview/char_<id>_sheet.png (guides + onion skins) and char_<id>_walk.gif.

Import: from slice_chars import slice_walk_sheet
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C  # noqa: E402

FRAME_W, FRAME_H = 128, 176
BASELINE = 8
DIRS = ['down', 'left', 'right', 'up']
COLS = ['stepA', 'stand', 'stepB']


class Figure:
    """One raw-scale figure with its measurements."""

    def __init__(self, crop: np.ndarray):
        self.crop = crop
        solid = crop[..., 3] > 127
        ys = np.flatnonzero(solid.any(1))
        xs = np.flatnonzero(solid.any(0))
        self.top, self.bottom = int(ys[0]), int(ys[-1]) + 1          # bottom exclusive
        self.left, self.right = int(xs[0]), int(xs[-1]) + 1
        self.h = self.bottom - self.top
        self.profile = solid.sum(1).astype(np.float32)               # opaque px per row
        head = solid[self.top:self.top + max(4, int(round(0.40 * self.h)))]
        cols = head.sum(0).astype(np.float64)
        self.head_cx = float((cols * np.arange(solid.shape[1])).sum() / max(cols.sum(), 1)) + 0.5
        self.head_top = self.top        # refined against the stand frame later

    def mirrored(self) -> 'Figure':
        return Figure(np.ascontiguousarray(self.crop[:, ::-1]))


def _match_head(step: Figure, stand: Figure, search: int = 14) -> int:
    """Vertical offset d (raw px) so that step.top + d lines up with stand.top, found by matching the
    row-width profiles of the upper half (robust against single hair wisps that move the bbox top)."""
    n = int(0.5 * min(step.h, stand.h))
    ref = stand.profile[stand.top:stand.top + n]
    best, best_d = None, 0
    for d in range(-search, search + 1):
        s0 = step.top + d
        if s0 < 0 or s0 + n > len(step.profile):
            continue
        err = float(np.abs(step.profile[s0:s0 + n] - ref).mean()) + 0.15 * abs(d)
        if best is None or err < best:
            best, best_d = err, d
    return best_d


def render_frame(fig: Figure, scale: float, head_top_y: float | None, baseline_y: float) -> np.ndarray:
    """Resample one figure straight into a 128x176 frame (single LANCZOS pass, sub-pixel placement).
    If head_top_y is None the feet are put on the baseline, otherwise fig.head_top is put at head_top_y."""
    inv = 1.0 / scale
    if head_top_y is None:
        src_y0 = fig.bottom - baseline_y * inv
    else:
        src_y0 = fig.head_top - head_top_y * inv
    src_x0 = fig.head_cx - (FRAME_W / 2.0) * inv
    return C.render_to_frame(fig.crop, FRAME_W, FRAME_H, scale, src_x0, src_y0)


def slice_walk_sheet(sheet_path, char_id: str, height: int = 150, rows_order=None, cols_order=None,
                     swap_lr: bool = False, mirror: str | None = None, per_row_height: bool = False,
                     bob: float = 2.0, cut: dict | None = None, out_dir='assets/img/chars',
                     preview_dir=None) -> dict:
    rows_order = list(rows_order or DIRS)
    cols_order = list(cols_order or COLS)
    if sorted(rows_order) != sorted(DIRS):
        raise ValueError('--rows-order must be a permutation of ' + ','.join(DIRS))
    if sorted(cols_order) != sorted(COLS):
        raise ValueError('--cols-order must be a permutation of ' + ','.join(COLS))
    if swap_lr:
        rows_order = [{'left': 'right', 'right': 'left'}.get(r, r) for r in rows_order]

    arr = C.load_rgba(sheet_path)
    C.log(f'[slice_chars] {C.rel(C.resolve(sheet_path))}  {arr.shape[1]}x{arr.shape[0]}  '
          f'alpha={"real" if C.has_real_alpha(arr) else "none (paper)"}')
    clean = C.prepare_cutout(arr, **(cut or {}))
    mask = clean[..., 3] > 127
    labels, items = C.detect_items(mask, rows=4, cols=3)
    if len(items) != 12 or any(not it.labels for it in items):
        raise RuntimeError('could not find 12 figures on the sheet')

    figs: dict[tuple[str, str], Figure] = {}
    for it in items:
        crop, _, _ = C.extract_item(clean, labels, it, pad=8)
        figs[(rows_order[it.row], cols_order[it.col])] = Figure(crop)

    if mirror in ('left', 'right'):
        other = 'right' if mirror == 'left' else 'left'
        # a mirrored walk also swaps which leg is in front, so stepA <-> stepB
        figs[(other, 'stepA')] = figs[(mirror, 'stepB')].mirrored()
        figs[(other, 'stand')] = figs[(mirror, 'stand')].mirrored()
        figs[(other, 'stepB')] = figs[(mirror, 'stepA')].mirrored()

    # ---- scale -------------------------------------------------------------------------------------
    ref = figs[('down', 'stand')]
    base_scale = height / float(ref.h)
    row_scale = {}
    for d in DIRS:
        row_scale[d] = (height / float(figs[(d, 'stand')].h)) if per_row_height else base_scale
    # make sure everything fits into the frame
    fit = 1.0
    for (d, c), f in figs.items():
        s = row_scale[d]
        half = max(f.head_cx - f.left, f.right - f.head_cx) * s
        fit = min(fit, (FRAME_W / 2.0 - 1.0) / half, (FRAME_H - BASELINE - 2.0) / (f.h * s))
    if fit < 1.0:
        C.log(f'[slice_chars] WARNING: figures do not fit the frame at height {height}; shrinking by {fit:.3f}')
        for d in row_scale:
            row_scale[d] *= fit

    # ---- render ------------------------------------------------------------------------------------
    baseline_y = FRAME_H - BASELINE
    sheet = np.zeros((FRAME_H * 4, FRAME_W * 3, 4), np.uint8)
    report = []
    for r, d in enumerate(DIRS):
        s = row_scale[d]
        stand = figs[(d, 'stand')]
        stand_top_y = baseline_y - stand.h * s
        for k, c in enumerate(COLS):
            f = figs[(d, c)]
            if c == 'stand':
                frame = render_frame(f, s, None, baseline_y)
                dev = 0.0
            else:
                dshift = _match_head(f, stand)
                f.head_top = f.top + dshift
                top_y = stand_top_y + bob
                # feet may leave the baseline only a little: [-2, +6] real px
                bottom_y = top_y + (f.bottom - f.head_top) * s
                dev = bottom_y - baseline_y
                if dev < -2:
                    top_y += (-2 - dev)
                elif dev > 6:
                    top_y -= (dev - 6)
                dev = top_y + (f.bottom - f.head_top) * s - baseline_y
                frame = render_frame(f, s, top_y, baseline_y)
            sheet[r * FRAME_H:(r + 1) * FRAME_H, k * FRAME_W:(k + 1) * FRAME_W] = frame
            bb = C.alpha_bbox(frame[..., 3], 8)
            clipped = bb is not None and (bb[0] == 0 or bb[2] == FRAME_W or bb[1] == 0 or bb[3] == FRAME_H)
            if clipped:
                C.log(f'[slice_chars] WARNING: frame {d}/{c} touches the frame border (possible clipping)')
            report.append(dict(dir=d, col=c, raw_h=f.h, scale=round(s, 4), feet_dev=round(float(dev), 2),
                               bbox=bb, clipped=bool(clipped)))

    out_dir = C.resolve(out_dir)
    out_png = C.save_png(sheet, out_dir / f'char_{char_id}.png')
    C.write_json({'frameW': FRAME_W, 'frameH': FRAME_H}, out_dir / f'char_{char_id}.json')
    prev = C.ensure_dir(C.resolve(preview_dir) if preview_dir else C.PREVIEW_DIR)
    p1 = _preview_sheet(sheet, prev / f'char_{char_id}_sheet.png', char_id)
    p2 = _preview_gif(sheet, prev / f'char_{char_id}_walk.gif')
    C.log(f'[slice_chars] wrote {C.rel(out_png)} (+json), previews {C.rel(p1)}, {C.rel(p2)}')
    return dict(path=str(out_png), scale=base_scale, frames=report, previews=[str(p1), str(p2)])


# ---- previews --------------------------------------------------------------------------------------

def _preview_sheet(sheet: np.ndarray, path: Path, char_id: str) -> Path:
    """Frames at 2x on a checkerboard with centre / baseline guides, plus an onion-skin column per
    direction (all three frames averaged: a sharp head = no jitter)."""
    z = 2
    cols = 4
    W, H = FRAME_W * cols * z, FRAME_H * 4 * z
    bgc = C.checkerboard(W, H, 16)
    big = np.zeros((FRAME_H * 4, FRAME_W * cols, 4), np.float32)
    big[:, :FRAME_W * 3] = sheet
    for r in range(4):
        fr = [sheet[r * FRAME_H:(r + 1) * FRAME_H, k * FRAME_W:(k + 1) * FRAME_W].astype(np.float32) for k in range(3)]
        a = [f[..., 3:4] / 255.0 for f in fr]
        asum = a[0] + a[1] + a[2]
        rgb = (fr[0][..., :3] * a[0] + fr[1][..., :3] * a[1] + fr[2][..., :3] * a[2]) / np.maximum(asum, 1e-3)
        onion = np.concatenate([rgb, asum / 3.0 * 255.0], -1)
        big[r * FRAME_H:(r + 1) * FRAME_H, FRAME_W * 3:] = onion
    big8 = np.clip(np.rint(big), 0, 255).astype(np.uint8)
    up = np.asarray(Image.fromarray(big8).resize((W, H), Image.BICUBIC))
    C.composite_over(bgc, up)
    im = Image.fromarray(bgc)
    d = ImageDraw.Draw(im)
    font = C.get_font(16)
    for r in range(4):
        y = ((r + 1) * FRAME_H - BASELINE) * z
        d.line([(0, y), (W, y)], fill=(255, 60, 60), width=1)
        d.line([(0, r * FRAME_H * z), (W, r * FRAME_H * z)], fill=(40, 40, 40), width=1)
        d.text((4, r * FRAME_H * z + 2), DIRS[r], fill=(20, 20, 20), font=font)
    for k in range(cols):
        x = (k * FRAME_W + FRAME_W // 2) * z
        d.line([(x, 0), (x, H)], fill=(60, 120, 255), width=1)
        d.line([(k * FRAME_W * z, 0), (k * FRAME_W * z, H)], fill=(40, 40, 40), width=1)
        d.text((k * FRAME_W * z + 60, 2), (COLS + ['onion'])[k], fill=(20, 20, 20), font=font)
    im.save(path, optimize=True)
    return path


def _preview_gif(sheet: np.ndarray, path: Path) -> Path:
    """All four directions side by side, walking (stepA, stand, stepB, stand) at about 7 fps, 2x."""
    z = 2
    seq = [0, 1, 2, 1]
    frames = []
    for k in seq:
        bgc = np.empty((FRAME_H, FRAME_W * 4, 3), np.uint8)
        bgc[:] = (150, 190, 120)
        bgc[FRAME_H - BASELINE:] = (130, 170, 105)
        for r in range(4):
            fr = sheet[r * FRAME_H:(r + 1) * FRAME_H, k * FRAME_W:(k + 1) * FRAME_W]
            C.composite_over(bgc, fr, r * FRAME_W, 0)
        im = Image.fromarray(bgc).resize((FRAME_W * 4 * z, FRAME_H * z), Image.BICUBIC)
        frames.append(im.convert('P', palette=Image.ADAPTIVE, colors=255))
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=140, loop=0, disposal=1)
    return path


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('sheet', help='raw walk sheet PNG (relative to project root or absolute)')
    ap.add_argument('--id', required=True, help='character id -> char_<id>.png')
    ap.add_argument('--height', type=int, default=150)
    ap.add_argument('--rows-order', default=','.join(DIRS))
    ap.add_argument('--cols-order', default=','.join(COLS))
    ap.add_argument('--swap-lr', action='store_true')
    ap.add_argument('--mirror', choices=['left', 'right'], default=None)
    ap.add_argument('--per-row-height', action='store_true')
    ap.add_argument('--bob', type=float, default=2.0)
    C.add_bg_args(ap)
    ap.add_argument('--out-dir', default='assets/img/chars')
    ap.add_argument('--preview-dir', default=None)
    args = ap.parse_args(argv)
    res = slice_walk_sheet(args.sheet, args.id, height=args.height,
                           rows_order=[s.strip() for s in args.rows_order.split(',')],
                           cols_order=[s.strip() for s in args.cols_order.split(',')],
                           swap_lr=args.swap_lr, mirror=args.mirror, per_row_height=args.per_row_height,
                           bob=args.bob, cut=C.bg_opts(args), out_dir=args.out_dir, preview_dir=args.preview_dir)
    for f in res['frames']:
        C.log(f"  {f['dir']:>5}/{f['col']:<5} raw_h={f['raw_h']} scale={f['scale']} feet_dev={f['feet_dev']:+.1f} bbox={f['bbox']}")
    print(C.rel(res['path']))
    return 0


if __name__ == '__main__':
    sys.exit(main())
