# -*- coding: utf-8 -*-
"""GA4 custom dimensions, declared here instead of clicked in the admin UI.

⚠️ REGISTRATION DOES NOT BACKFILL. A parameter is only queryable through the
Data API from the moment its dimension exists — everything sent before that is
in GA4 but ungroupable, forever. So when you add a `track()` param that anyone
will ever want to split by, add it HERE in the same commit.

Idempotent: creates what's missing, leaves the rest alone, never deletes
(GA4 caps custom dimensions at 50 and archiving is one-way).

    python tools/ga4-dimensions.py          # show what exists vs what's declared
    python tools/ga4-dimensions.py --apply  # create the missing ones

Needs, both one-time and both Trym's to do:
  1. Admin API on:  console.cloud.google.com/apis/library/analyticsadmin.googleapis.com
  2. the service account (client_email in the key) = EDITOR on the property
"""
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

import google.auth.transport.requests as tr
from google.oauth2 import service_account

try:  # the Windows console is cp1252; sys.exit() writes to stderr, so do both
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception: pass

ROOT = Path(__file__).resolve().parent.parent
CFG = json.loads((ROOT / 'tools' / 'ga4.local.json').read_text(encoding='utf-8'))
KEY = json.loads(Path(CFG['key_path']).read_text(encoding='utf-8'))
API = 'https://analyticsadmin.googleapis.com/v1beta'

# THE DECLARATION. parameter = exactly what track()/gtag sends.
DIMENSIONS = [
    ('from', 'Offer placement',
     'Where a make-it-real card appeared: download_gif / download_meme / '
     'download_png (right after a download) or pass_overview. Splits '
     'offer_shown + offer_click so we can tell which placement earns its keep.'),
    ('ad', 'LED screen ad',
     'Which house ad was tapped on the rave club screen (rave_screen_ad). '
     'ad=sticker is the merch slide that paints the visitor\'s own banana.'),
]


def token():
    c = service_account.Credentials.from_service_account_file(
        CFG['key_path'], scopes=['https://www.googleapis.com/auth/analytics.edit'])
    c.refresh(tr.Request())
    return c.token


def call(path, tok, body=None):
    req = urllib.request.Request(
        f'{API}/{path}',
        data=json.dumps(body).encode() if body is not None else None,
        headers={'Authorization': 'Bearer ' + tok, 'Content-Type': 'application/json'},
        method='POST' if body is not None else 'GET')
    try:
        return json.loads(urllib.request.urlopen(req).read())
    except urllib.error.HTTPError as e:
        err = json.loads(e.read().decode()).get('error', {})
        reason = (err.get('details') or [{}])[0].get('reason', '')
        if reason == 'SERVICE_DISABLED':
            sys.exit('\n✗ The Google Analytics Admin API is not enabled.\n'
                     '  Turn it on here, wait a minute, then re-run:\n'
                     '  https://console.cloud.google.com/apis/library/'
                     'analyticsadmin.googleapis.com?project=' + KEY.get('project_id', ''))
        if err.get('status') == 'PERMISSION_DENIED':
            sys.exit('\n✗ Permission denied. Give %s the EDITOR role on the property\n'
                     '  (GA4 Admin → Property access management).\n  %s'
                     % (KEY.get('client_email', 'the service account'), err.get('message', '')))
        sys.exit('\n✗ %s: %s' % (err.get('status'), err.get('message')))


def main():
    apply_ = '--apply' in sys.argv
    tok = token()
    prop = 'properties/' + str(CFG['property_id'])
    existing = {d['parameterName']: d
                for d in call(prop + '/customDimensions', tok).get('customDimensions', [])}

    print('GA4 property %s — %d custom dimension(s) registered\n' % (CFG['property_id'], len(existing)))
    missing = []
    for param, label, desc in DIMENSIONS:
        if param in existing:
            print('  ✓ %-18s %s' % (param, existing[param].get('displayName', '')))
        else:
            print('  · %-18s MISSING → %s' % (param, label))
            missing.append((param, label, desc))

    if not missing:
        print('\nNothing to do.')
        return
    if not apply_:
        print('\n%d to create. Re-run with --apply.' % len(missing))
        print('⚠️  Data only becomes groupable from creation onward — sooner is strictly better.')
        return

    for param, label, desc in missing:
        call(prop + '/customDimensions', tok,
             {'parameterName': param, 'displayName': label,
              'description': desc[:150], 'scope': 'EVENT'})
        print('  + created %s' % param)
    print('\nDone. Reports lag a few hours; the dimension only covers data from now on.')


if __name__ == '__main__':
    main()
