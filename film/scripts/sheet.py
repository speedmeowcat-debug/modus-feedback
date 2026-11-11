"""Сетка проверочных кадров: python scripts/sheet.py out/stills out/sheet.png [колонки]"""
import sys, glob, os
from PIL import Image, ImageDraw
src, dst = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 2
files = sorted(glob.glob(os.path.join(src, "f*.png")))
ims = [Image.open(f).convert("RGB") for f in files]
w, h = ims[0].size
sheet = Image.new("RGB", (cols * w + (cols + 1) * 8, ((len(ims) + cols - 1) // cols) * (h + 8) + 8), (90, 90, 90))
d = ImageDraw.Draw(sheet)
for i, (f, im) in enumerate(zip(files, ims)):
    x, y = 8 + (i % cols) * (w + 8), 8 + (i // cols) * (h + 8)
    sheet.paste(im, (x, y))
    d.rectangle([x, y, x + 70, y + 22], fill=(255, 0, 90))
    d.text((x + 6, y + 5), os.path.basename(f)[1:5], fill=(255, 255, 255))
sheet.save(dst)
print(dst, sheet.size)
