#!/usr/bin/env python3
"""Build the five named-Unsent tint variants en_kept_* from their base enemies (DESIGN_BIBLE 6.11).

A variant is a duotone of the base: luminance is mapped onto a dark->light ramp of the named hue,
then 18% of the original colour is mixed back so the drawing still reads as the same creature.
Alpha and the sidecar mapScale are copied from the base.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'assets/img/enemies'

# id -> (base id, dark end, light end)
VARIANTS = {
    'kept_shrug':       ('sorry_crab',  (0x32, 0x41, 0x4c), (0xd2, 0xdc, 0xe2)),  # grey-blue
    'kept_never_mind':  ('reply_all',   (0x46, 0x33, 0x1e), (0xe8, 0xd8, 0xb4)),  # sepia
    'kept_later':       ('listworm',    (0x3c, 0x2c, 0x52), (0xdc, 0xd0, 0xea)),  # violet
    'kept_ask_her':     ('echo',        (0x5c, 0x2a, 0x33), (0xf2, 0xd4, 0xd8)),  # rose
    'kept_dot_dot_dot': ('pearl_drip',  (0x22, 0x22, 0x24), (0xd8, 0xd8, 0xda)),  # charcoal
}
KEEP = 0.18


def main():
    done, missing = [], []
    for vid, (base, dark, light) in VARIANTS.items():
        src = SRC / ('en_%s.png' % base)
        if not src.exists():
            missing.append('%s (base en_%s missing)' % (vid, base))
            continue
        im = Image.open(src).convert('RGBA')
        a = np.asarray(im).astype(np.float32)
        rgb, alpha = a[..., :3], a[..., 3:]
        lum = (0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]) / 255.0
        lum = np.clip((lum - 0.06) / 0.90, 0, 1)[..., None]
        ramp = np.array(dark, np.float32) + lum * (np.array(light, np.float32) - np.array(dark, np.float32))
        out = np.concatenate([np.clip(ramp * (1 - KEEP) + rgb * KEEP, 0, 255), alpha], axis=-1)
        dst = SRC / ('en_%s.png' % vid)
        Image.fromarray(out.astype(np.uint8), 'RGBA').save(dst)
        side = SRC / ('en_%s.json' % base)
        if side.exists():
            (SRC / ('en_%s.json' % vid)).write_text(side.read_text())
        done.append(str(dst.relative_to(ROOT)))
    print('\n'.join(done))
    if missing:
        print('MISSING: ' + '; '.join(missing), file=sys.stderr)


main()
