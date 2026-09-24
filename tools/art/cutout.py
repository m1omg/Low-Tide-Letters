#!/usr/bin/env python3
"""Single illustration (battle enemy) -> defringed, trimmed alpha PNG assets/img/enemies/en_<id>.png

Works for raw generations with REAL alpha (defringe: alpha levels + colour bleed, see common.py) and for
flat white / paper backgrounds (flood fill from the image borders with tolerance + soft un-mixed edge, so
enclosed whites such as eyes and teeth survive). Longest side <= 640 real px (never upscaled).
A sidecar en_<id>.json {"mapScale": s} is written: multiply the LOGICAL size by s to get the roaming map
sprite (about 56 logical px high, at most 80 wide) as described in TECH_SPEC 4.2.

CLI
  python3 tools/art/cutout.py art_raw/enemies/moth.png --id moth
      [--max-side 640] [--bg auto|alpha|white] [--tol 26]   tolerance of the paper flood fill (0-255)
      [--main-only]         drop everything that is not attached / close to the biggest shape
      [--near 2.5]          "close" for --main-only, in percent of the longest image side
      [--min-area 40]       specks smaller than this many raw px are always removed
      [--pockets N]         paper only: also clear enclosed paper pockets behind lines thinner than N raw px
      [--holes N]           paper only: clear EVERY enclosed paper region >= N raw px (never with white eyes)
      [--prefix en_] [--out-dir assets/img/enemies] [--no-sidecar]

Import: from cutout import cutout_image, clean_single
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C  # noqa: E402
from contact_sheet import make_contact_sheet  # noqa: E402


def clean_single(arr: np.ndarray, cut: dict | None = None, main_only: bool = False,
                 near_pct: float = 2.5, min_area: int = 40) -> np.ndarray:
    """Raw-scale clean-up of ONE subject: background removal / defringe, speck removal and (optionally)
    removal of stray doodles far away from the main shape. Returns trimmed straight RGBA (raw scale)."""
    clean = C.prepare_cutout(arr, **(cut or {}))
    mask = clean[..., 3] > 127
    labels, comps = C.label_components(mask)
    if not comps:
        raise RuntimeError('nothing left after background removal')
    by_label = {c.label: c for c in comps}
    keep = [c for c in comps if c.area >= min_area]
    item = C.Item()
    for c in sorted(keep, key=lambda c: -c.area):
        item.add(c)
    removed = 0
    if main_only:
        dist = max(4, int(round(near_pct / 100.0 * max(arr.shape[:2]))))
        removed = C.prune_far_fragments(labels, by_label, item, dist)
    C.log(f'  components: {len(comps)} total, {len(item.labels)} kept'
          + (f', {removed} far fragment(s) dropped' if removed else ''))
    crop, _, _ = C.extract_item(clean, labels, item, pad=8)
    # extract_item keeps soft rims only around own components; unlabeled haze elsewhere is dropped
    return C.trim(crop, 0, thr=16)


def cutout_image(src, out_id: str, max_side: int = 640, cut: dict | None = None,
                 main_only: bool = False, near_pct: float = 2.5, min_area: int = 40, prefix: str = 'en_',
                 out_dir='assets/img/enemies', sidecar: bool = True) -> dict:
    arr = C.load_rgba(src)
    C.log(f'[cutout] {C.rel(C.resolve(src))}  {arr.shape[1]}x{arr.shape[0]}  '
          f'alpha={"real" if C.has_real_alpha(arr) else "none (paper)"}')
    raw = clean_single(arr, cut=cut, main_only=main_only, near_pct=near_pct, min_area=min_area)
    h, w = raw.shape[:2]
    s = min(1.0, max_side / float(max(w, h)))
    p = 8
    padded = C.pad_canvas(raw, p, p, p, p)
    if s < 1.0:
        size = (max(1, int(round(padded.shape[1] * s))), max(1, int(round(padded.shape[0] * s))))
        res = C.resize_rgba(padded, size)
    else:
        res = padded
    res = C.trim(res, 0, thr=10)
    # the trim threshold can leave the longest side one px above the limit
    if max(res.shape[:2]) > max_side:
        k = max_side / float(max(res.shape[:2]))
        res = C.resize_rgba(res, (max(1, int(res.shape[1] * k)), max(1, int(res.shape[0] * k))))
    out_dir = C.resolve(out_dir)
    path = C.save_png(res, out_dir / f'{prefix}{out_id}.png')
    H, W = res.shape[:2]
    info = dict(path=str(path), w=W, h=H)
    if sidecar:
        map_scale = round(min(1.0, 112.0 / H, 160.0 / W), 4)      # 56 logical px high, <= 80 logical wide
        C.write_json({'mapScale': map_scale}, out_dir / f'{prefix}{out_id}.json')
        info['mapScale'] = map_scale
    prev = make_contact_sheet([path], C.PREVIEW_DIR / f'{prefix}{out_id}_cutout.png', cell=512, bg='split',
                              upscale=False, title=f'cutout: {Path(str(src)).name}')
    info['preview'] = str(prev)
    C.log(f'[cutout] wrote {C.rel(path)} {W}x{H}, preview {C.rel(prev)}')
    return info


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('src')
    ap.add_argument('--id', required=True)
    ap.add_argument('--max-side', type=int, default=640)
    C.add_bg_args(ap)
    ap.add_argument('--main-only', action='store_true')
    ap.add_argument('--near', type=float, default=2.5)
    ap.add_argument('--min-area', type=int, default=40)
    ap.add_argument('--prefix', default='en_')
    ap.add_argument('--out-dir', default='assets/img/enemies')
    ap.add_argument('--no-sidecar', action='store_true')
    args = ap.parse_args(argv)
    info = cutout_image(args.src, args.id, max_side=args.max_side, cut=C.bg_opts(args),
                        main_only=args.main_only, near_pct=args.near, min_area=args.min_area,
                        prefix=args.prefix, out_dir=args.out_dir, sidecar=not args.no_sidecar)
    print(C.rel(info['path']))
    return 0


if __name__ == '__main__':
    sys.exit(main())
