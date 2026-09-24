#!/usr/bin/env python3
"""ui/logo.png (a wide emblem on transparent) -> assets/img/ui/ui_logo.png, trimmed to its drawing and
480 px wide, keeping the aspect (slice_grid would square it). The title screen draws it under the lettering.

    python3 tools/art/trim_logo.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'art_raw/ui/logo.png'
OUT = ROOT / 'assets/img/ui/ui_logo.png'
WIDTH = 480


def main():
    arr = common.load_rgba(SRC)
    arr = common.defringe_alpha(arr)
    arr = common.trim(arr, margin=12)
    h, w = arr.shape[:2]
    out = common.resize_rgba(arr, (WIDTH, round(h * WIDTH / w)))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    common.save_png(out, OUT)
    print(OUT.relative_to(ROOT))


if __name__ == '__main__':
    main()
