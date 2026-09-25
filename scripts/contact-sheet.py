#!/usr/bin/env python3
"""Build contact sheets of remaining images with filename labels for quick curation."""
from PIL import Image, ImageDraw, ImageFont
import os, glob

SRC = "/home/z/my-project/public/images"
OUT = "/home/z/my-project/assets-search"
groups = {
    "sheet-rest": ["hand-02.jpg","hand-03.jpg","hand-04.png","hand-05.jpg",
                   "pool-02.png","pool-03.jpg","pool-04.jpg","pool-05.jpg",
                   "robe-02.jpg","robe-03.jpg","robe-04.webp","robe-05.jpg"],
    "sheet-kids-gift": ["kids-02.jpg","kids-03.jpg","kids-04.jpg","kids-05.jpg",
                        "gift-01.jpg","gift-02.jpg","gift-03.jpg","gift-04.jpg","gift-05.jpg"],
    "sheet-spa": ["spa-02.jpg","spa-03.jpg","spa-04.jpg","spa-05.png","spa-06.jpg","product-11.png"],
}

THUMB = 320
COLS = 4
font = None
try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 20)
except Exception:
    font = ImageFont.load_default()

for sheet_name, files in groups.items():
    rows = (len(files) + COLS - 1) // COLS
    sheet = Image.new("RGB", (COLS*THUMB, rows*(THUMB+34)), "white")
    draw = ImageDraw.Draw(sheet)
    for i, f in enumerate(files):
        path = os.path.join(SRC, f)
        if not os.path.exists(path):
            continue
        try:
            im = Image.open(path).convert("RGB")
        except Exception:
            continue
        im.thumbnail((THUMB, THUMB))
        x = (i % COLS) * THUMB
        y = (i // COLS) * (THUMB+34)
        # center thumb in cell
        ox = x + (THUMB - im.width)//2
        oy = y + (THUMB - im.height)//2
        sheet.paste(im, (ox, oy))
        draw.text((x+8, y+THUMB+6), f, fill="black", font=font)
    sheet.save(os.path.join(OUT, f"{sheet_name}.jpg"), quality=82)
    print("saved", sheet_name, sheet.size)
