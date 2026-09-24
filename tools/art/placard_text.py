#!/usr/bin/env python3
"""Letter the striking gull's placard: the image model is asked for no writing, so SQUAWK (bible 5.3) is
written on obj_gull_picket.png here, in the game's title font, after cut_objects.py has made the prop.

    python3 tools/art/placard_text.py            -> assets/img/objects/obj_gull_picket.png (in place)
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'assets/img/objects/obj_gull_picket.png'
FONT = ROOT / 'assets/fonts/GochiHand-Regular.ttf'
PREVIEW = ROOT / 'art_raw/_preview/obj_gull_picket_text.png'
TEXT = 'SQUAWK'


def main():
    im = Image.open(SRC).convert('RGBA')
    if im.size != (192, 361):
        print('placard_text: unexpected size %s, the placard box below assumes the cut from lull_c' % (im.size,), file=sys.stderr)
    # the placard board in the cut prop, and its slight lean to the right
    box = (66, 6, 160, 90)
    lean = -4
    w, h = box[2] - box[0], box[3] - box[1]
    layer = Image.new('RGBA', (w * 2, h * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    font = ImageFont.truetype(str(FONT), 30)
    tw = d.textlength(TEXT, font=font)
    x = (layer.width - tw) / 2
    y = layer.height / 2 - 20
    # thick felt-pen letters: a slightly transparent ink drawn twice with a 1 px offset
    for dx, dy in ((0, 0), (1, 0)):
        d.text((x + dx, y + dy), TEXT, font=font, fill=(58, 52, 60, 225))
    layer = layer.rotate(lean, resample=Image.BICUBIC, expand=False)
    im.alpha_composite(layer, (box[0] - w // 2, box[1] - h // 2))
    im.save(SRC)
    PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    im.crop((40, 0, 192, 120)).resize((304, 240), Image.LANCZOS).save(PREVIEW)
    print(SRC.relative_to(ROOT))


if __name__ == '__main__':
    main()
