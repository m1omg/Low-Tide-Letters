#!/usr/bin/env python3
"""Prop sheet -> individual map objects assets/img/objects/obj_<name>.png

The props are found by connected components (small detached fragments are merged into the nearest big
component), sorted into reading order by row clustering, defringed at raw scale, scaled so that the final
image width = tiles x 96 real px (height capped at 4.5 tiles) and trimmed with a 2 px transparent margin.

CLI
  python3 tools/art/cut_objects.py art_raw/props/park_a.png \
      --spec "tree_round:2,pine:2,bush_pink:1.5,signpost:1,-,bench:2"
      [--spec-file spec.txt]      one "name:tiles" per line instead of --spec ('#' comments allowed)
      [--grid 3x3]                props sit on an even grid; use it when a prop consists of several big
                                  detached parts or when detection reports a wrong count
      [--prefix obj_] [--out-dir assets/img/objects] [--max-height-tiles 4.5] [--margin 2]
      [--bg auto|alpha|white] [--tol 26] [--holes N]   paper sheets: --holes 150 also clears enclosed paper
                                  regions (gaps under a table, between fence bars)
      [--preview-name <name>]
  A name of "_" (or "-" / "skip") skips that prop. Names are given in reading order (left to right, top
  to bottom). (A spec that STARTS with "-" must be written as --spec=-,a:1 because of argparse.)

Import: from cut_objects import cut_objects
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C  # noqa: E402
from contact_sheet import make_contact_sheet  # noqa: E402


def parse_spec(text: str) -> list[tuple[str, float]]:
    out = []
    for part in text.replace('\n', ',').split(','):
        part = part.split('#')[0].strip()
        if not part:
            continue
        if C.is_skip(part):
            out.append(('-', 1.0))
            continue
        if ':' in part:
            name, tiles = part.rsplit(':', 1)
            out.append((name.strip(), float(tiles)))
        else:
            out.append((part, 1.0))
    return out


def scale_object(crop: np.ndarray, tiles: float, max_h_tiles: float = 4.5, margin: int = 2) -> np.ndarray:
    """Scale a raw-scale RGBA crop so that the final image (incl. margin) is tiles*96 px wide."""
    crop = C.trim(crop, 0, thr=24)
    h, w = crop.shape[:2]
    target_w = max(8, int(round(tiles * C.TILE_REAL)) - 2 * margin)
    s = target_w / float(w)
    max_h = int(round(max_h_tiles * C.TILE_REAL)) - 2 * margin
    if h * s > max_h:
        s = max_h / float(h)
    nw, nh = max(1, int(round(w * s))), max(1, int(round(h * s)))
    # pad before resampling so the LANCZOS kernel sees transparent surroundings
    p = 8
    padded = C.pad_canvas(crop, p, p, p, p)
    pw, ph = int(round((w + 2 * p) * s)), int(round((h + 2 * p) * s))
    res = C.resize_rgba(padded, (pw, ph))
    res = C.trim(res, 0, thr=10)
    # exact requested width: centre the trimmed result on a canvas of nw + 2*margin
    # (the soft edge can make the trimmed width differ from nw by a pixel or two)
    th, tw = res.shape[:2]
    out = np.zeros((th + 2 * margin, nw + 2 * margin, 4), np.uint8)
    C.paste(out, res, (nw + 2 * margin - tw) // 2, margin)
    return out


def cut_objects(sheet_path, spec: list[tuple[str, float]], grid: tuple[int, int] | None = None,
                prefix: str = 'obj_', out_dir='assets/img/objects', max_h_tiles: float = 4.5,
                margin: int = 2, cut: dict | None = None, preview_name: str | None = None) -> list[dict]:
    arr = C.load_rgba(sheet_path)
    C.log(f'[cut_objects] {C.rel(C.resolve(sheet_path))}  {arr.shape[1]}x{arr.shape[0]}  '
          f'alpha={"real" if C.has_real_alpha(arr) else "none (paper)"}')
    clean = C.prepare_cutout(arr, **(cut or {}))
    mask = clean[..., 3] > 127
    if grid:
        labels, items = C.detect_items(mask, rows=grid[0], cols=grid[1], force_grid=False)
    else:
        labels, items = C.detect_items(mask, count=len(spec))
    if len(items) != len(spec):
        raise RuntimeError(f'spec lists {len(spec)} props but {len(items)} were found on the sheet '
                           f'(use --grid RxC or fix the spec)')
    out_dir = C.resolve(out_dir)
    results, written = [], []
    for (name, tiles), it in zip(spec, items):
        if name == '-':
            continue
        if not it.labels:
            C.log(f'[cut_objects] WARNING: nothing found for "{name}"')
            continue
        crop, _, _ = C.extract_item(clean, labels, it, pad=8)
        img = scale_object(crop, tiles, max_h_tiles, margin)
        path = C.save_png(img, out_dir / f'{prefix}{name}.png')
        written.append(path)
        results.append(dict(name=name, path=str(path), w=img.shape[1], h=img.shape[0], tiles=tiles,
                            parts=len(it.labels), row=it.row, col=it.col))
        C.log(f'  {prefix}{name}.png  {img.shape[1]}x{img.shape[0]}  ({tiles} tiles, {len(it.labels)} part(s), '
              f'sheet r{it.row} c{it.col})')
    if written:
        pname = preview_name or (Path(str(sheet_path)).stem + '_objects')
        prev = make_contact_sheet(written, C.PREVIEW_DIR / f'{pname}.png', cell=288, bg='split',
                                  title=f'cut_objects: {Path(str(sheet_path)).name}')
        C.log(f'[cut_objects] preview {C.rel(prev)}')
    return results


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('sheet')
    ap.add_argument('--spec', default=None, help='"name:tiles,name:tiles,..." in reading order')
    ap.add_argument('--spec-file', default=None)
    ap.add_argument('--grid', default=None, help='RxC, e.g. 3x3 (rows x cols)')
    ap.add_argument('--prefix', default='obj_')
    ap.add_argument('--out-dir', default='assets/img/objects')
    ap.add_argument('--max-height-tiles', type=float, default=4.5)
    ap.add_argument('--margin', type=int, default=2)
    C.add_bg_args(ap)
    ap.add_argument('--preview-name', default=None)
    args = ap.parse_args(argv)
    if args.spec_file:
        spec = parse_spec(C.resolve(args.spec_file).read_text(encoding='utf-8'))
    elif args.spec:
        spec = parse_spec(args.spec)
    else:
        ap.error('give --spec or --spec-file')
    grid = None
    if args.grid:
        r, c = args.grid.lower().split('x')
        grid = (int(r), int(c))
    res = cut_objects(args.sheet, spec, grid=grid, prefix=args.prefix, out_dir=args.out_dir,
                      max_h_tiles=args.max_height_tiles, margin=args.margin, cut=C.bg_opts(args),
                      preview_name=args.preview_name)
    for r in res:
        print(C.rel(r['path']))
    return 0


if __name__ == '__main__':
    sys.exit(main())
