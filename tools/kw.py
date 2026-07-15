#!/usr/bin/env python3
"""
kw.py — keyword volume lookups via DataForSEO, so guide pages (and any SEO
bet) get built on real search demand instead of instinct. Pay-as-you-go:
search_volume ≈ $0.05 per call (up to 1000 keywords in ONE call — batch!),
keyword_ideas ≈ $0.01 + $0.0001/row. Check balance anytime with --balance.

    python tools/kw.py discord emoji size                 # volume for one phrase
    python tools/kw.py --file kws.txt                     # volumes for a list (one per line)
    python tools/kw.py --ideas "twitch emote size"        # related keywords + volumes (top 50)
    python tools/kw.py --ideas "emoji size" --limit 100
    python tools/kw.py --balance                          # account balance only

Volumes are Google Ads data, worldwide + English by default (our audience is
global/US-heavy); pass --loc 2840 for US-only (DataForSEO location codes).
Credentials in tools/dataforseo.local.json (gitignored).
"""
import argparse
import base64
import json
import os
import sys
import urllib.request

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # noqa: BLE001
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
CFG = os.path.join(HERE, "dataforseo.local.json")
API = "https://api.dataforseo.com/v3"


def auth_header():
    with open(CFG, encoding="utf-8") as f:
        cfg = json.load(f)
    if "PASTE" in cfg.get("password", "PASTE"):
        sys.exit("tools/dataforseo.local.json still has placeholder credentials")
    pair = f"{cfg['login']}:{cfg['password']}"
    return "Basic " + base64.b64encode(pair.encode()).decode()


def call(path, payload=None):
    req = urllib.request.Request(
        f"{API}{path}",
        data=json.dumps(payload).encode() if payload is not None else None,
        headers={"Authorization": auth_header(), "Content-Type": "application/json"},
        method="POST" if payload is not None else "GET",
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        data = json.loads(r.read())
    task = data["tasks"][0]
    if task["status_code"] != 20000:
        sys.exit(f"API error {task['status_code']}: {task['status_message']}")
    return task["result"]


def fmt_vol(v):
    return f"{v:,}" if isinstance(v, int) else "—"


def print_rows(rows):
    # rows: list of (keyword, volume, cpc, competition)
    rows = sorted(rows, key=lambda r: (r[1] or 0), reverse=True)
    w = max([len(r[0]) for r in rows] + [20])
    print(f"{'keyword'.ljust(w)}  {'vol/mo':>9}  {'cpc':>6}  competition")
    print("-" * (w + 34))
    for kw, vol, cpc, comp in rows:
        cpc_s = f"${cpc:.2f}" if cpc else "—"
        print(f"{kw.ljust(w)}  {fmt_vol(vol):>9}  {cpc_s:>6}  {comp or '—'}")


def search_volume(keywords, loc):
    payload = [{"keywords": keywords, "language_code": "en"}]
    if loc:
        payload[0]["location_code"] = loc
    result = call("/keywords_data/google_ads/search_volume/live", payload)
    rows = [
        (r["keyword"], r.get("search_volume"), r.get("cpc"), r.get("competition"))
        for r in (result or [])
    ]
    print_rows(rows)


def ideas(seed, loc, limit):
    payload = [{
        "keywords": [seed], "language_code": "en", "limit": limit,
        "order_by": ["keyword_info.search_volume,desc"],
    }]
    if loc:
        payload[0]["location_code"] = loc
    result = call("/dataforseo_labs/google/keyword_ideas/live", payload)
    items = (result or [{}])[0].get("items") or []
    rows = []
    for it in items:
        info = it.get("keyword_info") or {}
        rows.append((it["keyword"], info.get("search_volume"),
                     info.get("cpc"), info.get("competition_level")))
    print_rows(rows)


def balance():
    result = call("/appendix/user_data")
    money = (result or [{}])[0].get("money") or {}
    print(f"balance: ${money.get('balance', '?')}")


def main():
    ap = argparse.ArgumentParser(description="DataForSEO keyword volumes")
    ap.add_argument("keywords", nargs="*", help="a single keyword phrase")
    ap.add_argument("--file", help="file with one keyword per line")
    ap.add_argument("--ideas", metavar="SEED", help="related-keyword ideas for a seed phrase")
    ap.add_argument("--limit", type=int, default=50, help="max ideas rows (default 50)")
    ap.add_argument("--loc", type=int, default=None,
                    help="DataForSEO location code (e.g. 2840 = US); default worldwide")
    ap.add_argument("--balance", action="store_true", help="show account balance and exit")
    args = ap.parse_args()

    if args.balance:
        balance()
    elif args.ideas:
        ideas(args.ideas, args.loc, args.limit)
    elif args.file:
        with open(args.file, encoding="utf-8-sig") as f:  # -sig: PS 5.1 writes BOMs
            kws = [ln.strip() for ln in f if ln.strip()]
        search_volume(kws[:1000], args.loc)
    elif args.keywords:
        search_volume([" ".join(args.keywords)], args.loc)
    else:
        ap.print_help()


if __name__ == "__main__":
    main()
