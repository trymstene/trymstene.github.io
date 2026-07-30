# -*- coding: utf-8 -*-
"""Every GA4 event the site fires, vs every one Banana Pulse can explain.

    python tools/audit-events.py

Prints what has no tooltip yet, and what Pulse explains but nothing fires any
more. Run it after adding events, so the dashboard never drifts behind the
world again.
NOTE two known false positives, both fine:
  * sticker_order_fail_   — built as a prefix + stage, the four real ones exist
  * pass_mail_login/_attached — chosen by a ternary, so the grep cannot see them
"""
import io, os, re, glob
SITE = r'C:\Web Development\trymstene.com'
SP = os.environ.get('SPDIR', os.path.join(os.path.dirname(os.path.abspath(__file__))))
os.chdir(SITE)

PATS = [
    re.compile(r"""gtag\(\s*['"]event['"]\s*,\s*['"]([a-z0-9_]+)['"]"""),
    re.compile(r"""\btrack\(\s*['"]([a-z0-9_]+)['"]"""),
    re.compile(r"""\bev\(\s*['"]([a-z0-9_]+)['"]"""),
    re.compile(r"""\bpulse\(\s*['"]([a-z0-9_]+)['"]"""),
]
found = {}
files = []
for root in ('src', 'public/js'):
    for ext in ('js', 'astro', 'mjs'):
        files += glob.glob(os.path.join(root, '**', '*.' + ext), recursive=True)
for f in files:
    try:
        txt = io.open(f, encoding='utf-8').read()
    except Exception:
        continue
    for p in PATS:
        for m in p.findall(txt):
            found.setdefault(m, set()).add(f.replace(os.sep, '/'))

pulse = io.open('worker-pulse/src/index.js', encoding='utf-8').read()
i = pulse.index('var EV_EXPLAIN = {')
doc = set(re.findall(r"([a-z0-9_]+)\s*:\s*'", pulse[i:i + pulse[i:].index("' };") + 4]))
fired = set(found)

print('fired in code : %d' % len(fired))
print('explained     : %d' % len(doc))

missing = sorted(fired - doc)
print('\n=== FIRED BUT NOT EXPLAINED (%d) ===' % len(missing))
for m in missing:
    where = sorted(found[m])
    print('  %-26s  %s' % (m, ', '.join(os.path.basename(w) for w in where)[:70]))

stale = sorted(doc - fired)
print('\n=== EXPLAINED BUT NEVER FIRED (%d) ===' % len(stale))
print('  ' + ', '.join(stale))

# which areas the fired events belong to, by the file that fires them
print('\n=== PARK EVENTS FIRED (%d) ===' % len([e for e in fired if any('park' in w for w in found[e])]))
for e in sorted(fired):
    if any('park' in w for w in found[e]):
        print('  %-26s %s' % (e, 'EXPLAINED' if e in doc else '❗ no tooltip'))
io.open(os.path.join(SP, 'fired.txt'), 'w', encoding='utf-8').write(
    '\n'.join('%s\t%s' % (k, ';'.join(sorted(v))) for k, v in sorted(found.items())))
