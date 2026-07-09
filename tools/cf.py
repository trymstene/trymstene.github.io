#!/usr/bin/env python3
"""
cf.py — Cloudflare Web Analytics pull (adblocker-resilient pageview truth).

GA4 is blocked for ~30-40% of visitors; Cloudflare's beacon is server-side and
counts them too, so this cross-checks the REAL traffic total + top pages /
countries / referrers. Beacon wired in public/js/main.js (production-only).

    python tools/cf.py               # last 7 days
    python tools/cf.py --days 30

Auth: tools/cloudflare.local.json (gitignored) — { account_id, api_token }.
api_token needs Account · Account Analytics · Read. Stdlib only (no pip).
NOTE: shows nothing until the beacon has been live + taking traffic for a bit.
"""
import argparse, datetime, json, os, sys, urllib.request, urllib.error

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
CFG = os.path.join(HERE, "cloudflare.local.json")
GQL = "https://api.cloudflare.com/client/v4/graphql"


def die(msg):
    print("\n" + msg + "\n", file=sys.stderr)
    sys.exit(1)


def load():
    if not os.path.exists(CFG):
        die("No tools/cloudflare.local.json — add { account_id, api_token }.")
    cfg = json.load(open(CFG, encoding="utf-8"))
    acct = (cfg.get("account_id") or "").strip()
    tok = (cfg.get("api_token") or "").strip()
    if not acct or not tok or tok.startswith("PASTE"):
        die("cloudflare.local.json needs account_id + api_token.")
    return acct, tok


def gql(token, query, variables):
    body = json.dumps({"query": query, "variables": variables}).encode()
    req = urllib.request.Request(GQL, data=body, method="POST", headers={
        "Content-Type": "application/json", "Authorization": "Bearer " + token,
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            text = r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        die("Cloudflare API error (HTTP %s):\n%s" % (e.code, e.read().decode("utf-8", "replace")[:500]))
    j = json.loads(text)
    if j.get("errors"):
        die("GraphQL errors:\n" + json.dumps(j["errors"], indent=2)[:600])
    return j["data"]


def rum(token, acct, since, until, dims, limit=15):
    q = """
    query($acct:String!,$since:Date!,$until:Date!,$limit:Int!){
      viewer{ accounts(filter:{accountTag:$acct}){
        rumPageloadEventsAdaptiveGroups(
          limit:$limit,
          filter:{date_geq:$since, date_leq:$until},
          orderBy:[count_DESC]
        ){
          count
          sum { visits }
          dimensions { %s }
        }
      }}
    }""" % dims
    d = gql(token, q, {"acct": acct, "since": since, "until": until, "limit": limit})
    accts = d["viewer"]["accounts"]
    return accts[0]["rumPageloadEventsAdaptiveGroups"] if accts else []


def main():
    ap = argparse.ArgumentParser(description="Cloudflare Web Analytics pull")
    ap.add_argument("--days", type=int, default=7)
    args = ap.parse_args()
    acct, token = load()

    until = datetime.date.today()
    since = until - datetime.timedelta(days=args.days - 1)
    s, u = since.isoformat(), until.isoformat()
    print(f"\n=== trymstene.com · Cloudflare Web Analytics · last {args.days}d ({s}…{u}) ===")

    # totals
    tot = rum(token, acct, s, u, "date", limit=1000)
    pv = sum(g["count"] for g in tot)
    vis = sum(g["sum"]["visits"] for g in tot)
    print("\n-- TOTALS ------------------------------------------")
    print(f"  Page views             {pv:,}")
    print(f"  Visits                 {vis:,}")
    if not pv:
        print("\n  (no data yet — the beacon needs to be live + taking traffic;\n"
              "   check back a few hours after deploy.)")
        return

    def block(title, dims, key):
        rows = rum(token, acct, s, u, dims)
        print(f"\n-- {title} --")
        for g in rows[:12]:
            label = g["dimensions"].get(key) or "—"
            print(f"  {g['count']:>7,}  {label[:60]}")

    block("TOP PAGES (by views)", "requestPath", "requestPath")
    block("TOP COUNTRIES", "countryName", "countryName")
    block("TOP REFERRERS", "refererHost", "refererHost")


if __name__ == "__main__":
    main()
