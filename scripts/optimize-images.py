#!/usr/bin/env python3
"""Optimize images: resize to max 1600px, strip metadata, quality 82."""
from PIL import Image
import os

SRC = "/home/z/my-project/public/images"
MAX_W = 1600

for f in sorted(os.listdir(SRC)):
    path = os.path.join(SRC, f)
    im = Image.open(path)
    im = im.convert("RGB")
    if im.width > MAX_W:
        h = int(im.height * MAX_W / im.width)
        im = im.resize((MAX_W, h), Image.LANCZOS)
    before = os.path.getsize(path)
    im.save(path, "JPEG", quality=82, optimize=True, progressive=True)
    after = os.path.getsize(path)
    print(f"{f}: {before//1024}KB -> {after//1024}KB  ({im.width}x{im.height})")
