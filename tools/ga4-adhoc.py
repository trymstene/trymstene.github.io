# -*- coding: utf-8 -*-
"""Ad-hoc GA4: (1) events in the last ~12 hours, (2) what AD-sourced sessions do."""
import json
import os
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    RunReportRequest, DateRange, Dimension, Metric,
)
from google.oauth2 import service_account

CFG = json.load(open(r'C:\Web Development\trymstene.com\tools\ga4.local.json', encoding='utf-8'))
creds = service_account.Credentials.from_service_account_file(
    CFG['key_path'], scopes=['https://www.googleapis.com/auth/analytics.readonly'])
client = BetaAnalyticsDataClient(credentials=creds)
PROP = f"properties/{CFG['property_id']}"

# --- 1) events by hour, last 2 days -> keep the last 12h (property timezone) ---
req = RunReportRequest(
    property=PROP,
    date_ranges=[DateRange(start_date='yesterday', end_date='today')],
    dimensions=[Dimension(name='dateHour'), Dimension(name='eventName')],
    metrics=[Metric(name='eventCount')],
    limit=100000,
)
rows = client.run_report(req).rows
now = datetime.now()
cutoff = (now - timedelta(hours=12)).strftime('%Y%m%d%H')
recent = {}
for r in rows:
    dh, ev = r.dimension_values[0].value, r.dimension_values[1].value
    if dh >= cutoff:
        recent[ev] = recent.get(ev, 0) + int(r.metric_values[0].value)
print(f'=== EVENTS, last ~12h (since {cutoff[:8]} {cutoff[8:]}:00, property tz) ===')
for ev, n in sorted(recent.items(), key=lambda x: -x[1]):
    print(f'  {n:5d}  {ev}')

# --- 2) sessions + events by source (spot the ad) ---
req2 = RunReportRequest(
    property=PROP,
    date_ranges=[DateRange(start_date='yesterday', end_date='today')],
    dimensions=[Dimension(name='sessionSource'), Dimension(name='sessionMedium')],
    metrics=[Metric(name='sessions'), Metric(name='engagedSessions'), Metric(name='screenPageViewsPerSession')],
    limit=50,
)
print('\n=== SESSIONS BY SOURCE (yesterday+today) ===')
for r in client.run_report(req2).rows:
    src, med = r.dimension_values[0].value, r.dimension_values[1].value
    s, e, ppv = (m.value for m in r.metric_values)
    print(f'  {int(s):4d} sessions  {int(e):3d} engaged  {float(ppv):.1f} pages/sess   {src} / {med}')

# --- 3) what the AD sessions do: events for facebook/instagram-sourced sessions ---
AD_SOURCES = ('facebook', 'instagram', 'meta', 'fb', 'ig', 'l.facebook.com', 'm.facebook.com', 'lm.facebook.com', 'l.instagram.com')
req3 = RunReportRequest(
    property=PROP,
    date_ranges=[DateRange(start_date='yesterday', end_date='today')],
    dimensions=[Dimension(name='sessionSource'), Dimension(name='eventName')],
    metrics=[Metric(name='eventCount')],
    limit=100000,
)
byev = {}
for r in client.run_report(req3).rows:
    src, ev = r.dimension_values[0].value.lower(), r.dimension_values[1].value
    if any(a in src for a in AD_SOURCES):
        byev[ev] = byev.get(ev, 0) + int(r.metric_values[0].value)
print('\n=== WHAT AD-SOURCED (facebook/instagram/meta) SESSIONS DID (yesterday+today) ===')
if not byev:
    print('  (no sessions attributed to facebook/instagram/meta sources)')
for ev, n in sorted(byev.items(), key=lambda x: -x[1]):
    print(f'  {n:5d}  {ev}')
