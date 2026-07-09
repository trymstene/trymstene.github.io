#!/usr/bin/env python3
"""
shopify.py — pull the REVENUE truth from Shopify, the way ga4.py pulls behaviour
and gsc.py pulls search. GA4 shows clicks TOWARD checkout; this shows what
actually sold: orders, revenue, AOV, top products, recent sales.

    python tools/shopify.py                 # last 60 days
    python tools/shopify.py --days 90
    python tools/shopify.py --raw           # dump the raw JSON blocks

Auth: tools/shopify.local.json (gitignored) — { store, token } OR
{ store, client_id, client_secret } (a first-party app installed on the shop;
we mint a token via the client-credentials grant). Read-only scopes:
read_orders, read_products, read_analytics. Stdlib only (no pip installs).
"""
import argparse, datetime, json, os, sys, urllib.request, urllib.parse, urllib.error

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
CFG = os.path.join(HERE, "shopify.local.json")
API_VERSION = "2026-01"


def die(msg):
    print("\n" + msg + "\n", file=sys.stderr)
    sys.exit(1)


def load():
    if not os.path.exists(CFG):
        die("No tools/shopify.local.json — add { store, token } or { store, client_id, client_secret }.")
    cfg = json.load(open(CFG, encoding="utf-8"))
    store = (cfg.get("store") or "").replace("https://", "").strip("/")
    if not store:
        die('shopify.local.json needs "store" (e.g. yourshop.myshopify.com).')
    return cfg, store


def http(url, data=None, headers=None, method=None):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


def get_token(cfg, store):
    tok = (cfg.get("token") or "").strip()
    if tok and not tok.startswith("PASTE") and (tok.startswith("shp") or len(tok) > 20 and " " not in tok):
        if not tok.startswith("PASTE"):
            return tok
    cid = (cfg.get("client_id") or "").strip()
    cs = (cfg.get("client_secret") or "").strip()
    if not cid or not cs or cs.startswith("PASTE"):
        die("No usable credential in shopify.local.json (need token OR client_id+client_secret).")
    # client-credentials grant → an offline token for this shop
    url = f"https://{store}/admin/oauth/access_token"
    body = urllib.parse.urlencode({
        "client_id": cid, "client_secret": cs, "grant_type": "client_credentials",
    }).encode()
    status, text = http(url, data=body, headers={"Content-Type": "application/x-www-form-urlencoded"}, method="POST")
    try:
        j = json.loads(text)
    except Exception:
        j = {}
    if status == 200 and j.get("access_token"):
        return j["access_token"]
    die("client_credentials grant failed (HTTP %s):\n%s\n\nIf this isn't supported for the app, "
        "we'll switch to the one-click OAuth code flow instead." % (status, text[:400]))


def gql(store, token, query, variables=None):
    url = f"https://{store}/admin/api/{API_VERSION}/graphql.json"
    body = json.dumps({"query": query, "variables": variables or {}}).encode()
    status, text = http(url, data=body, method="POST", headers={
        "Content-Type": "application/json", "X-Shopify-Access-Token": token,
    })
    if status != 200:
        die("Admin API error (HTTP %s):\n%s" % (status, text[:500]))
    j = json.loads(text)
    if j.get("errors"):
        die("GraphQL errors:\n" + json.dumps(j["errors"], indent=2)[:600])
    return j["data"]


def money(v):
    try:
        return float(v)
    except Exception:
        return 0.0


def main():
    ap = argparse.ArgumentParser(description="Shopify revenue pull")
    ap.add_argument("--days", type=int, default=60)
    ap.add_argument("--products", action="store_true", help="list the catalog instead of orders")
    ap.add_argument("--raw", action="store_true")
    args = ap.parse_args()

    cfg, store = load()
    token = get_token(cfg, store)

    shop = gql(store, token, "{ shop { name currencyCode myshopifyDomain } }")["shop"]
    cur = shop["currencyCode"]

    if args.products:
        print(f"\n=== {shop['name']} · Shopify PRODUCTS ===")
        q = """{ products(first: 100, sortKey: CREATED_AT, reverse: true) {
          edges { node { title productType status totalInventory
            priceRangeV2 { minVariantPrice { amount } maxVariantPrice { amount } }
            variants(first: 100) { edges { node { id } } } } } } }"""
        prods = [e["node"] for e in gql(store, token, q)["products"]["edges"]]
        print(f"  {len(prods)} products\n")
        for p in prods:
            lo = money(p["priceRangeV2"]["minVariantPrice"]["amount"])
            hi = money(p["priceRangeV2"]["maxVariantPrice"]["amount"])
            price = f"{lo:,.0f}" + ("" if lo == hi else f"-{hi:,.0f}") + f" {cur}"
            nv = len(p["variants"]["edges"])
            print(f"  [{p['status']:<8}] {price:>14}  {nv:>2} var  {p['title'][:50]}  · {p['productType'] or '—'}")
        return

    print(f"\n=== {shop['name']} · Shopify · last {args.days}d ({shop['myshopifyDomain']}) ===")

    since = (datetime.date.today() - datetime.timedelta(days=args.days)).isoformat()
    q = """
    query($q: String!, $cursor: String) {
      orders(first: 100, after: $cursor, query: $q, sortKey: CREATED_AT, reverse: true) {
        edges { cursor node {
          name createdAt displayFinancialStatus
          currentTotalPriceSet { shopMoney { amount } }
          lineItems(first: 20) { edges { node { quantity title } } }
        } }
        pageInfo { hasNextPage }
      }
    }"""
    orders, cursor = [], None
    while True:
        d = gql(store, token, q, {"q": f"created_at:>={since}", "cursor": cursor})["orders"]
        orders += [e["node"] for e in d["edges"]]
        if not d["pageInfo"]["hasNextPage"] or len(orders) >= 1000:
            break
        cursor = d["edges"][-1]["cursor"]

    if args.raw:
        print(json.dumps(orders, indent=2)[:4000]); return

    n = len(orders)
    revenue = sum(money(o["currentTotalPriceSet"]["shopMoney"]["amount"]) for o in orders)
    aov = revenue / n if n else 0
    print("\n-- ORDERS ------------------------------------------")
    print(f"  Orders                 {n}")
    print(f"  Revenue                {revenue:,.0f} {cur}")
    print(f"  AOV                    {aov:,.0f} {cur}")

    prod = {}
    for o in orders:
        for e in o["lineItems"]["edges"]:
            t = e["node"]["title"]
            prod[t] = prod.get(t, 0) + e["node"]["quantity"]
    if prod:
        print("\n-- TOP PRODUCTS (units sold) -----------------------")
        for t, qty in sorted(prod.items(), key=lambda x: -x[1])[:12]:
            print(f"  {qty:>4}  {t[:60]}")

    print("\n-- RECENT ORDERS -----------------------------------")
    for o in orders[:10]:
        amt = money(o["currentTotalPriceSet"]["shopMoney"]["amount"])
        print(f"  {o['createdAt'][:10]}  {amt:>8,.0f} {cur}  {o['displayFinancialStatus']:<10}  {o['name']}")
    if not n:
        print("  (no orders in the window)")


if __name__ == "__main__":
    main()
