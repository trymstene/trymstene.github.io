# -*- coding: utf-8 -*-
"""ga4-funnel.py — WHERE DOES THE SEO TRAFFIC GO? Landing page -> everything after.

The two meme pages are ~65% of organic growth and organic is the only traffic
nobody buys. This asks the question that follows: of the people those pages
bring, how many ever reach the world, the builder, or a product page — and
what do they do instead.

    python tools/ga4-funnel.py                              # organic, 30d
    python tools/ga4-funnel.py --days 90 --channel ""       # all channels

⚠️ SEGMENTED BY DEFAULT (Organic Search). An unsegmented run mixes in paid
traffic that lands somewhere else entirely and behaves nothing alike.
⚠️ `landingPage` is SESSION-scoped and `pagePath` is EVENT-scoped, so pairing
them gives "pages seen in sessions that started here" — which is the question.
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
PROP = 'properties/%s' % CFG['property_id']

ap = argparse.ArgumentParser()
ap.add_argument('--days', type=int, default=30)
ap.add_argument('--channel', default='Organic Search')
ap.add_argument('--landing', default='/dancing-banana-gif-meme')
A = ap.parse_args()
START = '%ddaysAgo' % A.days

WORLD = ('/rave', '/park', '/beach', '/homestead', '/banana-stand')
MAKE = ('/make-a-banana', '/forge')
SHOP = ('/shop', '/product-page', '/sticker', '/banana-stickers')


def eq(field, value):
    return FilterExpression(filter=Filter(
        field_name=field,
        string_filter=Filter.StringFilter(
            value=value, match_type=Filter.StringFilter.MatchType.EXACT)))


def both(*fs):
    fs = [f for f in fs if f is not None]
    if not fs:
        return None
    if len(fs) == 1:
        return fs[0]
    return FilterExpression(and_group=FilterExpressionList(expressions=list(fs)))


CHAN = eq('sessionDefaultChannelGroup', A.channel) if A.channel else None
LAND = eq('landingPage', A.landing)


def run(dims, mets, filt, limit=100000):
    req = RunReportRequest(
        property=PROP, date_ranges=[DateRange(start_date=START, end_date='today')],
        dimensions=[Dimension(name=d) for d in dims],
        metrics=[Metric(name=m) for m in mets],
        dimension_filter=filt, limit=limit)
    return [([v.value for v in r.dimension_values],
             [v.value for v in r.metric_values]) for r in client.run_report(req).rows]


print('=== %s · %s · last %d days ===' % (A.landing, A.channel or 'all channels', A.days))
print('')

# ── the shape of the visit ───────────────────────────────────────────────
head = run([], ['sessions', 'activeUsers', 'engagedSessions',
                'screenPageViews', 'userEngagementDuration'], both(CHAN, LAND))
if not head:
    print('no sessions matched — check --landing (it has NO trailing slash in GA4)')
    sys.exit(0)
s, u, es, pv, secs = [int(x or 0) for x in head[0][1]]
print('sessions %d   users %d   engaged %d (%.0f%%)   pages/session %.2f   %.0fs each'
      % (s, u, es, es / s * 100 if s else 0, pv / s if s else 0, secs / u if u else 0))
print('')

# ── every page these people saw ──────────────────────────────────────────
pages = run(['pagePath'], ['screenPageViews'], both(CHAN, LAND))
pages = sorted(((p[0], int(m[0])) for p, m in pages), key=lambda x: -x[1])
land_views = next((n for p, n in pages if p.rstrip('/') == A.landing.rstrip('/')), 0)
onward = [(p, n) for p, n in pages if p.rstrip('/') != A.landing.rstrip('/')]

print('WHERE THEY WENT NEXT   (%d onward views from %d sessions)' % (sum(n for _, n in onward), s))
print('-' * 58)
if not onward:
    print('  nowhere. every view was the landing page itself.')
for p, n in onward[:16]:
    print('  %5d  %5.1f%% of sessions   %s' % (n, n / s * 100, p[:42]))
print('')


def bucket(prefixes):
    return sum(n for p, n in onward if any(p.startswith(x) for x in prefixes))


w, m, sh = bucket(WORLD), bucket(MAKE), bucket(SHOP)
print('REACHED   world %d (%.1f%%)   builder/forge %d (%.1f%%)   shop %d (%.1f%%)'
      % (w, w / s * 100 if s else 0, m, m / s * 100 if s else 0, sh, sh / s * 100 if s else 0))
print('')

# ── what they DID ────────────────────────────────────────────────────────
evs = run(['eventName'], ['eventCount'], both(CHAN, LAND))
evs = sorted(((e[0], int(c[0])) for e, c in evs), key=lambda x: -x[1])
SKIP = {'page_view', 'session_start', 'first_visit', 'user_engagement',
        'scroll', 'form_start', 'form_submit'}
print('WHAT THEY DID')
print('-' * 58)
for e, n in evs:
    if e in SKIP:
        continue
    print('  %5d  %5.1f per 100 sessions   %s' % (n, n / s * 100, e))
