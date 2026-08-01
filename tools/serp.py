#!/usr/bin/env python3
"""
serp.py — who actually ranks, via DataForSEO. The companion to kw.py.

⚠️ WHY THIS EXISTS: DataForSEO's "competition" field in kw.py is ADVERTISER
bidding, not organic difficulty. A keyword can read LOW there and still have a
first page wall-to-wall with Adobe and Canva. Volume tells you if a query is
worth wanting; this tells you if it is winnable.

    python tools/serp.py "pixel art maker"
    python tools/serp.py "pixel art maker" --depth 20
    python tools/serp.py --file queries.txt        # one per line, compact rows

Costs ~$0.002 per query (live/advanced). Credentials shared with kw.py in
tools/dataforseo.local.json (gitignored).
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
    pair = f"{cfg['login']}:{cfg['password']}"
    return "Basic " + base64.b64encode(pair.encode()).decode()


def call(path, payload):
    req = urllib.request.Request(
        API + path,
        data=json.dumps(payload).encode(),
        headers={"Authorization": auth_header(), "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=180) as r:
        body = json.load(r)
    if body.get("status_code") != 20000:
        sys.exit(f"API error {body.get('status_code')}: {body.get('status_message')}")
    task = (body.get("tasks") or [{}])[0]
    if task.get("status_code") != 20000:
        sys.exit(f"task error {task.get('status_code')}: {task.get('status_message')}")
    return (task.get("result") or [{}])[0]


def fetch(keyword, loc, depth):
    return call("/serp/google/organic/live/advanced", [{
        "keyword": keyword, "language_code": "en", "location_code": loc,
        "device": "desktop", "depth": depth,
    }])


def show(res, keyword, depth):
    items = res.get("items") or []
    # ⚠️ SERP FEATURES MATTER AS MUCH AS THE RANKINGS. An AI overview or a video
    # carousel above the fold can eat the clicks a #3 would otherwise get, so a
    # winnable-looking SERP can still be a bad bet. Count them out loud.
    feats = {}
    for it in items:
        t = it.get("type")
        if t != "organic":
            feats[t] = feats.get(t, 0) + 1
    print(f"\n=== {keyword}  ({res.get('se_results_count', '?')} results) ===")
    if feats:
        print("  serp features: " + " · ".join(f"{k}×{v}" for k, v in sorted(feats.items())))
    print("  %-4s %-30s %s" % ("#", "domain", "title"))
    n = 0
    for it in items:
        if it.get("type") != "organic":
            continue
        n += 1
        if n > depth:
            break
        print("  %-4s %-30s %s" % (
            it.get("rank_group"), (it.get("domain") or "")[:30], (it.get("title") or "")[:70]))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("query", nargs="*", help="the search phrase")
    ap.add_argument("--file", help="file of queries, one per line")
    ap.add_argument("--loc", type=int, default=2840, help="location code (default 2840 = US)")
    ap.add_argument("--depth", type=int, default=10, help="organic results to show")
    a = ap.parse_args()

    queries = []
    if a.file:
        with open(a.file, encoding="utf-8") as f:
            queries = [ln.strip() for ln in f if ln.strip()]
    if a.query:
        queries.append(" ".join(a.query))
    if not queries:
        sys.exit("give a query or --file")

    for q in queries:
        show(fetch(q, a.loc, a.depth), q, a.depth)


if __name__ == "__main__":
    main()
