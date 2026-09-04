# -*- coding: utf-8 -*-
"""ga4-traffic.py — TRAFFIC BY CHANNEL, and the organic trend.

⚠️ THE MISTAKE THIS EXISTS TO STOP (4 Sep 2026): I reported "traffic is down
25-30%" from a 7-vs-7 total. Ads had run in the prior week and not in this one,
so the total was measuring the ad budget, not the site. A total that mixes paid
and organic cannot answer a question about either. Segment first, always.

Organic Search is the honest baseline for "is this thing growing" — nobody buys
it, so it moves only with rankings and visibility.

    python tools/ga4-traffic.py                # channels, 7 vs prior 7
    python tools/ga4-traffic.py --weeks 10     # + weekly organic trend
"""
import argparse, json, os, sys
from collections import defaultdict
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    RunReportRequest, DateRange, Dimension, Metric,
)
from google.oauth2 import service_account

HERE = os.path.dirname(os.path.abspath(__file__))
CFG = json.load(open(os.path.join(HERE, 'ga4.local.json'), encoding='utf-8'))
creds = service_account.Credentials.from_service_account_file(
    CFG['key_path'], scopes=['https://www.googleapis.com/auth/analytics.readonly'])
client = BetaAnalyticsDataClient(credentials=creds)
PROP = f"properties/{CFG['property_id']}"

ap = argparse.ArgumentParser()
ap.add_argument('--weeks', type=int, default=9)
A = ap.parse_args()


def q(dims, mets, start, end, limit=100000):
    req = RunReportRequest(
        property=PROP,
        date_ranges=[DateRange(start_date=start, end_date=end)],
        dimensions=[Dimension(name=d) for d in dims],
        metrics=[Metric(name=m) for m in mets],
        limit=limit,
    )
    return [([v.value for v in r.dimension_values],
             [v.value for v in r.metric_values]) for r in client.run_report(req).rows]


# ── 1. channels, this week vs last ───────────────────────────────────────
print('=== TRAFFIC BY CHANNEL · last 7 days vs prior 7 ===\n')
cur = {d[0]: (int(m[0]), int(m[1]), int(m[2] or 0))
       for d, m in q(['sessionDefaultChannelGroup'],
                     ['sessions', 'activeUsers', 'userEngagementDuration'], '7daysAgo', 'today')}
prv = {d[0]: (int(m[0]), int(m[1]), int(m[2] or 0))
       for d, m in q(['sessionDefaultChannelGroup'],
                     ['sessions', 'activeUsers', 'userEngagementDuration'], '14daysAgo', '8daysAgo')}

names = sorted(set(cur) | set(prv), key=lambda n: -cur.get(n, (0, 0, 0))[0])
print(f'{"channel":<22}{"sessions":>10}{"prev":>8}{"change":>10}{"s/user":>9}')
print('-' * 59)
for n in names:
    c = cur.get(n, (0, 0, 0))
    p = prv.get(n, (0, 0, 0))
    ch = '—' if not p[0] else f'{(c[0] - p[0]) / p[0] * 100:+.0f}%'
    spu = f'{(c[2] / c[1]):.0f}s' if c[1] else '—'
    print(f'{n:<22}{c[0]:>10}{p[0]:>8}{ch:>10}{spu:>9}')
tc, tp = sum(v[0] for v in cur.values()), sum(v[0] for v in prv.values())
print('-' * 59)
print(f'{"TOTAL":<22}{tc:>10}{tp:>8}{((tc - tp) / tp * 100 if tp else 0):>9.0f}%')

# ── 2. is organic actually growing? ──────────────────────────────────────
print(f'\n=== ORGANIC SEARCH, WEEK BY WEEK (last {A.weeks} weeks) ===\n')
rows = q(['date', 'sessionDefaultChannelGroup'], ['sessions', 'activeUsers'],
         f'{A.weeks * 7}daysAgo', 'today')
weeks = defaultdict(lambda: [0, 0])
today = date.today()
for d, m in rows:
    if d[1] != 'Organic Search':
        continue
    day = date(int(d[0][:4]), int(d[0][4:6]), int(d[0][6:]))
    wk = (today - day).days // 7          # 0 = this week
    weeks[wk][0] += int(m[0])
    weeks[wk][1] += int(m[1])

print(f'{"week ending":<14}{"organic sessions":>18}{"users":>8}   trend')
print('-' * 58)
mx = max((v[0] for v in weeks.values()), default=1) or 1
for wk in sorted(weeks, reverse=True):
    s, u = weeks[wk]
    end = today - timedelta(days=wk * 7)
    bar = '█' * max(1, round(s / mx * 26))
    print(f'{end.isoformat():<14}{s:>18}{u:>8}   {bar}')
print('\n⚠️ week 0 is partial — it ends today, not on a Sunday.')
