#!/usr/bin/env python3
"""Build a labelled contact sheet PNG on a checkerboard (alpha problems become visible).

CLI
  python3 tools/art/contact_sheet.py "assets/img/objects/obj_*.png" assets/img/enemies/en_moth.png \
      --out art_raw/_preview/objects.png [--cell 256] [--cols 5] [--bg checker|dark|light|split] [--no-upscale]

Import
  from contact_sheet import make_contact_sheet
  make_contact_sheet(paths_or_arrays, out_path, labels=None, cell=256, cols=None, bg='checker')
"""
from __future__ import annotations

import argparse
import glob
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C  # noqa: E402

BGS = {
    'checker': ((200, 200, 205), (150, 150, 160)),
    'dark': ((44, 40, 58), (30, 27, 41)),
    'light': ((250, 248, 240), (232, 229, 220)),
}


def _bg(w, h, kind):
    if kind == 'split':      # left half dark, right half light: shows light halos AND dark fringes
        out = C.checkerboard(w, h, 16, *BGS['dark'])
        out[:, w // 2:] = C.checkerboard(w - w // 2, h, 16, *BGS['light'])
        return out
    c0, c1 = BGS.get(kind, BGS['checker'])
    return C.checkerboard(w, h, 16, c0, c1)


def make_contact_sheet(images, out_path, labels=None, cell: int = 256, cols: int | None = None,
                       bg: str = 'checker', upscale: bool = True, title: str | None = None) -> Path:
    """images: list of file paths or RGBA/RGB numpy arrays. Returns the written path."""
    arrs, names = [], []
    for i, it in enumerate(images):
        if isinstance(it, (str, Path)):
            p = C.resolve(it)
            arrs.append(C.load_rgba(p))
            names.append(p.stem)
        else:
            a = np.asarray(it)
            if a.ndim == 2:
                a = np.stack([a, a, a, np.full_like(a, 255)], -1)
            if a.shape[2] == 3:
                a = np.concatenate([a, np.full(a.shape[:2] + (1,), 255, np.uint8)], -1)
            arrs.append(a.astype(np.uint8))
            names.append(f'#{i}')
    if labels:
        names = [labels[i] if i < len(labels) and labels[i] is not None else names[i] for i in range(len(names))]
    n = len(arrs)
    if n == 0:
        raise ValueError('contact sheet: no images')
    if cols is None:
        cols = min(n, max(1, int(math.ceil(math.sqrt(n * 1.4)))))
    rows = int(math.ceil(n / cols))
    label_h = 22
    pad = 8
    head = 30 if title else 0
    W = cols * (cell + pad) + pad
    H = head + rows * (cell + label_h + pad) + pad
    sheet = np.full((H, W, 3), 58, np.uint8)
    font = C.get_font(15)
    texts = []
    for i, a in enumerate(arrs):
        r, c = divmod(i, cols)
        x = pad + c * (cell + pad)
        y = head + pad + r * (cell + label_h + pad)
        sheet[y:y + cell, x:x + cell] = _bg(cell, cell, bg)
        h, w = a.shape[:2]
        s = min(cell / w, cell / h)
        if not upscale:
            s = min(s, 1.0)
        elif s > 1:
            s = min(s, 4.0)
        nw, nh = max(1, int(round(w * s))), max(1, int(round(h * s)))
        if (nw, nh) != (w, h):
            a = C.resize_rgba(a, (nw, nh), resample=Image.LANCZOS if s < 1 else Image.BICUBIC)
        C.composite_over(sheet, a, x + (cell - nw) // 2, y + (cell - nh) // 2)
        texts.append((x + 2, y + cell + 1, f'{names[i]}  {w}x{h}'))
    im = Image.fromarray(sheet)
    d = ImageDraw.Draw(im)
    if title:
        d.text((pad, 4), title, fill=(255, 240, 200), font=C.get_font(20))
    for x, y, t in texts:
        d.text((x, y), t, fill=(235, 235, 235), font=font)
    out_path = C.resolve(out_path)
    C.ensure_dir(out_path.parent)
    im.save(out_path, optimize=True)
    return out_path


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('inputs', nargs='+', help='image files or glob patterns (relative to project root)')
    ap.add_argument('--out', required=True, help='output PNG (e.g. art_raw/_preview/foo.png)')
    ap.add_argument('--cell', type=int, default=256)
    ap.add_argument('--cols', type=int, default=None)
    ap.add_argument('--bg', default='checker', choices=['checker', 'dark', 'light', 'split'])
    ap.add_argument('--no-upscale', action='store_true', help='never enlarge small images')
    ap.add_argument('--title', default=None)
    args = ap.parse_args(argv)
    paths = []
    for pat in args.inputs:
        p = C.resolve(pat)
        hits = sorted(glob.glob(str(p)))
        if not hits and p.exists():
            hits = [str(p)]
        if not hits:
            C.log(f'[contact_sheet] WARNING: nothing matches {pat}')
        paths.extend(hits)
    if not paths:
        C.log('[contact_sheet] no input images')
        return 1
    out = make_contact_sheet(paths, args.out, cell=args.cell, cols=args.cols, bg=args.bg,
                             upscale=not args.no_upscale, title=args.title)
    print(C.rel(out))
    return 0


if __name__ == '__main__':
    sys.exit(main())
