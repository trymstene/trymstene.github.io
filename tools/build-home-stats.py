# -*- coding: utf-8 -*-
"""build-home-stats.py — the big numbers on the homepage ticker (26 Sep 2026).

Trym: "look into other interesting stats from the park aswell or homestead, or rave, the bay AND the town - see
through all and pick the best ones based on popularity". The live half of the ticker reads what the world's workers
already publish (who is in each area right now, the town's day, the Wheel of Peel's pot); the BIG numbers — every
hole ever dug at the bay, every shell, everyone who ever danced at the rave — only exist in GA4, which a page cannot
ask. So this asks GA4 once and writes them into src/data/home-stats.json, baked into the page at build.

⚠️ ALL-TIME totals, ROUNDED DOWN, printed with a "+": a count that only grows, read low, stays true however long it
sits between runs. The DEPLOY runs this every day (.github/workflows/deploy.yml, the GA4_SERVICE_ACCOUNT secret: the
service account's key JSON; the property is worker-pulse/wrangler.toml's PROPERTY_ID), so the live page is at most a
day old; the committed JSON is only the fallback. Locally it reads tools/ga4.local.json as every GA4 tool does.
⚠️ NEVER LOWER: a number is kept at the committed value if GA4 answers with less (a missing row, a quota hiccup), so
the front page can never print "0+" or step backwards.
⚠️ GA4 counts only what consented visitors did (Consent Mode), so every number here is a floor — the "+" is honest.
⚠️ COUNT WHAT THE LINE SAYS. rave_join fires on every reconnect, so "danced at the rave" reads the event's USERS
(rave_join_users), never its count. park_trash, park_egg and park_bird fire once per visit, so their counts are
floors of the pieces, eggs and birds — true with a "+", never "every piece".

The lines are src/data/copy/home-hero.json `ticker.stats` (key = a key of `n` below). Picked by popularity, 26 Sep:
the rave has the most people by far (6 680 dancers), the bay the most doing (24 437 digs), the homestead the most
visitors after the rave (728), the park and the town the most repeated chores.
"""
import datetime
import json
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import RunReportRequest, DateRange, Dimension, Metric, FilterExpression, Filter

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(SITE, 'src', 'data', 'home-stats.json')
FROM = '2026-06-01'   # before the first world event existed: the whole history
# counted as EVENTS (every dig, every shell)
EVENTS = ['beach_dig', 'beach_shell', 'beach_fish_catch', 'beach_treasure', 'rave_gold', 'park_trash', 'park_egg',
          'park_bird', 'park_plant', 'town_fix']
# counted as PEOPLE (key <event>_users): how many bananas ever did it
USERS = ['rave_join', 'homestead_open']


def floor2(n):
    """read it low: two significant figures, rounded DOWN (17 036 → 17 000, 795 → 790, 86 → 86)"""
    if n < 100:
        return n
    p = 10 ** (len(str(n)) - 2)
    return n // p * p


def credentials():
    """(credentials, property id): the CI secret when it is set, else tools/ga4.local.json"""
    from google.oauth2 import service_account
    scopes = ['https://www.googleapis.com/auth/analytics.readonly']
    key = os.environ.get('GA4_SERVICE_ACCOUNT', '').strip()
    if key:
        toml = open(os.path.join(SITE, 'worker-pulse', 'wrangler.toml'), encoding='utf-8').read()
        prop = re.search(r'^PROPERTY_ID\s*=\s*"(\d+)"', toml, re.M).group(1)
        return service_account.Credentials.from_service_account_info(json.loads(key), scopes=scopes), prop
    cfg = json.load(open(os.path.join(SITE, 'tools', 'ga4.local.json'), encoding='utf-8'))
    return service_account.Credentials.from_service_account_file(cfg['key_path'], scopes=scopes), cfg['property_id']


if __name__ == '__main__':
    creds, prop = credentials()
    client = BetaAnalyticsDataClient(credentials=creds)
    req = RunReportRequest(
        property='properties/%s' % prop,
        date_ranges=[DateRange(start_date=FROM, end_date='today')],
        dimensions=[Dimension(name='eventName')],
        metrics=[Metric(name='eventCount'), Metric(name='totalUsers')],
        dimension_filter=FilterExpression(filter=Filter(field_name='eventName', in_list_filter=Filter.InListFilter(values=EVENTS + USERS))),
        limit=100,
    )
    rows = {r.dimension_values[0].value: (int(r.metric_values[0].value), int(r.metric_values[1].value)) for r in client.run_report(req).rows}
    raw = {k: rows.get(k, (0, 0))[0] for k in EVENTS}
    raw.update({k + '_users': rows.get(k, (0, 0))[1] for k in USERS})
    # never lower than what is committed: an all-time count only grows, so less means GA4 answered short
    try:
        old = json.load(open(OUT, encoding='utf-8')).get('raw', {})
    except (OSError, ValueError):
        old = {}
    for k in raw:
        if raw[k] < old.get(k, 0):
            print('%-22s GA4 said %d, below the committed %d: kept' % (k, raw[k], old[k]))
            raw[k] = old[k]
    out = {'asOf': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%MZ'), 'from': FROM, 'n': {k: floor2(v) for k, v in raw.items()}, 'raw': raw}
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=2)
        f.write('\n')
    for k, v in raw.items():
        print('%-22s %8d  → %d+' % (k, v, out['n'][k]))
    print('wrote', os.path.relpath(OUT, SITE))
