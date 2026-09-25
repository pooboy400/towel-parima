#!/usr/bin/env python3
"""Parse image-search JSON results, download images to public/images with descriptive names."""
import json, os, re, subprocess, sys

ASSETS = "/home/z/my-project/assets-search"
OUT = "/home/z/my-project/public/images"
os.makedirs(OUT, exist_ok=True)

# Mapping: file -> prefix for names
FILES = {
    "hero.json": "hero",
    "products.json": "product",
    "hand.json": "hand",
    "pool.json": "pool",
    "robe.json": "robe",
    "kids.json": "kids",
    "gift.json": "gift",
    "spa.json": "spa",
}

def parse_json_from_text(text):
    """Find the outermost JSON object in text."""
    m = re.search(r'\{.*\}', text, re.DOTALL)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        return None

manifest = {}
for fname, prefix in FILES.items():
    path = os.path.join(ASSETS, fname)
    if not os.path.exists(path):
        continue
    text = open(path, encoding="utf-8").read()
    data = parse_json_from_text(text)
    if not data or not data.get("success"):
        print(f"WARN: {fname} no valid JSON or success=false")
        continue
    results = data.get("results", [])
    manifest[prefix] = []
    for i, r in enumerate(results, 1):
        url = r.get("original_url")
        if not url:
            continue
        ext = ".jpg"
        if ".png" in url: ext = ".png"
        elif ".webp" in url: ext = ".webp"
        name = f"{prefix}-{i:02d}{ext}"
        dest = os.path.join(OUT, name)
        # skip if already downloaded
        if not os.path.exists(dest):
            rc = subprocess.run(["curl", "-sL", "--max-time", "60", "-o", dest, url]).returncode
            if rc != 0 and os.path.exists(dest):
                os.remove(dest)
                continue
        if os.path.exists(dest) and os.path.getsize(dest) > 5000:
            manifest[prefix].append({"name": name, "url": url, "source": r.get("source", ""), "size": os.path.getsize(dest)})
            print(f"OK {name} <- {url}")
        else:
            print(f"FAIL {name} <- {url}")

json.dump(manifest, open(os.path.join(ASSETS, "manifest.json"), "w"), indent=2, ensure_ascii=False)
print("\n=== MANIFEST ===")
for k, v in manifest.items():
    print(f"{k}: {len(v)} images")
