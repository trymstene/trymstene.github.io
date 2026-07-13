#!/usr/bin/env python3
"""
build-tee-mockups.py — fetch EXTRA mockup styles (different models, flat lays)
for the custom tee via Printful's Mockup Generator API.

The free catalog image (public/assets/tee/tee-<color>.jpg) is one male model.
Printful's generator offers many styles per product; this script generates
"blank" mockups (a 1×1 transparent design) per colour for the styles you pick,
downloads them into public/assets/tee/, and the PDP composites the visitor's
design onto them client-side (same trick as the current model photo).

Needs the Printful API token (same one the fulfilment worker uses) in
tools/printful.local.json (gitignored):   { "token": "..." }

  python tools/build-tee-mockups.py --list            # see available styles
  python tools/build-tee-mockups.py --styles 9001,9002  # generate + download

After downloading, tune each style's chest quad in makeTeePhotoMockup
(src/lib/sticker-core.js) — quads differ per shoot.
"""
import argparse, json, os, sys, time, urllib.request

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
HERE = os.path.dirname(os.path.abspath(__file__))
CFG = os.path.join(HERE, "printful.local.json")
OUT = os.path.join(HERE, "..", "public", "assets", "tee")

PRODUCT = 71  # Bella+Canvas 3001
# one variant per colour (S size) — enough to get each colour's mockup
COLOR_VARIANTS = {"white": 4011, "red": 4141, "royal": 4171,
                  "kelly": 4086, "turquoise": 4176, "berry": 4041}
# a truly blank design: 1×1 transparent PNG hosted on the site
BLANK = "https://trymstene.com/assets/tee/blank.png"


def token():
    if not os.path.exists(CFG):
        sys.exit(f"Missing {CFG} — create it with: {{\"token\": \"<printful api token>\"}}")
    return json.load(open(CFG))["token"]


def api(path, body=None):
    req = urllib.request.Request(
        f"https://api.printful.com{path}",
        data=json.dumps(body).encode() if body else None,
        headers={"Authorization": f"Bearer {token()}",
                 "Content-Type": "application/json",
                 "User-Agent": "trymstene.com tee mockups"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)["result"]


def list_styles():
    pf = api(f"/mockup-generator/printfiles/{PRODUCT}")
    print("option_groups:", pf.get("option_groups"))
    print("options:", pf.get("options"))
    tpl = api(f"/mockup-generator/templates/{PRODUCT}")
    seen = {}
    for t in tpl.get("templates", []):
        key = (t.get("mockup_style_id"), t.get("placement"))
        if key not in seen and t.get("placement") == "front":
            seen[key] = t
    print(f"\nfront templates ({len(seen)}):")
    for (sid, _), t in sorted(seen.items(), key=lambda x: x[0][0] or 0):
        print(f"  style {sid}: orientation={t.get('orientation')} "
              f"image={str(t.get('background_url'))[:80]}")


def generate(style_ids):
    os.makedirs(OUT, exist_ok=True)
    for color, vid in COLOR_VARIANTS.items():
        task = api(f"/mockup-generator/create-task/{PRODUCT}", {
            "variant_ids": [vid], "format": "jpg",
            "files": [{"placement": "front", "image_url": BLANK,
                       "position": {"area_width": 1800, "area_height": 2400,
                                    "width": 10, "height": 10, "top": 0, "left": 0}}],
            "mockup_style_ids": style_ids,
        })
        key = task["task_key"]
        for _ in range(40):
            time.sleep(3)
            res = api(f"/mockup-generator/task?task_key={key}")
            if res["status"] == "completed":
                break
            if res["status"] == "failed":
                print(f"{color}: FAILED — {res.get('error')}"); res = None; break
        if not res:
            continue
        for m in res.get("mockups", []):
            sid = m.get("style_id") or "default"
            dest = os.path.join(OUT, f"tee-s{sid}-{color}.jpg")
            urllib.request.urlretrieve(m["mockup_url"], dest)
            print(f"{color}: style {sid} -> {os.path.basename(dest)}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--styles", help="comma-separated mockup style ids")
    a = ap.parse_args()
    if a.list:
        list_styles()
    elif a.styles:
        generate([int(s) for s in a.styles.split(",")])
    else:
        print(__doc__)
