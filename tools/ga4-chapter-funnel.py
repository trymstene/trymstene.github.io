# -*- coding: utf-8 -*-
"""Chapter one's funnel, step by step (24 Sep 2026).

Every finished step fires an event named for it (world-quest.js advance: quest_step_c1_nib_hello, quest_step_c1_peel_hi, ...), so
totalUsers per name is how many players got past that step. Read it for the last N days (default 14):

    python tools/ga4-chapter-funnel.py [days]

⚠️ PYTHONIOENCODING=utf-8 on Windows. The per-step names exist from 24 Sep 2026; older days have only quest_step.
"""
import json, re, sys
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import RunReportRequest, DateRange, Dimension, Metric, FilterExpression, Filter
from google.oauth2 import service_account

DAYS = int(sys.argv[1]) if len(sys.argv) > 1 else 14
CFG = json.load(open(r'C:\Web Development\trymstene.com\tools\ga4.local.json', encoding='utf-8'))
creds = service_account.Credentials.from_service_account_file(CFG['key_path'], scopes=['https://www.googleapis.com/auth/analytics.readonly'])
client = BetaAnalyticsDataClient(credentials=creds)
PROP = f"properties/{CFG['property_id']}"

# the chapter's steps in their order, read from the code so this never drifts from it
src = open(r'C:\Web Development\trymstene.com\src\lib\world-quest.js', encoding='utf-8').read()
block = src[src.index('const C1_STEPS'):]
block = block[:block.index('\n];')]
steps = re.findall(r"^  \{ id: '(c1_[a-z0-9_]+)'", block, re.M)

req = RunReportRequest(property=PROP, date_ranges=[DateRange(start_date=f'{DAYS}daysAgo', end_date='today')],
    dimensions=[Dimension(name='eventName')], metrics=[Metric(name='totalUsers'), Metric(name='eventCount')],
    dimension_filter=FilterExpression(filter=Filter(field_name='eventName', string_filter=Filter.StringFilter(value='quest_', match_type=Filter.StringFilter.MatchType.BEGINS_WITH))),
    limit=500)
users = {r.dimension_values[0].value: int(r.metric_values[0].value) for r in client.run_report(req).rows}
print(f'Chapter one, last {DAYS} days — players past each step')
print(f"  {users.get('quest_boot', 0):>4}  had the questline running (quest_boot)")
print(f"  {users.get('quest_intro', 0):>4}  watched the CHAPTER I splash (quest_intro)")
prev = None
for s in steps:
    n = users.get('quest_step_' + s, 0)
    drop = '' if prev is None or prev == 0 else f'   ({round(100 * n / prev)}% of the step before)'
    print(f'  {n:>4}  {s}{drop}')
    prev = n
print(f"  {users.get('quest_c1_done', 0):>4}  finished the chapter (quest_c1_done)")
