#!/usr/bin/env python3
"""Build obj_stairs_wood.png, the house staircase prop, from the floorboard terrain tile.

No generated image exists for an indoor staircase, so this draws one out of the art we have: each tread
is a strip of ter_floorboards turned so the boards run along the step, risers are the same wood in
shadow, and a soft pencil outline plus a handrail keep it in the hand-drawn register. Two tiles wide
(192 real px), about two tiles tall; anchored like every other 2-wide prop (ox 24, anchor bottom centre).

    python3 tools/art/make_stairs.py            -> assets/img/objects/obj_stairs_wood.png
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'assets/img/terrain/ter_floorboards.png'
OUT = ROOT / 'assets/img/objects/obj_stairs_wood.png'
PREVIEW = ROOT / 'art_raw/_preview/obj_stairs_wood.png'

W, H = 192, 200          # 2 tiles wide, a little over 2 tiles tall
STEPS = 6
TREAD = 14               # visible depth of a tread (px)
RISER = 17               # height of a riser (px)
INK = (74, 46, 28)       # pencil brown used by the generated props' outlines


def jitter_line(draw, p0, p1, colour, width, amp=1.2, seed=0):
    """A slightly wobbly line: the generated art has no ruler-straight edges."""
    rnd = np.random.RandomState(seed)
    n = max(3, int(np.hypot(p1[0] - p0[0], p1[1] - p0[1]) / 9))
    xs = np.linspace(p0[0], p1[0], n) + rnd.uniform(-amp, amp, n)
    ys = np.linspace(p0[1], p1[1], n) + rnd.uniform(-amp, amp, n)
    xs[0], ys[0], xs[-1], ys[-1] = p0[0], p0[1], p1[0], p1[1]
    draw.line(list(zip(xs, ys)), fill=colour, width=width, joint='curve')


def wood(strip_w, strip_h, shade, seed):
    """A strip of floorboards, boards running horizontally, multiplied by `shade`."""
    tile = Image.open(SRC).convert('RGB').rotate(90, expand=True)
    rnd = np.random.RandomState(seed)
    x0 = rnd.randint(0, tile.width - strip_w) if tile.width > strip_w else 0
    y0 = rnd.randint(0, tile.height - strip_h) if tile.height > strip_h else 0
    crop = tile.crop((x0, y0, x0 + strip_w, y0 + strip_h))
    a = np.asarray(crop).astype(np.float32) * shade
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def main():
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Floor shadow under the bottom step, so the flight sits on the boards instead of floating.
    shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).ellipse((6, H - 26, W - 6, H - 2), fill=(40, 24, 12, 90))
    shadow = shadow.filter(ImageFilter.GaussianBlur(6))
    img.alpha_composite(shadow)

    # Steps from the bottom up. Each step is a little narrower and inset, which reads as the flight
    # climbing away from the viewer against the back wall.
    base_y = H - 8
    left, right = 14, W - 22
    outline = []
    for i in range(STEPS):
        inset = i * 4
        x0, x1 = left + inset, right - inset
        riser_top = base_y - i * (RISER + TREAD) - RISER
        tread_top = riser_top - TREAD
        riser = wood(x1 - x0, RISER, 0.62, seed=i * 2)
        img.paste(riser, (x0, riser_top))
        tread = wood(x1 - x0, TREAD, 1.06 - i * 0.02, seed=i * 2 + 1)
        img.paste(tread, (x0, tread_top))
        # nosing highlight and the shadow the tread throws on the riser below
        draw.line((x0, tread_top + TREAD - 1, x1, tread_top + TREAD - 1), fill=(120, 80, 48, 140), width=2)
        draw.line((x0, tread_top, x1, tread_top), fill=(246, 226, 190, 120), width=1)
        outline.append((x0, x1, tread_top, riser_top + RISER))

    # Pencil outline: the two sides as one wobbly stepped stroke each, then every tread edge.
    for side in (0, 1):
        pts = []
        for i, (x0, x1, top, bottom) in enumerate(outline):
            x = x0 if side == 0 else x1
            pts.append((x, bottom))
            pts.append((x, top))
        for k in range(len(pts) - 1):
            jitter_line(draw, pts[k], pts[k + 1], INK + (200,), 3, seed=100 + side * 50 + k)
        # the stepped silhouette joins the next narrower step
    for i, (x0, x1, top, bottom) in enumerate(outline):
        jitter_line(draw, (x0, top), (x1, top), INK + (170,), 2, seed=200 + i)
        jitter_line(draw, (x0, bottom), (x1, bottom), INK + (110,), 2, seed=230 + i)
    top_x0, top_x1, top_y, _ = outline[-1]
    jitter_line(draw, (top_x0, top_y), (top_x1, top_y), INK + (220,), 3, seed=300)

    # Handrail on the right: a newel post at the foot, a thinner post at the top, a rail between.
    rail = (96, 62, 36, 255)
    foot = (right + 4, base_y - 6)
    head = (right - (STEPS - 1) * 4 + 4, outline[-1][2] - 4)
    jitter_line(draw, foot, (foot[0], foot[1] - 58), rail, 6, amp=0.6, seed=400)
    jitter_line(draw, head, (head[0], head[1] - 44), rail, 4, amp=0.6, seed=401)
    jitter_line(draw, (foot[0], foot[1] - 56), (head[0], head[1] - 42), rail, 5, amp=0.8, seed=402)
    draw.ellipse((foot[0] - 6, foot[1] - 66, foot[0] + 6, foot[1] - 54), fill=(118, 78, 46, 255), outline=INK + (200,))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT)
    PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    board = Image.new('RGBA', (W * 2, H * 2), (0, 0, 0, 0))
    bg = Image.open(SRC).convert('RGBA').resize((W * 2, H * 2))
    board.alpha_composite(bg)
    board.alpha_composite(img.resize((W * 2, H * 2), Image.LANCZOS))
    board.save(PREVIEW)
    print(OUT.relative_to(ROOT))
    print('preview:', PREVIEW.relative_to(ROOT), file=sys.stderr)


if __name__ == '__main__':
    main()
