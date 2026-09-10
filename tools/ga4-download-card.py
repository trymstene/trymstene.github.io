# -*- coding: utf-8 -*-
"""The download card, every era side by side: cards shown vs the card's own button taken (GA4).
Re-read due ~24 Sep 2026 (Trym, 10 Sep: "let's see again in two weeks").  python tools/ga4-download-card.py"""
import json, sys, os
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import RunReportRequest, DateRange, Dimension, Metric, FilterExpression, Filter
from google.oauth2 import service_account
HERE = os.path.dirname(os.path.abspath(__file__))
CFG = json.load(open(os.path.join(HERE, 'ga4.local.json'), encoding='utf-8'))
creds = service_account.Credentials.from_service_account_file(CFG['key_path'], scopes=['https://www.googleapis.com/auth/analytics.readonly'])
c = BetaAnalyticsDataClient(credentials=creds); PROP = 'properties/%s' % CFG['property_id']
EV = ['offer_shown', 'offer_click', 'offer_world', 'offer_discord', 'offer_support', 'offer_pack', 'offer_swap', 'offer_skip',
      'select_item', 'add_to_cart', 'sticker_pdp_view', 'checkout_redirect', 'begin_checkout', 'purchase', 'gif_download']
def counts(start, end):
    req = RunReportRequest(property=PROP, date_ranges=[DateRange(start_date=start, end_date=end)], dimensions=[Dimension(name='eventName')],
        metrics=[Metric(name='eventCount'), Metric(name='activeUsers')], limit=100,
        dimension_filter=FilterExpression(filter=Filter(field_name='eventName', in_list_filter=Filter.InListFilter(values=EV))))
    return {r.dimension_values[0].value: (int(float(r.metric_values[0].value)), int(float(r.metric_values[1].value))) for r in c.run_report(req).rows}
ERAS = [('merch CTA on the card', '2026-07-06', '2026-08-11', ['offer_click']),
        ('world / Discord warm-up', '2026-08-12', '2026-08-26', ['offer_world', 'offer_discord']),
        ('buy-me-a-coffee ask', '2026-08-27', '2026-09-04', ['offer_support']),
        ('THE PACK CARD', '2026-09-05', 'today', ['offer_pack'])]
print('era                        shown(ev/people)   taken(ev/people)   take%   swaps  skip  | pack views · select_item · add_to_cart · checkout   (gif dl)')
for name, a, b, takes in ERAS:
    d = counts(a, b)
    shown = d.get('offer_shown', (0, 0)); tev = sum(d.get(t, (0, 0))[0] for t in takes); tp = sum(d.get(t, (0, 0))[1] for t in takes)
    rate = (100.0 * tev / shown[0]) if shown[0] else 0
    print('%-26s %5d/%-5d          %4d/%-4d        %5.1f%%  %4d  %4d  |  %4d · %3d · %3d · %3d   (%d)' % (name, shown[0], shown[1], tev, tp, rate, d.get('offer_swap', (0,))[0], d.get('offer_skip', (0,))[0],
          d.get('sticker_pdp_view', (0,))[0], d.get('select_item', (0,))[0], d.get('add_to_cart', (0,))[0], d.get('checkout_redirect', (0,))[0] + d.get('begin_checkout', (0,))[0], d.get('gif_download', (0,))[0]))
print('\nthe pack card by day (shown / taken / add_to_cart):')
req = RunReportRequest(property=PROP, date_ranges=[DateRange(start_date='2026-09-05', end_date='today')], dimensions=[Dimension(name='date'), Dimension(name='eventName')], metrics=[Metric(name='eventCount')],
    dimension_filter=FilterExpression(filter=Filter(field_name='eventName', in_list_filter=Filter.InListFilter(values=['offer_shown', 'offer_pack', 'add_to_cart', 'checkout_redirect']))), limit=500)
byday = {}
for r in c.run_report(req).rows: byday.setdefault(r.dimension_values[0].value, {})[r.dimension_values[1].value] = int(float(r.metric_values[0].value))
for dday in sorted(byday): print('  ', dday, byday[dday])
