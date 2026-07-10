#!/usr/bin/env python3
"""
gsc.py — pull fresh Google Search Console numbers for trymstene.com, the way
ga4.py does for behaviour. GSC is the GROWTH dataset: what people SEARCH (and
whether they click) before they ever reach the site. Reuses the same
service-account key as ga4.py.

    python tools/gsc.py                 # last 28 days (GSC lags ~3 days)
    python tools/gsc.py --range 90d
    python tools/gsc.py --range 2026-06-01:2026-06-28

Config (tools/ga4.local.json — gitignored): add "gsc_site". Either a URL-prefix
property ("https://trymstene.com/") or a Domain property ("sc-domain:trymstene.com").
Setup: tools/GA4-SETUP.md (Search Console section). Needs:
    pip install google-api-python-client
"""
import argparse, datetime, json, os, sys

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
LOCAL_CFG = os.path.join(HERE, "ga4.local.json")


def die(msg):
    print("\n" + msg + "\n", file=sys.stderr)
    sys.exit(1)


def load():
    cfg = {}
    if os.path.exists(LOCAL_CFG):
        with open(LOCAL_CFG) as f:
            cfg = json.load(f)
    site = cfg.get("gsc_site") or os.environ.get("GSC_SITE")
    key = cfg.get("key_path") or os.environ.get("GA4_KEY_PATH") \
        or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    return site, key


def daterange(r):
    """GSC data lags ~3 days, so windows END 3 days ago. Accepts Nd or
    YYYY-MM-DD:YYYY-MM-DD. Returns (label, start, end) ISO strings."""
    r = (r or "28d").strip()
    if ":" in r:
        a, b = r.split(":")
        return f"{a}..{b}", a, b
    if not r.lower().endswith("d") or not r[:-1].isdigit():
        die("--range must be 28d / 90d or YYYY-MM-DD:YYYY-MM-DD")
    n = int(r[:-1])
    end = datetime.date.today() - datetime.timedelta(days=3)
    start = end - datetime.timedelta(days=n - 1)
    return f"last {n}d", start.isoformat(), end.isoformat()


def main():
    ap = argparse.ArgumentParser(description="Fresh Search Console numbers")
    ap.add_argument("--range", default="28d")
    ap.add_argument("--rows", type=int, default=25, help="rows per breakdown")
    args = ap.parse_args()

    site, key = load()
    if not site:
        die('No GSC property. Add "gsc_site" to tools/ga4.local.json — a URL-prefix '
            '("https://trymstene.com/") or Domain ("sc-domain:trymstene.com") property. '
            "See tools/GA4-SETUP.md.")
    if not key or not os.path.exists(key):
        die("No service-account key (key_path in tools/ga4.local.json). See tools/GA4-SETUP.md.")

    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
    except ImportError:
        die("Missing dependency. Run:\n    pip install google-api-python-client")

    creds = service_account.Credentials.from_service_account_file(
        key, scopes=["https://www.googleapis.com/auth/webmasters.readonly"])
    svc = build("searchconsole", "v1", credentials=creds, cache_discovery=False)

    label, start, end = daterange(args.range)

    def q(dimensions, limit, search_type=None):
        body = {"startDate": start, "endDate": end, "dimensions": dimensions,
                "rowLimit": limit, "dataState": "all"}
        if search_type:
            body["type"] = search_type  # 'image' = Google Images (the meme's real battlefield)
        try:
            resp = svc.searchanalytics().query(siteUrl=site, body=body).execute()
        except Exception as e:  # noqa: BLE001
            die(f"Search Console API error: {str(e).splitlines()[0]}\n"
                f"(is {site} the exact property, and is the service account added as a user?)")
        return resp.get("rows", [])

    print(f"\n=== trymstene.com · Search Console · {label} ({start}…{end}) ===")
    print(f"    property: {site}")

    tot = q([], 1)
    if tot:
        r = tot[0]
        c, i = r.get("clicks", 0), r.get("impressions", 0)
        ctr = (c / i * 100) if i else 0
        print(f"\n  TOTALS: {int(c):,} clicks · {int(i):,} impressions · "
              f"{ctr:.2f}% CTR · pos {r.get('position', 0):.1f}")

    def block(title, dim, limit, sort_key, search_type=None):
        rows = q([dim], limit, search_type)
        rows.sort(key=lambda x: x.get(sort_key, 0), reverse=True)
        print(f"\n-- {title} " + "-" * max(2, 40 - len(title)))
        print(f"  {'clicks':>6} {'impr':>9} {'CTR':>6} {'pos':>5}  {dim}")
        for x in rows[:limit]:
            c, i = x.get("clicks", 0), x.get("impressions", 0)
            ctr = (c / i * 100) if i else 0
            term = (x.get("keys", ["?"])[0])[:50]
            print(f"  {int(c):>6} {int(i):>9,} {ctr:>5.1f}% {x.get('position', 0):>5.1f}  {term}")

    # the CTR-gap view: queries by IMPRESSIONS = where the clicks are hiding
    block("QUERIES by IMPRESSIONS (the CTR opportunity)", "query", args.rows, "impressions")
    block("QUERIES by CLICKS (what wins clicks)", "query", 15, "clicks")
    block("PAGES", "page", 12, "clicks")
    block("COUNTRIES", "country", 10, "clicks")
    block("DEVICES", "device", 5, "clicks")

    # GOOGLE IMAGES — the meme's real battlefield (default pulls are web-only;
    # the 16-mo data says most impressions are the image pack).
    img_tot = q([], 1, "image")
    print("\n" + "=" * 52)
    if img_tot:
        r = img_tot[0]
        c, i = r.get("clicks", 0), r.get("impressions", 0)
        ctr = (c / i * 100) if i else 0
        print(f"  GOOGLE IMAGES: {int(c):,} clicks · {int(i):,} impressions · "
              f"{ctr:.2f}% CTR · pos {r.get('position', 0):.1f}")
        block("IMAGE QUERIES by IMPRESSIONS", "query", 15, "impressions", "image")
        block("IMAGE PAGES", "page", 10, "clicks", "image")
    else:
        print("  GOOGLE IMAGES: no data in this window yet")
    print()


if __name__ == "__main__":
    main()
