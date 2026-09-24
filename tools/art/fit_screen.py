#!/usr/bin/env python3
"""Any image -> full-screen 1536x1152 JPG (quality 88, cover crop) for battlebacks/ or cg/.

CLI
  python3 tools/art/fit_screen.py art_raw/bb/forest.png --kind bb --id forest
        -> assets/img/battlebacks/bb_forest.jpg
  python3 tools/art/fit_screen.py art_raw/cg/title.png --kind cg --id title --focus 0.5,0.35
        -> assets/img/cg/cg_title.jpg
      [--focus x,y]        point (0-1, 0-1) of the source that should stay in view when cropping (default 0.5,0.5)
      [--size 1536x1152] [--quality 88] [--matte "#f6f1e4"]   colour behind transparent sources
      [--out path.jpg]     explicit output path instead of --kind/--id

Import: from fit_screen import fit_screen
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C  # noqa: E402

KINDS = {'bb': ('assets/img/battlebacks', 'bb_'), 'cg': ('assets/img/cg', 'cg_')}


def cover_box(sw: int, sh: int, tw: int, th: int, focus=(0.5, 0.5)) -> tuple[float, float, float, float]:
    """Source box (x0, y0, x1, y1) with the target aspect ratio that covers as much as possible and keeps
    the focus point as central as the borders allow."""
    target = tw / float(th)
    if sw / float(sh) > target:        # source too wide -> crop left/right
        ch, cw = float(sh), sh * target
    else:                              # source too tall -> crop top/bottom
        cw, ch = float(sw), sw / target
    fx, fy = focus
    x0 = min(max(fx * sw - cw / 2.0, 0.0), sw - cw)
    y0 = min(max(fy * sh - ch / 2.0, 0.0), sh - ch)
    return x0, y0, x0 + cw, y0 + ch


def fit_screen(src, out_path, size=(1536, 1152), focus=(0.5, 0.5), quality: int = 88,
               matte=C.PAPER) -> Path:
    arr = C.load_rgba(src)
    if (arr[..., 3] < 255).any():
        arr = C.flatten(arr, matte)
    im = Image.fromarray(arr[..., :3], 'RGB')
    box = cover_box(im.width, im.height, size[0], size[1], focus)
    res = im.resize(size, Image.LANCZOS, box=box)
    out_path = C.resolve(out_path)
    C.ensure_dir(out_path.parent)
    res.save(out_path, 'JPEG', quality=quality, optimize=True, progressive=True, subsampling=1)
    # preview: the source with the crop rectangle + the result
    from PIL import ImageDraw
    pw = 640
    k = pw / im.width
    small = im.resize((pw, max(1, int(im.height * k))), Image.BILINEAR)
    d = ImageDraw.Draw(small)
    d.rectangle([box[0] * k, box[1] * k, box[2] * k - 1, box[3] * k - 1], outline=(255, 60, 60), width=3)
    outp = res.resize((pw, int(pw * size[1] / size[0])), Image.BILINEAR)
    sheet = Image.new('RGB', (pw * 2 + 30, max(small.height, outp.height) + 20), (58, 58, 58))
    sheet.paste(small, (10, 10))
    sheet.paste(outp, (pw + 20, 10))
    prev = C.ensure_dir(C.PREVIEW_DIR) / f'{out_path.stem}_fit.jpg'
    sheet.save(prev, quality=85)
    C.log(f'[fit_screen] {C.rel(C.resolve(src))} {im.width}x{im.height} -> {C.rel(out_path)} '
          f'{size[0]}x{size[1]} (crop box {tuple(round(v) for v in box)}), preview {C.rel(prev)}')
    return out_path


def _parse_color(text: str):
    t = text.strip().lstrip('#')
    if len(t) == 6:
        return tuple(int(t[i:i + 2], 16) for i in (0, 2, 4))
    parts = [int(v) for v in text.split(',')]
    if len(parts) != 3:
        raise ValueError('colour must be #rrggbb or r,g,b')
    return tuple(parts)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('src')
    ap.add_argument('--kind', choices=sorted(KINDS), default=None)
    ap.add_argument('--id', default=None)
    ap.add_argument('--out', default=None)
    ap.add_argument('--focus', default='0.5,0.5')
    ap.add_argument('--size', default='1536x1152')
    ap.add_argument('--quality', type=int, default=88)
    ap.add_argument('--matte', default=None)
    args = ap.parse_args(argv)
    if args.out:
        out = args.out
    elif args.kind and args.id:
        folder, prefix = KINDS[args.kind]
        out = f'{folder}/{prefix}{args.id}.jpg'
    else:
        ap.error('give --kind and --id, or --out')
    fx, fy = (float(v) for v in args.focus.split(','))
    matte = _parse_color(args.matte) if args.matte else C.PAPER
    p = fit_screen(args.src, out, size=C.parse_size(args.size), focus=(fx, fy), quality=args.quality, matte=matte)
    print(C.rel(p))
    return 0


if __name__ == '__main__':
    sys.exit(main())
