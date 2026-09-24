#!/usr/bin/env python3
"""Generic R x C sheet (expression sheets, icon sheets) or a single image -> individual square PNGs.

Each drawn item is found by connected components (fragments are merged into their cell; falls back to an
even grid split when the sheet is messy), cut out with alpha (transparent OR paper-white backgrounds),
defringed, then trimmed / scaled / placed into a --size square.

Presets (--kind)
  face   size 256, out-dir assets/img/faces, anchor bottom, one UNIFORM scale for the whole sheet and the
         HEADS of all expressions aligned to the first one (the face does not jump when the expression
         changes), stray doodles far from the bust are dropped (--main-only).
  icon   size 64, out-dir assets/img/icons, anchor center, every icon fitted on its own, margin 3.
  (none) size 256, centred, individual fit.

CLI
  python3 tools/art/slice_grid.py art_raw/faces/mira_sheet.png --rows 2 --cols 3 --kind face \
      --prefix face_mira_ --names neutral,happy,sad,angry,scared,cry
  python3 tools/art/slice_grid.py art_raw/icons/items_a.png --rows 4 --cols 4 --kind icon \
      --prefix icon_ --names potion,ether,key,_,map,...
  python3 tools/art/slice_grid.py art_raw/test_portrait.png --rows 1 --cols 1 --kind face \
      --prefix face_test_ --names neutral --zoom 1.6 --anchor top          (single image path)
  options
      --names a,b,c        reading order; "_" (or "-" / "skip") skips a cell
      --size 256           output square in real px (256 faces, 64 icons)
      --anchor bottom|center|top     where the item sits vertically
      --hcenter bbox|head  horizontal centring by bounding box or by the head (upper 45 %) centroid
      --uniform / --no-uniform       one common scale + head alignment for all cells
      --zoom 1.0           >1 enlarges (parts leaving the frame are cut; use with --anchor top for busts)
      --margin N           free px around the item (default: 6 faces, 3 icons)
      --main-only / --keep-all       drop / keep fragments far away from the main shape
      --keep-bg            do NOT cut out: keep the cell background and only round the corners softly
                           (transparent sheets are put on a paper colour first)
      --bg auto|alpha|white   --tol 26   --pockets N   --holes N   (paper backgrounds, see cutout.py)
      --out-dir DIR  --prefix P  --preview-name NAME

Import: from slice_grid import slice_grid
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C  # noqa: E402
from contact_sheet import make_contact_sheet  # noqa: E402

PRESETS = {
    'face': dict(size=256, out_dir='assets/img/faces', anchor='bottom', uniform=True, margin=6, main_only=True),
    'icon': dict(size=64, out_dir='assets/img/icons', anchor='center', uniform=False, margin=3, main_only=False),
    None: dict(size=256, out_dir='assets/img/ui', anchor='center', uniform=False, margin=4, main_only=False),
}


def _rounded_mask(size: int, radius: float, feather: float = 1.5) -> np.ndarray:
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32) + 0.5
    cx = np.clip(xx, radius, size - radius)
    cy = np.clip(yy, radius, size - radius)
    d = np.hypot(xx - cx, yy - cy)
    return np.clip((radius - d) / feather + 0.5, 0, 1)


def _keep_bg_cells(arr: np.ndarray, rows: int, cols: int, size: int) -> list[np.ndarray]:
    H, W = arr.shape[:2]
    if C.has_real_alpha(arr):
        arr = C.flatten(arr, C.PAPER)
    out = []
    for r in range(rows):
        for c in range(cols):
            x0, x1 = int(round(c * W / cols)), int(round((c + 1) * W / cols))
            y0, y1 = int(round(r * H / rows)), int(round((r + 1) * H / rows))
            side = int(min(x1 - x0, y1 - y0) * (0.96 if rows * cols > 1 else 1.0))
            cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
            cell = arr[cy - side // 2:cy - side // 2 + side, cx - side // 2:cx - side // 2 + side]
            img = np.zeros((size, size, 4), np.uint8)
            img[..., :3] = C.resize_rgb(cell, (size, size))
            img[..., 3] = np.rint(_rounded_mask(size, 0.11 * size) * 255).astype(np.uint8)
            out.append(img)
    return out


def slice_grid(sheet_path, rows: int, cols: int, names: list[str], kind: str | None = None,
               size: int | None = None, prefix: str = '', out_dir=None, anchor: str | None = None,
               hcenter: str | None = None, uniform: bool | None = None, zoom: float = 1.0,
               margin: int | None = None, main_only: bool | None = None, keep_bg: bool = False,
               cut: dict | None = None, preview_name: str | None = None) -> list[dict]:
    pre = PRESETS.get(kind, PRESETS[None])
    size = size or pre['size']
    out_dir = C.resolve(out_dir or pre['out_dir'])
    anchor = anchor or pre['anchor']
    uniform = pre['uniform'] if uniform is None else uniform
    margin = pre['margin'] if margin is None else margin
    main_only = pre['main_only'] if main_only is None else main_only
    if hcenter is None:
        hcenter = 'head' if (kind == 'face' and uniform and rows * cols > 1) else 'bbox'
    n_cells = rows * cols
    if len(names) > n_cells:
        raise ValueError(f'{len(names)} names for {n_cells} cells')
    names = list(names) + ['_'] * (n_cells - len(names))

    arr = C.load_rgba(sheet_path)
    C.log(f'[slice_grid] {C.rel(C.resolve(sheet_path))}  {arr.shape[1]}x{arr.shape[0]}  grid {rows}x{cols}  '
          f'alpha={"real" if C.has_real_alpha(arr) else "none (paper)"}  kind={kind}')
    results, written = [], []

    if keep_bg:
        for name, img in zip(names, _keep_bg_cells(arr, rows, cols, size)):
            if C.is_skip(name):
                continue
            path = C.save_png(img, out_dir / f'{prefix}{name}.png')
            written.append(path)
            results.append(dict(name=name, path=str(path)))
    else:
        clean = C.prepare_cutout(arr, **(cut or {}))
        mask = clean[..., 3] > 127
        labels, items = C.detect_items(mask, rows=rows, cols=cols)
        by_label = None
        figs = []
        for name, it in zip(names, items):
            if C.is_skip(name):
                continue
            if not it.labels:
                C.log(f'[slice_grid] WARNING: cell for "{name}" is empty')
                continue
            if main_only and len(it.labels) > 1:
                if by_label is None:
                    by_label = {c.label: c for c in C.label_components(mask)[1]}
                dist = max(4, int(round(0.025 * max(arr.shape[0] / rows, arr.shape[1] / cols))))
                dropped = C.prune_far_fragments(labels, by_label, it, dist)
                if dropped:
                    C.log(f'  {name}: dropped {dropped} stray fragment(s)')
            crop, _, _ = C.extract_item(clean, labels, it, pad=8)
            m = C.measure_figure(crop, head_frac=0.45)
            figs.append((name, crop, m))
        if not figs:
            raise RuntimeError('no items found')

        # ---- scale --------------------------------------------------------------------------------
        def fit_scale(m):
            avail_w = size - 2 * margin
            avail_h = size - (margin if anchor in ('bottom', 'top') else 2 * margin)
            if hcenter == 'head':
                half = max(m['head_cx'] - m['left'], m['right'] - m['head_cx'])
                sw = (avail_w / 2.0) / half
            else:
                sw = avail_w / float(m['w'])
            return min(sw, avail_h / float(m['h']))

        scales = [fit_scale(m) for _, _, m in figs]
        if uniform:
            scales = [min(scales)] * len(figs)
        scales = [s * zoom for s in scales]

        ref_head = None      # frame position of the first head (uniform face sheets)
        for (name, crop, m), s in zip(figs, scales):
            cx_src = m['head_cx'] if hcenter == 'head' else (m['left'] + m['right']) / 2.0
            src_x0 = cx_src - (size / 2.0) / s
            if anchor == 'bottom':
                src_y0 = m['bottom'] - size / s
            elif anchor == 'top':
                src_y0 = m['top'] - margin / s
            else:
                src_y0 = (m['top'] + m['bottom']) / 2.0 - (size / 2.0) / s
            if uniform and kind == 'face':
                head_y = (m['head_cy'] - src_y0) * s
                if ref_head is None:
                    ref_head = head_y
                else:
                    src_y0 += (head_y - ref_head) / s          # put this head where the first one is
                    gap = size - (m['bottom'] - src_y0) * s
                    if anchor == 'bottom' and gap > 1.5:
                        C.log(f'  {name}: bust ends {gap:.0f}px above the frame bottom after head alignment')
            img = C.render_to_frame(crop, size, size, s, src_x0, src_y0)
            path = C.save_png(img, out_dir / f'{prefix}{name}.png')
            written.append(path)
            bb = C.alpha_bbox(img[..., 3], 8)
            results.append(dict(name=name, path=str(path), scale=round(s, 4), bbox=bb))
            C.log(f'  {prefix}{name}.png  scale {s:.3f}  bbox {bb}')

    if written:
        pname = preview_name or (Path(str(sheet_path)).stem + '_grid')
        prev = make_contact_sheet(written, C.PREVIEW_DIR / f'{pname}.png', cell=max(128, min(256, size)),
                                  bg='split', title=f'slice_grid: {Path(str(sheet_path)).name}')
        C.log(f'[slice_grid] preview {C.rel(prev)}')
    return results


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('sheet')
    ap.add_argument('--rows', type=int, default=1)
    ap.add_argument('--cols', type=int, default=1)
    ap.add_argument('--names', required=True)
    ap.add_argument('--kind', choices=['face', 'icon'], default=None)
    ap.add_argument('--size', type=int, default=None)
    ap.add_argument('--prefix', default='')
    ap.add_argument('--out-dir', default=None)
    ap.add_argument('--anchor', choices=['bottom', 'center', 'top'], default=None)
    ap.add_argument('--hcenter', choices=['bbox', 'head'], default=None)
    ap.add_argument('--uniform', dest='uniform', action='store_true', default=None)
    ap.add_argument('--no-uniform', dest='uniform', action='store_false')
    ap.add_argument('--zoom', type=float, default=1.0)
    ap.add_argument('--margin', type=int, default=None)
    ap.add_argument('--main-only', dest='main_only', action='store_true', default=None)
    ap.add_argument('--keep-all', dest='main_only', action='store_false')
    ap.add_argument('--keep-bg', action='store_true')
    C.add_bg_args(ap)
    ap.add_argument('--preview-name', default=None)
    args = ap.parse_args(argv)
    res = slice_grid(args.sheet, args.rows, args.cols, [n.strip() for n in args.names.split(',')],
                     kind=args.kind, size=args.size, prefix=args.prefix, out_dir=args.out_dir,
                     anchor=args.anchor, hcenter=args.hcenter, uniform=args.uniform, zoom=args.zoom,
                     margin=args.margin, main_only=args.main_only, keep_bg=args.keep_bg, cut=C.bg_opts(args),
                     preview_name=args.preview_name)
    for r in res:
        print(C.rel(r['path']))
    return 0


if __name__ == '__main__':
    sys.exit(main())
