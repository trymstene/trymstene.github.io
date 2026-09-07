# -*- coding: utf-8 -*-
"""How many people actually play Banana World, and how many come back — GA4, world pages only."""
import json, sys
from datetime import date, timedelta
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (RunReportRequest, DateRange, Dimension, Metric, FilterExpression, Filter,
                                                FilterExpressionList, CohortSpec, Cohort, CohortsRange, OrderBy)
CFG = json.load(open(r'C:\Web Development\trymstene.com\tools\ga4.local.json', encoding='utf-8'))
from google.oauth2 import service_account
creds = service_account.Credentials.from_service_account_file(CFG['key_path'], scopes=['https://www.googleapis.com/auth/analytics.readonly'])
client = BetaAnalyticsDataClient(credentials=creds)
PROP = 'properties/%s' % CFG['property_id']
WORLD = ['/rave/', '/park/', '/beach/', '/homestead/', '/pass/']


def world_filter():
    return FilterExpression(or_group=FilterExpressionList(expressions=[
        FilterExpression(filter=Filter(field_name='pagePath', string_filter=Filter.StringFilter(match_type=Filter.StringFilter.MatchType.BEGINS_WITH, value=p)))
        for p in WORLD]))


def report(dims, mets, start, end, flt=None, cohort=None, limit=1000, order=None):
    req = RunReportRequest(property=PROP, date_ranges=[DateRange(start_date=start, end_date=end)] if not cohort else [],
                           dimensions=[Dimension(name=d) for d in dims], metrics=[Metric(name=m) for m in mets], limit=limit)
    if flt is not None:
        req.dimension_filter = flt
    if cohort is not None:
        req.cohort_spec = cohort
    if order:
        req.order_bys = order
    resp = client.run_report(req)
    out = []
    for r in resp.rows:
        out.append(([d.value for d in r.dimension_values], [float(m.value) for m in r.metric_values]))
    return out


print('== WORLD PAGES (rave/park/beach/homestead/pass), by ISO week, newest first ==')
rows = report(['isoYearIsoWeek'], ['activeUsers', 'newUsers', 'sessions', 'engagedSessions', 'userEngagementDuration'], '90daysAgo', 'today', world_filter())
rows.sort(key=lambda r: r[0][0], reverse=True)
print('  week      users   new   returning  sessions  engaged  min/user')
for (wk,), (u, n, s, e, dur) in rows[:10]:
    print('  %s  %5d  %4d  %9d  %8d  %7d  %7.1f' % (wk, u, n, u - n, s, e, (dur / 60 / u) if u else 0))

print('\n== WORLD PAGES, new vs returning ==')
for lab, a in (('last 7 days', '7daysAgo'), ('last 28 days', '28daysAgo'), ('last 90 days', '90daysAgo')):
    rows = report(['newVsReturning'], ['activeUsers', 'sessions', 'engagedSessions', 'userEngagementDuration'], a, 'today', world_filter())
    print('  %-13s' % lab, ' | '.join('%s: %d users, %d sessions, %.1f min/user' % (d[0] or '(other)', m[0], m[1], (m[3] / 60 / m[0]) if m[0] else 0) for d, m in rows))

print('\n== WORLD PAGES, daily active users, last 21 days (newest first) ==')
rows = report(['date'], ['activeUsers', 'sessions'], '21daysAgo', 'today', world_filter())
rows.sort(key=lambda r: r[0][0], reverse=True)
print('  ' + '  '.join('%s:%d' % (d[0][4:], int(m[0])) for d, m in rows))

print('\n== WORLD PAGES, per area, last 28 days (users / sessions / engaged / avg min per user) ==')
rows = report(['pagePath'], ['activeUsers', 'sessions', 'engagedSessions', 'userEngagementDuration'], '28daysAgo', 'today', world_filter(), limit=200)
agg = {}
for (p,), (u, s, e, dur) in rows:
    k = '/' + p.strip('/').split('/')[0] + '/'
    a = agg.setdefault(k, [0, 0, 0, 0]); a[0] += u; a[1] += s; a[2] += e; a[3] += dur
for k, (u, s, e, dur) in sorted(agg.items(), key=lambda kv: -kv[1][0]):
    print('  %-12s %5d users  %5d sessions  %5d engaged  %5.1f min/user' % (k, u, s, e, (dur / 60 / u) if u else 0))

print('\n== WEEKLY COHORTS (whole site): of the users first seen that week, how many came back in the following weeks ==')
today = date.today()
monday = today - timedelta(days=today.weekday())
cohorts = []
for i in range(7, 1, -1):
    start = monday - timedelta(days=7 * i)
    cohorts.append(Cohort(name='w-%d' % i, dimension='firstSessionDate', date_range=DateRange(start_date=start.isoformat(), end_date=(start + timedelta(days=6)).isoformat())))
spec = CohortSpec(cohorts=cohorts, cohorts_range=CohortsRange(granularity=CohortsRange.Granularity.WEEKLY, start_offset=0, end_offset=5))
try:
    rows = report(['cohort', 'cohortNthWeek'], ['cohortActiveUsers'], None, None, cohort=spec)
    tri = {}
    for (c, n), (u,) in rows:
        tri.setdefault(c, {})[int(n)] = int(u)
    for c in sorted(tri, key=lambda k: -int(k.split('-')[1])):
        base = tri[c].get(0, 0)
        cells = ['%4d' % tri[c].get(w, 0) for w in range(0, 6)]
        pct = ['%3d%%' % (100 * tri[c].get(w, 0) / base) if base else '   -' for w in range(1, 4)]
        print('  %s  week0 %s  | w1..w5 %s  | back in w1/w2/w3: %s' % (c, cells[0], ' '.join(cells[1:]), ' '.join(pct)))
except Exception as e:
    print('  cohort report failed:', str(e)[:200])

print('\n== WORLD PAGES, returning users by ISO week (users who were NOT new that week) — the "came back" line ==')
rows = report(['isoYearIsoWeek', 'newVsReturning'], ['activeUsers', 'sessions'], '63daysAgo', 'today', world_filter())
wk = {}
for (w, nv), (u, s) in rows:
    wk.setdefault(w, {})[nv] = (int(u), int(s))
for w in sorted(wk, reverse=True)[:9]:
    r = wk[w].get('returning', (0, 0)); n = wk[w].get('new', (0, 0))
    print('  %s  returning %3d users / %3d sessions   new %3d users' % (w, r[0], r[1], n[0]))
