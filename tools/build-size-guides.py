#!/usr/bin/env python3
"""
build-size-guides.py — bake REAL Printful size charts into the shop.

Fetches the public catalog size tables (no auth) for every garment we sell and
writes src/data/size-guides.json, which src/lib/shop.js renders on the PDPs.
Re-run when a NEW garment product is added to the shop (and add its catalog id
to GARMENTS below — find it by matching the product description against
GET https://api.printful.com/products).

    python tools/build-size-guides.py
"""
import json, os, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "src", "data", "size-guides.json")

# Shopify product (matched by title substring in shop.js) -> Printful catalog id
GARMENTS = {
    "438": "Unisex Classic Tee | Gildan 5000",          # classic tee
    "146": "Unisex Heavy Blend Hoodie | Gildan 18500",  # hoodie
    "200": "All-Over Print Crop Top",                   # crop top
    "108": "Men's Fitted T-Shirt | Next Level 3600",    # short sleeve t-shirt
    "71":  "Unisex Staple T-Shirt | Bella+Canvas 3001", # CUSTOM banana tee
}


def fetch(pid):
    # Printful 403s the default Python user agent — send a real-ish one
    req = urllib.request.Request(
        f"https://api.printful.com/products/{pid}/sizes",
        headers={"User-Agent": "Mozilla/5.0 (trymstene.com size-guide sync)"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)["result"]


def cell(v):
    """One measurement value -> display string (inches)."""
    if v.get("value") is not None:
        return str(v["value"])
    return f"{v.get('min_value')}–{v.get('max_value')}"


def main():
    out = {}
    for pid, name in GARMENTS.items():
        r = fetch(pid)
        # product_measure = flat garment measurements (the useful chart);
        # fall back to measure_yourself for fitted/AOP items that lack it —
        # or whose columns are just diagram letters (A/B) with no diagram
        tables = {t["type"]: t for t in r.get("size_tables") or []}
        t = tables.get("product_measure") or tables.get("measure_yourself")
        if t and all(len(m["type_label"]) <= 2 for m in t["measurements"]):
            t = tables.get("measure_yourself") or t
        if not t:
            print(f"  !! {pid} {name}: no size table, skipped"); continue
        cols, rows = [], {}
        for m in t["measurements"]:
            cols.append(m["type_label"])
            for v in m["values"]:
                rows.setdefault(v["size"], []).append(cell(v))
        out[pid] = {
            "product": name,
            "unit": t.get("unit", "inches"),
            "kind": t["type"],
            "note": ("Flat garment measurements" if t["type"] == "product_measure"
                     else "Body measurements — measure yourself") + " (from the Printful catalog).",
            "cols": cols,
            "rows": rows,
        }
        print(f"  ok {pid} {name}: {len(rows)} sizes x {len(cols)} measurements ({t['type']})")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
    print(f"wrote {os.path.relpath(OUT, os.path.join(HERE, '..'))}")


if __name__ == "__main__":
    main()
