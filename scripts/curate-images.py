#!/usr/bin/env python3
"""Curate downloaded images: delete watermarked/branded, rename keepers to semantic names."""
import os, shutil

SRC = "/home/z/my-project/public/images"

# semantic name -> source file
KEEP = {
    # hero & lifestyle
    "hero-main.jpg": "hero-01.png",          # minimal spa bathroom w/ tub
    "lifestyle-warm.jpg": "hero-02.png",     # warm beige bathroom
    "lifestyle-wood.jpg": "hero-08.png",     # wood bathroom w/ brown towel
    "lifestyle-shelf.jpg": "hero-06.jpg",    # folded towels on shelf
    "lifestyle-green.jpg": "hero-04.jpg",    # green tile vanity
    "lifestyle-boho.jpg": "hero-03.jpg",     # warm boho bathroom
    "lifestyle-marble.jpg": "hero-05.jpg",   # marble bathroom
    "lifestyle-beach.jpg": "pool-03.jpg",    # towels on beach
    "lifestyle-spa.jpg": "spa-05.png",       # rolled towel with plants
    "lifestyle-candle.jpg": "spa-04.jpg",    # warm bath w/ candles
    # category cards
    "cat-bath.jpg": "product-09.jpg",        # white towels on wooden stool
    "cat-hand.jpg": "hand-01.jpg",           # white hand towels on tub
    "cat-pool.jpg": "pool-05.jpg",           # white stack
    "cat-robe.jpg": "robe-04.webp",          # gray robe hanging
    "cat-kids.jpg": "kids-04.jpg",           # hooded kids towel
    "cat-sets.jpg": "product-03.jpg",        # full beige towel set
    "cat-gift.jpg": "product-12.jpg",        # warm stack on green cabinet
    # product shots
    "p-cream.jpg": "product-02.jpg",         # cream folded towel
    "p-taupe.jpg": "product-06.jpg",         # taupe folded towel
    "p-beige.jpg": "product-07.jpg",         # beige square folded
    "p-mint.jpg": "product-08.jpg",          # mint set
    "p-stripe.jpg": "product-10.jpg",        # striped hanging towels
    "p-warm-stack.jpg": "product-11.png",    # taupe stack w/ tub
    "p-lake.jpg": "product-01.jpg",          # stack by the lake
    "p-hook.jpg": "robe-03.jpg",             # beige towel on hook
    "p-robe-model.jpg": "robe-02.jpg",       # waffle robe on model
    "p-rolled.jpg": "hand-02.jpg",           # rolled towels
    "p-vanity.jpg": "hand-03.jpg",           # marble vanity w/ towel
}

REJECT = ["hero-07.jpg","product-04.png","product-05.jpg","pool-01.jpg","pool-02.png",
          "pool-04.jpg","robe-01.jpg","kids-01.jpg","kids-02.jpg","kids-03.jpg","kids-05.jpg",
          "gift-01.jpg","gift-03.jpg","gift-04.jpg","gift-05.jpg","spa-01.jpg","spa-02.jpg",
          "spa-03.jpg","spa-06.jpg","hand-04.png","hand-05.jpg","product-12.jpg"]

# copy keepers
for new, old in KEEP.items():
    src = os.path.join(SRC, old)
    dst = os.path.join(SRC, new)
    if os.path.exists(src):
        shutil.copy2(src, dst)

# delete everything except keepers
for f in os.listdir(SRC):
    if f not in KEEP:
        os.remove(os.path.join(SRC, f))

print("Final images:")
for f in sorted(os.listdir(SRC)):
    size = os.path.getsize(os.path.join(SRC, f))
    print(f"  {f}  {size//1024}KB")
