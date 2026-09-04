# -*- coding: utf-8 -*-
"""ga4-areas.py — WHICH AREA IS ACTUALLY STICKY? Area vs area, segmented.

Two mistakes this exists to stop, both made on 4 Sep 2026:

1. COMPARING AN AREA TO ITS OWN PAST answers "did it improve", which is a
   different question from "is it the sticky one" and can point the opposite
   way. The homestead's own numbers were up ~10x while it sat LAST of the
   walkable areas.
2. NOT SEGMENTING BY CHANNEL. Paid Social sits at 56s a user and Organic
   Search at 253s, so an unsegmented table mostly measures the ad budget —
   and because ads are deliberately landed on ONE area, that area's average
   gets dragged through the floor and reads as a bad area.

    python tools/ga4-areas.py --days 30 --channel "Organic Search"   # the honest one
    python tools/ga4-areas.py --days 30 --channel "Paid Social"
    python tools/ga4-areas.py --days 2                               # since the farm flip

⚠️ ENGAGEMENT TIME IS PER SCREEN, NOT PER SESSION. A world area is one page the
player stays on, so userEngagementDuration / activeUsers on that page path is
the honest "how long do they stay here" number. Sessions span areas.
⚠️ acts/user is NOT comparable ACROSS areas — event granularity differs wildly
(the beach counts every volleyball touch). Compare it within one area over time.
"""
import argparse, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    RunReportRequest, DateRange, Dimension, Metric, Filter, FilterExpression,
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
ap.add_argument('--channel', default='', help='e.g. "Organic Search", "Paid Social"')
A = ap.parse_args()
START = f'{A.days}daysAgo'
CHAN = A.channel.strip()
CHAN_FILTER = FilterExpression(filter=Filter(
    field_name='sessionDefaultChannelGroup',
    string_filter=Filter.StringFilter(
        value=CHAN, match_type=Filter.StringFilter.MatchType.EXACT),
)) if CHAN else None

AREAS = [
    ('rave', '/rave/'), ('park', '/park/'), ('beach', '/beach/'),
    ('homestead', '/homestead/'), ('stand', '/banana-stand/'),
    ('builder', '/make-a-banana/'), ('workshop', '/forge/items/'),
    ('pass', '/pass/'),
]
EV_PREFIX = {'rave': 'rave_', 'park': 'park_', 'beach': 'beach_',
             'homestead': 'homestead_', 'stand': 'stand_'}


def page_rows():
    req = RunReportRequest(
        property=PROP,
        date_ranges=[DateRange(start_date=START, end_date='today')],
        dimensions=[Dimension(name='pagePath')],
        metrics=[Metric(name='activeUsers'), Metric(name='screenPageViews'),
                 Metric(name='userEngagementDuration')],
        dimension_filter=CHAN_FILTER,
        limit=100000,
    )
    return [(r.dimension_values[0].value,
             int(r.metric_values[0].value or 0),
             int(r.metric_values[1].value or 0),
             int(r.metric_values[2].value or 0))
            for r in client.run_report(req).rows]


def event_rows():
    req = RunReportRequest(
        property=PROP,
        date_ranges=[DateRange(start_date=START, end_date='today')],
        dimensions=[Dimension(name='eventName')],
        metrics=[Metric(name='eventCount')],
        dimension_filter=CHAN_FILTER,
        limit=100000,
    )
    return {r.dimension_values[0].value: int(r.metric_values[0].value or 0)
            for r in client.run_report(req).rows}


pages = page_rows()
events = event_rows()

label = CHAN if CHAN else 'ALL CHANNELS — unsegmented, see the warning above'
print('=== AREA vs AREA · last %d days · %s ===' % (A.days, label))
print('')

rows = []
for name, prefix in AREAS:
    users = views = secs = 0
    for path, u, v, sec in pages:
        if path.split('?')[0].rstrip('/') + '/' == prefix or path.startswith(prefix):
            users += u
            views += v
            secs += sec
    acts = sum(n for e, n in events.items()
               if EV_PREFIX.get(name) and e.startswith(EV_PREFIX[name]))
    rows.append({'area': name, 'users': users, 'views': views,
                 'per_user': (secs / users) if users else 0,
                 'acts': acts, 'acts_per_user': (acts / users) if users else 0})

rows.sort(key=lambda r: r['per_user'], reverse=True)
print('%-11s%7s%8s%12s%10s%11s' % ('area', 'users', 'views', 'time/user', 'actions', 'acts/user'))
print('-' * 59)
for r in rows:
    has_ev = EV_PREFIX.get(r['area'])
    print('%-11s%7d%8d%12s%10s%11s' % (
        r['area'], r['users'], r['views'], '%.0fs' % r['per_user'],
        str(r['acts']) if has_ev else '—',
        ('%.1f' % r['acts_per_user']) if has_ev else '—'))

print('')
print('⚠️ time/user = userEngagementDuration / activeUsers on that path.')
print('⚠️ acts/user is NOT comparable across areas (granularity differs).')
