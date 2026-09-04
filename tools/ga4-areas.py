# -*- coding: utf-8 -*-
"""ga4-areas.py — WHICH AREA IS ACTUALLY STICKY? Area vs area, not area vs its own past.

The question this answers is "where do people stay and do things", and the trap
it exists to avoid is the one that produced a wrong answer on 4 Sep 2026:
comparing ONE area to its own previous week says how much that area improved,
which is not the same question and can point the opposite way.

    python tools/ga4-areas.py                 # last 7 days
    python tools/ga4-areas.py --days 2        # since the farm flip
    python tools/ga4-areas.py --days 30

⚠️ ENGAGEMENT TIME IS PER SCREEN, NOT PER SESSION. A world area is one page the
player stays on, so userEngagementDuration / activeUsers on that page path is
the honest "how long do they stay here" number. Sessions can span areas.
"""
import argparse, json, os, sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    RunReportRequest, DateRange, Dimension, Metric, Filter, FilterExpression,
    FilterExpressionList,
)
from google.oauth2 import service_account

HERE = os.path.dirname(os.path.abspath(__file__))
CFG = json.load(open(os.path.join(HERE, 'ga4.local.json'), encoding='utf-8'))
creds = service_account.Credentials.from_service_account_file(
    CFG['key_path'], scopes=['https://www.googleapis.com/auth/analytics.readonly'])
client = BetaAnalyticsDataClient(credentials=creds)
PROP = f"properties/{CFG['property_id']}"

ap = argparse.ArgumentParser()
ap.add_argument('--days', type=int, default=7)
A = ap.parse_args()
START = f'{A.days}daysAgo'

# the five walkable areas + the two benches, by page path prefix
AREAS = [
    ('rave',       '/rave/'),
    ('park',       '/park/'),
    ('beach',      '/beach/'),
    ('homestead',  '/homestead/'),
    ('stand',      '/banana-stand/'),
    ('builder',    '/make-a-banana/'),
    ('workshop',   '/forge/items/'),
    ('pass',       '/pass/'),
]
# every world event, bucketed to the area it belongs to
EV_PREFIX = {
    'rave': 'rave_', 'park': 'park_', 'beach': 'beach_',
    'homestead': 'homestead_', 'stand': 'stand_',
}


def page_rows():
    """activeUsers + engagement seconds + views, per page path."""
    req = RunReportRequest(
        property=PROP,
        date_ranges=[DateRange(start_date=START, end_date='today')],
        dimensions=[Dimension(name='pagePath')],
        metrics=[Metric(name='activeUsers'), Metric(name='screenPageViews'),
                 Metric(name='userEngagementDuration')],
        limit=100000,
    )
    out = []
    for r in client.run_report(req).rows:
        out.append((r.dimension_values[0].value,
                    int(r.metric_values[0].value or 0),
                    int(r.metric_values[1].value or 0),
                    int(r.metric_values[2].value or 0)))
    return out


def event_rows():
    req = RunReportRequest(
        property=PROP,
        date_ranges=[DateRange(start_date=START, end_date='today')],
        dimensions=[Dimension(name='eventName')],
        metrics=[Metric(name='eventCount')],
        limit=100000,
    )
    return {r.dimension_values[0].value: int(r.metric_values[0].value or 0)
            for r in client.run_report(req).rows}


pages = page_rows()
events = event_rows()

print(f'=== AREA vs AREA · last {A.days} days · property {CFG["property_id"]} ===\n')

# ── who goes where, and how long do they stay ────────────────────────────
rows = []
for name, prefix in AREAS:
    users = views = secs = 0
    for path, u, v, s in pages:
        if path.split('?')[0].rstrip('/') + '/' == prefix or path.startswith(prefix):
            users += u
            views += v
            secs += s
    acts = sum(n for e, n in events.items()
               if EV_PREFIX.get(name) and e.startswith(EV_PREFIX[name]))
    rows.append({'area': name, 'users': users, 'views': views, 'secs': secs,
                 'per_user': (secs / users) if users else 0,
                 'acts': acts, 'acts_per_user': (acts / users) if users else 0})

rows.sort(key=lambda r: r['per_user'], reverse=True)
print(f'{"area":<11}{"users":>7}{"views":>8}{"time/user":>12}{"actions":>10}{"acts/user":>11}')
print('-' * 59)
for r in rows:
    t = f'{r["per_user"]:.0f}s'
    a = f'{r["acts"]}' if EV_PREFIX.get(r['area']) else '—'
    ap_ = f'{r["acts_per_user"]:.1f}' if EV_PREFIX.get(r['area']) else '—'
    print(f'{r["area"]:<11}{r["users"]:>7}{r["views"]:>8}{t:>12}{a:>10}{ap_:>11}')

print('\n⚠️ time/user = userEngagementDuration / activeUsers on that path.')
print('   actions = world events named for that area; — = no event prefix.')
