#!/usr/bin/env python3
"""
ga4.py — pull fresh GA4 numbers for trymstene.com straight from the Data API,
so the workflow can build on real insight instead of guesses. No manual export,
no dashboards. Run it, read the synthesised numbers-with-trend.

    python tools/ga4.py                 # last 28 days vs the 28 before
    python tools/ga4.py --range 7d      # last 7 days vs the 7 before
    python tools/ga4.py --range 90d
    python tools/ga4.py --events        # full event table, not just commercial

One-time setup lives in tools/GA4-SETUP.md. Secrets (the service-account key +
the property id) are read from tools/ga4.local.json (gitignored) or env vars —
never hardcoded, never committed.
"""
import argparse
import json
import os
import sys

# Windows consoles default to cp1252, which can't encode →/· etc. Force UTF-8.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # noqa: BLE001 — older/odd stdouts just keep their default
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
LOCAL_CFG = os.path.join(HERE, "ga4.local.json")

# our tracked events, grouped the way we actually think about them (see
# traffic-and-monetization memory / public/js/main.js + banana-builder.js)
FUNNEL = [
    ("generator_click", "→ builder opened (any entry point)"),
    ("builder_start", "   builder actually loaded"),
    ("sticker_order_click", "   started a sticker order"),
    ("sticker_preview_confirm", "   confirmed preview = BEGIN CHECKOUT"),
    ("sticker_upload_ok", "   art uploaded ok"),
    ("checkout_redirect", "   → sent to Shopify checkout"),
    ("sticker_order_fail", "   ⚠ pipeline failure (alarm)"),
]
SURFACES = ["gif_download", "png_download", "wallpaper_download",
            "share_link_copy", "tip_click", "license_click", "surprise_me",
            "overlay_link_copy"]


def load_config(cli_prop):
    cfg = {}
    if os.path.exists(LOCAL_CFG):
        with open(LOCAL_CFG) as f:
            cfg = json.load(f)
    prop = cli_prop or cfg.get("property_id") or os.environ.get("GA4_PROPERTY_ID")
    key = cfg.get("key_path") or os.environ.get("GA4_KEY_PATH") \
        or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if key and os.path.exists(key):
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = key
    return prop, key


def die(msg):
    print("\n" + msg + "\n", file=sys.stderr)
    sys.exit(1)


def parse_range(r):
    """Return (n_days, current (start,end), previous (start,end)). Accepts either
    a relative window ('28d' / 7d / 90d) or an explicit 'YYYY-MM-DD:YYYY-MM-DD'.
    The previous window is always the equal-length span immediately before —
    e.g. explicit '2026-06-30:2026-07-07' auto-compares to the 8 days before it
    (the pre-launch Wix site)."""
    import datetime
    r = (r or "28d").strip()
    if ":" in r:  # explicit dates
        try:
            a, b = r.split(":")
            start = datetime.date.fromisoformat(a)
            end = datetime.date.fromisoformat(b)
        except ValueError:
            die(f"--range dates must be YYYY-MM-DD:YYYY-MM-DD (got {r!r})")
        n = (end - start).days + 1
        if n < 1:
            die("--range end is before start")
        prev_end = start - datetime.timedelta(days=1)
        prev_start = prev_end - datetime.timedelta(days=n - 1)
        return n, (a, b), (prev_start.isoformat(), prev_end.isoformat())
    r = r.lower()
    if not r.endswith("d") or not r[:-1].isdigit():
        die(f"--range must be 28d / 7d / 90d or YYYY-MM-DD:YYYY-MM-DD (got {r!r})")
    n = int(r[:-1])
    return n, (f"{n}daysAgo", "1daysAgo"), (f"{2 * n}daysAgo", f"{n + 1}daysAgo")


def pct(cur, prev):
    if prev == 0:
        return "  new" if cur else "    —"
    return f"{(cur - prev) / prev * 100:+5.0f}%"


def main():
    ap = argparse.ArgumentParser(description="Fresh GA4 numbers for trymstene.com")
    ap.add_argument("--range", default="28d", help="window, e.g. 28d / 7d / 90d")
    ap.add_argument("--prop", help="override GA4 property id")
    ap.add_argument("--events", action="store_true", help="show the FULL event table")
    args = ap.parse_args()

    prop, key = load_config(args.prop)
    if not prop:
        die("No GA4 property id. Put it in tools/ga4.local.json "
            '({"property_id": "123456789", "key_path": "…/key.json"}) '
            "or set GA4_PROPERTY_ID. See tools/GA4-SETUP.md.")
    if not key:
        die("No service-account key found. Set key_path in tools/ga4.local.json "
            "or GOOGLE_APPLICATION_CREDENTIALS. See tools/GA4-SETUP.md.")

    try:
        from google.analytics.data_v1beta import BetaAnalyticsDataClient
        from google.analytics.data_v1beta.types import (
            DateRange, Dimension, Metric, RunReportRequest, OrderBy)
    except ImportError:
        die("Missing dependency. Run:\n    pip install google-analytics-data")

    client = BetaAnalyticsDataClient()
    n, cur, prev = parse_range(args.range)

    def run(dimensions, metrics, dr, limit=25, order_metric=None):
        req = RunReportRequest(
            property=f"properties/{prop}",
            dimensions=[Dimension(name=d) for d in dimensions],
            metrics=[Metric(name=m) for m in metrics],
            date_ranges=[DateRange(start_date=dr[0], end_date=dr[1])],
            limit=limit,
            order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name=order_metric),
                               desc=True)] if order_metric else None,
        )
        resp = client.run_report(req)
        rows = []
        for row in resp.rows:
            dims = tuple(dv.value for dv in row.dimension_values)
            mets = [mv.value for mv in row.metric_values]
            rows.append((dims, mets))
        return rows

    def scalar(metrics, dr):
        rows = run([], metrics, dr, limit=1)
        return [float(x) for x in rows[0][1]] if rows else [0.0] * len(metrics)

    print(f"\n=== trymstene.com · GA4 · last {n} days vs prior {n} "
          f"(property {prop}) ===")

    # 1) overview with trend
    om = ["sessions", "totalUsers", "newUsers", "engagedSessions",
          "engagementRate", "userEngagementDuration"]
    c = scalar(om, cur)
    p = scalar(om, prev)
    labels = ["Sessions", "Users", "New users", "Engaged sessions"]
    print("\n-- OVERVIEW " + "-" * 48)
    for i, lab in enumerate(labels):
        print(f"  {lab:<20} {int(c[i]):>8,}   ({pct(c[i], p[i])} vs prev {int(p[i]):,})")
    er_c, er_p = c[4] * 100, p[4] * 100
    print(f"  {'Engagement rate':<20} {er_c:>7.1f}%   ({pct(er_c, er_p)})")
    # avg engagement time per session = userEngagementDuration / sessions
    avg_c = (c[5] / c[0]) if c[0] else 0
    avg_p = (p[5] / p[0]) if p[0] else 0
    print(f"  {'Avg engagement/sess':<20} {avg_c:>7.1f}s   ({pct(avg_c, avg_p)})")

    # 2) landing pages (where the traffic actually lands)
    print("\n-- TOP LANDING PAGES " + "-" * 39)
    lp = run(["landingPagePlusQueryString"], ["sessions", "engagementRate"], cur,
             limit=10, order_metric="sessions")
    tot = sum(float(m[0]) for _, m in lp) or 1
    for dims, mets in lp:
        s = int(float(mets[0]))
        page = (dims[0] or "(not set)")[:44]
        print(f"  {s:>6,} ({s / tot * 100:>4.0f}%) {float(mets[1]) * 100:>4.0f}% eng  {page}")

    # 3) events — current vs previous, so we see movement
    ev_c = {d[0]: float(m[0]) for d, m in run(["eventName"], ["eventCount"], cur, limit=200)}
    ev_p = {d[0]: float(m[0]) for d, m in run(["eventName"], ["eventCount"], prev, limit=200)}

    def ev(name):
        return ev_c.get(name, 0.0), ev_p.get(name, 0.0)

    print("\n-- THE MONEY FUNNEL " + "-" * 40)
    for name, desc in FUNNEL:
        cc, pp = ev(name)
        print(f"  {int(cc):>6,}  ({pct(cc, pp)})  {name:<24} {desc}")
    # headline conversion rates
    gc = ev_c.get("generator_click", 0)
    bc = ev_c.get("sticker_preview_confirm", 0)
    co = ev_c.get("checkout_redirect", 0)
    if gc:
        print(f"\n  builder-open → begin-checkout : {bc / gc * 100:.1f}%  ({int(bc)}/{int(gc)})")
    if bc:
        print(f"  begin-checkout → checkout     : {co / bc * 100:.1f}%  ({int(co)}/{int(bc)})")

    print("\n-- CONTENT / SURFACES " + "-" * 38)
    for name in SURFACES:
        cc, pp = ev(name)
        if cc or pp:
            print(f"  {int(cc):>6,}  ({pct(cc, pp)})  {name}")

    # 4) generator_click by placement — THE hub_sticker test.
    # needs 'placement' registered as an event-scoped custom dimension in GA4.
    print("\n-- BUILDER ENTRY BY PLACEMENT (the CTA test) " + "-" * 15)
    try:
        rows = run(["customEvent:placement"], ["eventCount"], cur,
                   limit=25, order_metric="eventCount")
        prows = {d[0]: float(m[0]) for d, m in
                 run(["customEvent:placement"], ["eventCount"], prev, limit=25)}
        if not rows:
            print("  (no data yet)")
        for dims, mets in rows:
            place = dims[0] or "(not set)"
            cc = float(mets[0])
            print(f"  {int(cc):>6,}  ({pct(cc, prows.get(dims[0], 0))})  {place}")
    except Exception as e:  # noqa: BLE001 — expected until the custom dim exists
        print("  ⚠ can't break down by placement yet — register 'placement' as an")
        print("    event-scoped Custom Dimension in GA4 Admin (Data display →")
        print("    Custom definitions). Until then only totals are available.")
        print(f"    ({str(e).splitlines()[0][:80]})")

    # 5) full event table on request
    if args.events:
        print("\n-- ALL EVENTS " + "-" * 46)
        for name, cc in sorted(ev_c.items(), key=lambda kv: kv[1], reverse=True):
            print(f"  {int(cc):>6,}  ({pct(cc, ev_p.get(name, 0))})  {name}")

    print()


if __name__ == "__main__":
    main()
