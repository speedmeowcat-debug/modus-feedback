#!/usr/bin/env python3
"""Contact sheet of frames with frame-number labels.

    python3 tools/contact_sheet.py <frames_dir> <out.png> [--frames 0,60,75 | --every 15]
                                   [--cols 4] [--width 480] [--timeline timeline.json]
With --timeline, frames that carry a sound cue are outlined in red and tagged with the cue kind.
"""
import argparse
import json
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("frames_dir", type=Path)
    ap.add_argument("out", type=Path)
    ap.add_argument("--frames", help="comma list of frame numbers")
    ap.add_argument("--every", type=int)
    ap.add_argument("--cols", type=int, default=4)
    ap.add_argument("--width", type=int, default=480, help="thumbnail width in px")
    ap.add_argument("--timeline", type=Path)
    a = ap.parse_args()

    avail = {int(re.search(r"f_(\d+)\.png", p.name).group(1)): p for p in a.frames_dir.glob("f_*.png")}
    if a.frames:
        want = [int(x) for x in a.frames.split(",")]
    else:
        every = a.every or 1
        want = [f for f in sorted(avail) if f % every == 0]
    want = [f for f in want if f in avail]
    cues: dict[int, list[str]] = {}
    if a.timeline:
        for c in json.loads(a.timeline.read_text())["cues"]:
            cues.setdefault(c["frame"], []).append(c["kind"])

    first = Image.open(avail[want[0]])
    tw = a.width
    th = round(first.height * tw / first.width)
    cols = min(a.cols, len(want))
    rows = (len(want) + cols - 1) // cols
    pad, lab = 8, 22
    sheet = Image.new("RGB", (cols * (tw + pad) + pad, rows * (th + lab + pad) + pad), (24, 24, 28))
    d = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 14)
    except OSError:
        font = ImageFont.load_default()
    for i, f in enumerate(want):
        im = Image.open(avail[f]).convert("RGB").resize((tw, th), Image.LANCZOS)
        x = pad + (i % cols) * (tw + pad)
        y = pad + (i // cols) * (th + lab + pad)
        sheet.paste(im, (x, y + lab))
        tag = f"f{f}"
        if f in cues:
            tag += "  ♪ " + "+".join(cues[f])
            d.rectangle([x - 2, y + lab - 2, x + tw + 1, y + lab + th + 1], outline=(255, 59, 107), width=3)
        d.text((x, y + 3), tag, fill=(235, 235, 240), font=font)
    a.out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(a.out)
    print(f"{len(want)} frames -> {a.out}  ({sheet.width}x{sheet.height})")


if __name__ == "__main__":
    main()
