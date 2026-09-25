#!/bin/bash
# Retry failed image searches sequentially
cd /home/z/my-project/assets-search

z-ai image-search -q "stack of folded premium cotton bath towels beige cream neutral background" --count 12 --gl us --no-rank > products.json 2>&1
echo "products done"
z-ai image-search -q "white hand towels folded neatly bathroom counter" --count 5 --gl us --no-rank > hand.json 2>&1
echo "hand done"
z-ai image-search -q "soft baby hooded towel for kids" --count 5 --gl us --no-rank > kids.json 2>&1
echo "kids done"
z-ai image-search -q "spa towels rolled up candles plants zen" --count 6 --gl us --no-rank > spa.json 2>&1
echo "spa done"
