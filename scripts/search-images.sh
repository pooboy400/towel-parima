#!/bin/bash
# Parallel image search for towel store assets
cd /home/z/my-project/assets-search

z-ai image-search -q "minimal warm bathroom interior with beige cotton towels hanging, natural light, spa aesthetic" --count 8 --gl us --no-rank > hero.json 2>/dev/null &
P1=$!

z-ai image-search -q "stack of folded premium cotton bath towels in beige and cream colors on neutral background" --count 12 --gl us --no-rank > products.json 2>/dev/null &
P2=$!

z-ai image-search -q "white hand towels folded neatly on bathroom counter" --count 5 --gl us --no-rank > hand.json 2>/dev/null &
P3=$!

z-ai image-search -q "white pool towels stacked by swimming pool" --count 5 --gl us --no-rank > pool.json 2>/dev/null &
P4=$!

wait $P1 $P2 $P3 $P4
echo "BATCH1 DONE"

z-ai image-search -q "white waffle bathrobe hanging on wooden hook in bright bathroom" --count 5 --gl us --no-rank > robe.json 2>/dev/null &
P5=$!

z-ai image-search -q "soft baby hooded towel for kids folded" --count 5 --gl us --no-rank > kids.json 2>/dev/null &
P6=$!

z-ai image-search -q "towel gift set in elegant packaging box with ribbon" --count 5 --gl us --no-rank > gift.json 2>/dev/null &
P7=$!

z-ai image-search -q "spa towels rolled up with candles plants and stones zen" --count 6 --gl us --no-rank > spa.json 2>/dev/null &
P8=$!

wait $P5 $P6 $P7 $P8
echo "BATCH2 DONE"
ls -la /home/z/my-project/assets-search/
