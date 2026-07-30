# -*- coding: utf-8 -*-
"""Shopify Admin from the command line — the tedious half of adding a product.

    python tools/shopify-product.py scopes            # what this app may do
    python tools/shopify-product.py list              # handles, prices, variant GIDs
    python tools/shopify-product.py show <handle>     # one product in full
    python tools/shopify-product.py create spec.json  # DRY RUN — prints the mutation
    python tools/shopify-product.py create spec.json --yes
    python tools/shopify-product.py publish <handle> --channel Headless --yes

⚠️ CREATE IS DRY-RUN BY DEFAULT and always makes the product a DRAFT. This is a
live store that takes real money; a script should never put a listing in front
of a buyer while nobody is looking. Review it in Shopify, then publish.

⚠️ SHOPIFY IS ONLY HALF OF A NEW PRODUCT. Fulfilment lives in Printful and is
not wired from here — see the new-product checklist. A product created here and
left unlinked will sell something nobody ships.

Credentials: tools/shopify.local.json (gitignored) — client_id + client_secret,
exchanged for a token per run. Needs `write_products` for create/publish; `list`
and `show` work on read-only scopes.
"""
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

try: sys.stdout.reconfigure(encoding='utf-8')  # the Windows console is cp1252
except Exception: pass

ROOT = Path(__file__).resolve().parent.parent
CFG = json.loads((ROOT / 'tools' / 'shopify.local.json').read_text(encoding='utf-8'))
STORE = CFG['store']
VERSION = '2024-10'


def token():
    if CFG.get('token') and not str(CFG['token']).startswith('PASTE'):
        return CFG['token']
    req = urllib.request.Request(
        f'https://{STORE}/admin/oauth/access_token',
        data=json.dumps({'client_id': CFG['client_id'], 'client_secret': CFG['client_secret'],
                         'grant_type': 'client_credentials'}).encode(),
        headers={'Content-Type': 'application/json'})
    return json.loads(urllib.request.urlopen(req).read())['access_token']


def gql(query, variables=None, tok=None):
    req = urllib.request.Request(
        f'https://{STORE}/admin/api/{VERSION}/graphql.json',
        data=json.dumps({'query': query, 'variables': variables or {}}).encode(),
        headers={'Content-Type': 'application/json', 'X-Shopify-Access-Token': tok or token()})
    try:
        out = json.loads(urllib.request.urlopen(req).read())
    except urllib.error.HTTPError as e:
        sys.exit('✗ HTTP %s: %s' % (e.code, e.read().decode()[:300]))
    if out.get('errors'):
        msg = json.dumps(out['errors'])
        if 'access denied' in msg.lower() or 'scope' in msg.lower():
            sys.exit('\n✗ The app lacks the scope for this.\n'
                     '  Shopify admin → Settings → Apps and sales channels → Develop apps\n'
                     '  → your app → Configuration → Admin API integration → add write_products → Save.\n'
                     '  Then re-run (the token is re-exchanged each run, so no other change needed).')
        sys.exit('✗ ' + msg[:500])
    return out['data']


# userErrors are how Shopify reports a rejected-but-well-formed mutation; they
# come back HTTP 200, so an unchecked call looks like success and silently isn't
def ok(payload, key):
    errs = payload.get(key, {}).get('userErrors') or []
    if errs:
        sys.exit('✗ Shopify rejected it:\n  ' + '\n  '.join(
            '%s: %s' % ('.'.join(e.get('field') or []), e['message']) for e in errs))
    return payload[key]


def cmd_scopes():
    d = gql('{ currentAppInstallation { accessScopes { handle } } shop { name } }')
    print(d['shop']['name'])
    have = sorted(s['handle'] for s in d['currentAppInstallation']['accessScopes'])
    for s in have:
        print('  -', s)
    if 'write_products' not in have:
        print('\n⚠️  read-only: create/publish will fail until write_products is added.')


def cmd_list():
    d = gql('''{ products(first: 50, sortKey: TITLE) { edges { node {
      handle title status totalInventory
      variants(first: 20) { edges { node { id title price sku } } } } } } }''')
    for e in d['products']['edges']:
        p = e['node']
        print('\n%s  [%s]\n  %s' % (p['title'], p['status'], p['handle']))
        for v in p['variants']['edges']:
            n = v['node']
            print('    %-26s %8s  %s' % (n['title'][:26], n['price'], n['id']))


def cmd_show(handle):
    d = gql('''query($h:String!){ productByHandle(handle:$h){
      id handle title status descriptionHtml productType tags
      options { name values }
      resourcePublications(first: 20) { edges { node { publication { name } isPublished } } }
      variants(first: 50) { edges { node { id title price sku availableForSale } } } } }''',
            {'h': handle})
    p = d.get('productByHandle')
    if not p:
        sys.exit('✗ no product with handle ' + handle)
    print(json.dumps(p, indent=2)[:4000])


CREATE = '''mutation($input: ProductInput!) {
  productCreate(input: $input) { product { id handle title status } userErrors { field message } } }'''
VARIANTS = '''mutation($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
  productVariantsBulkCreate(productId: $productId, variants: $variants) {
    productVariants { id title price } userErrors { field message } } }'''


def cmd_create(spec_path, go):
    spec = json.loads(Path(spec_path).read_text(encoding='utf-8'))
    inp = {
        'title': spec['title'],
        'status': 'DRAFT',                       # never live from a script
        'descriptionHtml': spec.get('descriptionHtml', ''),
        'productType': spec.get('productType', ''),
        'tags': spec.get('tags', []),
        'vendor': spec.get('vendor', 'Trym Stene'),
    }
    if spec.get('options'):
        inp['productOptions'] = [{'name': o['name'],
                                  'values': [{'name': v} for v in o['values']]}
                                 for o in spec['options']]
    if not go:
        print('DRY RUN — nothing sent. This is the product that would be created:\n')
        print(json.dumps(inp, indent=2))
        print('\nvariants (%d):' % len(spec.get('variants', [])))
        for v in spec.get('variants', []):
            print('  %-30s %s' % (' / '.join(v.get('optionValues', [])) or '(single)', v['price']))
        print('\nRe-run with --yes to create it as a DRAFT.')
        return

    tok = token()
    prod = ok(gql(CREATE, {'input': inp}, tok), 'productCreate')['product']
    print('+ created %s  (%s)  [%s]' % (prod['title'], prod['handle'], prod['status']))

    vs = spec.get('variants', [])
    if vs:
        names = [o['name'] for o in spec.get('options', [])]
        payload = [{'price': str(v['price']),
                    'optionValues': [{'optionName': n, 'name': val}
                                     for n, val in zip(names, v.get('optionValues', []))],
                    **({'inventoryItem': {'sku': v['sku']}} if v.get('sku') else {})}
                   for v in vs]
        made = ok(gql(VARIANTS, {'productId': prod['id'], 'variants': payload}, tok),
                  'productVariantsBulkCreate')['productVariants']
        for m in made:
            print('    %-26s %8s  %s' % (m['title'][:26], m['price'], m['id']))
        print('\nPut the variant GIDs in shared/products.js if this is a builder product.')
    print('\nStill to do by hand: link fulfilment in Printful, then publish.')


PUBLISH = '''mutation($id: ID!, $input: [PublicationInput!]!) {
  publishablePublish(id: $id, input: $input) { userErrors { field message } } }'''


def cmd_publish(handle, channel, go):
    tok = token()
    d = gql('query($h:String!){ productByHandle(handle:$h){ id title status } }', {'h': handle}, tok)
    p = d.get('productByHandle')
    if not p:
        sys.exit('✗ no product with handle ' + handle)
    pubs = gql('{ publications(first: 25) { edges { node { id name } } } }', None, tok)
    hit = next((e['node'] for e in pubs['publications']['edges']
                if e['node']['name'].lower() == channel.lower()), None)
    if not hit:
        sys.exit('✗ no channel named %s. Available: %s' % (
            channel, ', '.join(e['node']['name'] for e in pubs['publications']['edges'])))
    if not go:
        print('DRY RUN — would publish "%s" to %s.\nRe-run with --yes.' % (p['title'], hit['name']))
        return
    ok(gql(PUBLISH, {'id': p['id'], 'input': [{'publicationId': hit['id']}]}, tok),
       'publishablePublish')
    print('+ published %s to %s' % (p['title'], hit['name']))
    print('  (status is still %s — flip it to ACTIVE in Shopify when it is ready to sell)' % p['status'])


def main():
    a = sys.argv[1:]
    if not a:
        sys.exit(__doc__)
    go = '--yes' in a
    cmd = a[0]
    if cmd == 'scopes':
        cmd_scopes()
    elif cmd == 'list':
        cmd_list()
    elif cmd == 'show':
        cmd_show(a[1])
    elif cmd == 'create':
        cmd_create(a[1], go)
    elif cmd == 'publish':
        ch = a[a.index('--channel') + 1] if '--channel' in a else 'Headless'
        cmd_publish(a[1], ch, go)
    else:
        sys.exit(__doc__)


if __name__ == '__main__':
    main()
