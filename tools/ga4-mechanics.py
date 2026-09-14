# -*- coding: utf-8 -*-
"""Which MECHANICS do players actually repeat? Every world event, last N days:
how many did it, how many times, and repeats per person — the stickiness cut.

Trym, 14 Sep 2026: "the easyness of tasks on the park is the best stickyness we have
at the moment" — this is the table that says whether that is true, per mechanic.

    python tools/ga4-mechanics.py --days 30
"""
import argparse, json, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import RunReportRequest, DateRange, Dimension, Metric
from google.oauth2 import service_account

P = argparse.ArgumentParser()
P.add_argument('--days', type=int, default=30)
P.add_argument('--min-users', type=int, default=3, help='hide events fewer people than this ever fired')
A = P.parse_args()

CFG = json.load(open(r'C:\Web Development\trymstene.com\tools\ga4.local.json', encoding='utf-8'))
creds = service_account.Credentials.from_service_account_file(CFG['key_path'], scopes=['https://www.googleapis.com/auth/analytics.readonly'])
client = BetaAnalyticsDataClient(credentials=creds)
PROP = 'properties/%s' % CFG['property_id']

# the world's event families, by prefix. Anything else is site chrome.
AREA_OF = [
    ('park', ('park_',)),
    ('beach', ('beach_', 'bh_', 'bay_')),
    ('homestead', ('hs_', 'homestead_', 'farm_', 'yard_')),
    ('rave', ('rave_', 'rv_')),
    ('town', ('town_', 'tw_', 'arcade_')),
    ('stand', ('stand_',)),
    ('quest', ('bwq_', 'quest_')),
]
def area_of(ev):
    for name, pres in AREA_OF:
        if any(ev.startswith(p) for p in pres): return name
    return None

req = RunReportRequest(property=PROP,
    date_ranges=[DateRange(start_date='%ddaysAgo' % A.days, end_date='today')],
    dimensions=[Dimension(name='eventName')],
    metrics=[Metric(name='eventCount'), Metric(name='totalUsers')],
    limit=100000)
rows = []
for r in client.run_report(req).rows:
    ev = r.dimension_values[0].value
    n, u = int(r.metric_values[0].value), int(r.metric_values[1].value)
    a = area_of(ev)
    if a and u >= A.min_users: rows.append((a, ev, n, u, n / u))

print('=== WORLD MECHANICS · last %d days · repeats per person ===' % A.days)
print('(count / people = how many times the average person who did it at all did it)\n')
for area, _ in AREA_OF:
    mine = sorted([r for r in rows if r[0] == area], key=lambda r: -r[4])
    if not mine: continue
    print('--- %s ---' % area)
    print('%-34s%8s%8s%10s' % ('event', 'people', 'count', 'per person'))
    for _, ev, n, u, per in mine:
        print('%-34s%8d%8d%10.1f' % (ev, u, n, per))
    print('')
