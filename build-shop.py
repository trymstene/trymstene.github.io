#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build-shop.py — generate the static shop from Shopify data.

Reads shop/products.json (fetched via the Storefront API) and writes:
  - shop/index.html                       (product listing, static cards)
  - shop/<handle>/index.html              (a pre-rendered product page each)
Prints the product URLs to add to sitemap.xml.

Re-run whenever products / prices / variants change:
  1) refetch:  see fetch step in README / the PowerShell one-liner
  2) python build-shop.py
Content is baked into HTML for SEO; only the cart/picker logic is JS.
"""
import json, os, re, html

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(ROOT, "shop", "products.json")
SITE = "https://trymstene.com"

# ---- colour name -> swatch hex (Printful/Gildan common names) -------------
COLOR_HEX = {
    "black": "#1a1a1a", "navy": "#1f2a44", "purple": "#4b2e83", "red": "#b42121",
    "dark chocolate": "#3b2417", "charcoal": "#4d4d4d", "military green": "#4b5320",
    "orange": "#e0592a", "brown savana": "#8b6f47", "carolina blue": "#7ba7d7",
    "gold": "#f2c200", "light blue": "#a9d3e6", "white": "#ffffff", "maroon": "#6e1f2a",
    "sport grey": "#b0b0b0", "ash": "#e8e8e0", "natural": "#efe7d2", "forest": "#22402c",
    "royal": "#2a4b9b", "heather": "#9aa0a6",
}
def color_hex(name):
    return COLOR_HEX.get(name.strip().lower(), "#cccccc")

# ---- size ordering --------------------------------------------------------
SIZE_RANK = {"XXS":-1,"XS":0,"S":1,"M":2,"L":3,"XL":4,"2XL":5,"XXL":5,
             "3XL":6,"XXXL":6,"4XL":7,"5XL":8,"6XL":9}
def size_rank(s):
    return SIZE_RANK.get(s.strip().upper(), 50)

# ---- size guides (inches). cm computed. Verify against Printful. ----------
SIZE_GUIDE_TEE = {
    "note": "Standard Unisex Classic Tee (Gildan 5000) measurements. "
            "Lay a tee flat to compare. Please verify against your Printful size guide.",
    "cols": ["Length", "Chest width (flat)"],
    "rows": {  # size: [length_in, width_in]
        "S": [28, 18], "M": [29, 20], "L": [30, 22], "XL": [31, 24],
        "2XL": [32, 26], "3XL": [33, 28], "4XL": [34, 30], "5XL": [35, 32],
    },
}
def guide_for(title):
    t = title.lower()
    if "classic tee" in t or ("unisex" in t and "tee" in t):
        return SIZE_GUIDE_TEE
    return None

# ---- helpers --------------------------------------------------------------
def plain(text):
    text = re.sub(r"<br\s*/?>", " ", text or "")
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()

def esc(s):
    return html.escape(s or "", quote=True)

def money(amount, cur):
    return "%s %.2f" % (cur, float(amount))

def first_sentence(text, limit=140):
    t = plain(text)
    m = re.split(r"(?<=[.!?])\s", t)
    s = m[0] if m else t
    if len(s) > limit:
        s = s[:limit].rsplit(" ", 1)[0] + "…"
    return s

# ---- shared partials ------------------------------------------------------
NAV = '''  <header class="nav">
    <a class="nav__brand" href="/">TRYM<span>STENE</span></a>
    <button class="nav__toggle" aria-label="Menu" aria-expanded="false">☰</button>
    <nav class="nav__links">
      <div class="nav__group nav__group--banana">
        <a href="/dancing-banana-gif-meme/">Dancing Banana</a>
        <a href="/license-the-dancing-banana/">License</a>
        <a href="/shop/">Merch</a>
      </div>
      <div class="nav__group nav__group--trym">
        <a href="/projects/">Projects</a>
        <a href="/#music">Music</a>
        <a href="/me/">Me</a>
        <a href="/#contact">Contact</a>
      </div>
    </nav>
    <div class="nav__backdrop"></div>
  </header>'''

FOOTER = '''  <footer class="block block--dark">
    <p class="kicker kicker--light">More banana</p>
    <h2>The original, from its creator</h2>
    <p class="lead">
      <a href="/dancing-banana-gif-meme/">Download the GIF &amp; story</a> ·
      <a href="/make-a-banana/">Make your own</a> ·
      <a href="/license-the-dancing-banana/">License it</a> ·
      <a href="https://buymeacoffee.com/trymstene" target="_blank" rel="noopener">☕ Tip</a>
    </p>
    <p class="copyright">© <span id="year">2026</span> Trym Stene · the banana guy \U0001f34c</p>
  </footer>'''

FONTS = '<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Nunito:wght@700;800;900&family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet">'

# ---- model from a product node -------------------------------------------
def model(node):
    handle = node["handle"]
    title = node["title"]
    desc_html = node.get("descriptionHtml") or ""
    images = [e["node"]["url"] for e in node["images"]["edges"]]
    featured = (node.get("featuredImage") or {}).get("url") or (images[0] if images else "")
    opts = {o["name"]: o["values"] for o in node.get("options", [])}

    variants = []
    for e in node["variants"]["edges"]:
        v = e["node"]
        so = {x["name"]: x["value"] for x in v.get("selectedOptions", [])}
        variants.append({
            "id": v["id"],
            "color": so.get("Color", ""),
            "size": so.get("Size", ""),
            "price": float(v["price"]["amount"]),
            "cur": v["price"]["currencyCode"],
            "available": bool(v["availableForSale"]),
            "image": (v.get("image") or {}).get("url") or featured,
        })

    present_colors = [c for c in opts.get("Color", []) if any(v["color"] == c for v in variants)]
    if not present_colors:
        present_colors = sorted({v["color"] for v in variants if v["color"]})
    present_sizes = sorted({v["size"] for v in variants if v["size"]}, key=size_rank)

    color_image = {}
    for c in present_colors:
        for v in variants:
            if v["color"] == c and v["image"]:
                color_image[c] = v["image"]; break
        color_image.setdefault(c, featured)

    vmap = {}
    for v in variants:
        if v["color"] and v["size"]:
            vmap["%s||%s" % (v["color"], v["size"])] = v

    prices = [v["price"] for v in variants] or [0]
    cur = variants[0]["cur"] if variants else "NOK"

    return {
        "handle": handle, "title": title, "desc_html": desc_html,
        "featured": featured, "colors": present_colors, "sizes": present_sizes,
        "color_image": color_image, "vmap": vmap, "variants": variants,
        "images": images, "cur": cur, "pmin": min(prices), "pmax": max(prices),
        "url": "%s/shop/%s/" % (SITE, handle),
    }

# ---- size guide table -----------------------------------------------------
def size_table_html(m):
    g = guide_for(m["title"])
    if not g:
        return ('<p>Fit runs true to size. For exact measurements, '
                '<a href="/#contact">drop me a message</a> and I\'ll send the size chart.</p>')
    rows = [s for s in m["sizes"] if s in g["rows"]] or list(g["rows"].keys())
    head = "".join("<th>%s</th>" % esc(c) for c in g["cols"])
    body = []
    for s in rows:
        vals = g["rows"][s]
        cells = ["<td><b>%s</b></td>" % esc(s)]
        for inch in vals:
            cm = round(inch * 2.54)
            cells.append('<td><span data-unit="in">%g"</span>'
                         '<span data-unit="cm" style="display:none">%d cm</span></td>' % (inch, cm))
        body.append("<tr>%s</tr>" % "".join(cells))
    return (
        '<div class="size-toggle" role="group" aria-label="Units">'
        '<button data-unit="in" aria-pressed="true">inches</button>'
        '<button data-unit="cm" aria-pressed="false">cm</button></div>'
        '<table class="size-table"><caption>%s</caption>'
        '<thead><tr><th>Size</th>%s</tr></thead><tbody>%s</tbody></table>'
        % (esc(g["note"]), head, "".join(body))
    )

# ---- JSON-LD --------------------------------------------------------------
def jsonld(m):
    product = {
        "@context": "https://schema.org/", "@type": "Product",
        "name": m["title"], "image": m["images"][:10],
        "description": first_sentence(m["desc_html"], 300),
        "brand": {"@type": "Brand", "name": "Dancing Banana Official"},
        "sku": m["handle"],
        "offers": {
            "@type": "AggregateOffer", "priceCurrency": m["cur"],
            "lowPrice": ("%.2f" % m["pmin"]), "highPrice": ("%.2f" % m["pmax"]),
            "offerCount": len(m["variants"]),
            "availability": "https://schema.org/InStock",
            "url": m["url"], "priceValidUntil": "2027-12-31",
        },
    }
    crumbs = {
        "@context": "https://schema.org/", "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/"},
            {"@type": "ListItem", "position": 2, "name": "Shop", "item": SITE + "/shop/"},
            {"@type": "ListItem", "position": 3, "name": m["title"], "item": m["url"]},
        ],
    }
    return ('<script type="application/ld+json">%s</script>\n'
            '<script type="application/ld+json">%s</script>'
            % (json.dumps(product, ensure_ascii=False), json.dumps(crumbs, ensure_ascii=False)))

# ---- PDP ------------------------------------------------------------------
def render_pdp(m):
    desc_meta = "%s From %s, made on demand and shipped worldwide." % (
        first_sentence(m["desc_html"], 100), money(m["pmin"], m["cur"]))
    title_tag = "%s — official Dancing Banana merch | Trym Stene" % m["title"]

    swatches = "".join(
        '<button class="pdp-swatch" data-color="%s" title="%s" aria-label="%s" style="background:%s"></button>'
        % (esc(c), esc(c), esc(c), color_hex(c)) for c in m["colors"])
    thumbs = "".join(
        '<button class="pdp-thumb" data-color="%s" aria-label="%s">'
        '<img src="%s" alt="%s – %s" loading="lazy"></button>'
        % (esc(c), esc(c), esc(m["color_image"][c]), esc(m["title"]), esc(c)) for c in m["colors"])
    sizes = "".join('<button class="pdp-size" data-size="%s">%s</button>' % (esc(s), esc(s)) for s in m["sizes"])

    island = {
        "title": m["title"], "currency": m["cur"], "priceMin": m["pmin"],
        "colorImage": m["color_image"],
        "variants": {k: {"id": v["id"], "price": v["price"], "available": v["available"]}
                     for k, v in m["vmap"].items()},
    }
    island_json = json.dumps(island, ensure_ascii=False)

    return """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="canonical" href="{url}">
  <title>{title_tag}</title>
  <meta name="description" content="{desc_meta}">
  <meta name="robots" content="index,follow,max-image-preview:large">

  <meta property="og:type" content="product">
  <meta property="og:title" content="{og_title}">
  <meta property="og:description" content="{desc_meta}">
  <meta property="og:url" content="{url}">
  <meta property="og:image" content="{featured}">
  <meta property="product:price:amount" content="{pmin_plain}">
  <meta property="product:price:currency" content="{cur}">
  <meta name="twitter:card" content="summary_large_image">

  {fonts}
  <link rel="stylesheet" href="/css/styles.css">
  <link rel="stylesheet" href="/css/shop.css">
  {jsonld}
</head>
<body>

{nav}

  <nav class="crumbs" aria-label="Breadcrumb">
    <a href="/">Home</a><span>›</span><a href="/shop/">Shop</a><span>›</span><b>{title}</b>
  </nav>

  <main class="pdp" data-pdp>
    <div class="pdp__gallery">
      <img class="pdp__main" src="{main_img}" alt="{title}" width="800" height="800">
      <div class="pdp__thumbs">{thumbs}</div>
    </div>

    <div class="pdp__info">
      <h1>{title}</h1>
      <p class="pdp__tag">{tagline}</p>
      <p class="pdp__price"><small>from</small> {pmin_money}</p>
      <p class="pdp__note">Tax included where applicable · shipping calculated at checkout</p>

      <div class="pdp-field">
        <div class="pdp-field__label">Colour <span>— {ncolors} options</span></div>
        <div class="pdp-swatches">{swatches}</div>
      </div>

      <div class="pdp-field">
        <div class="pdp-field__label">Size <span>— <a href="#size-guide">size guide</a></span></div>
        <div class="pdp-sizes">{sizes}</div>
      </div>

      <button class="btn btn--dark pdp-buy" disabled>Select a size</button>
      <p class="pdp-stock"></p>

      <ul class="pdp-trust">
        <li>Printed &amp; shipped on demand — made just for you</li>
        <li>Ships worldwide</li>
        <li>Secure checkout via Shopify</li>
        <li>From the creator of the original 1999 dancing banana</li>
      </ul>
    </div>
  </main>

  <section class="pdp-details">
    <details open>
      <summary>Product details &amp; materials</summary>
      <div class="pdp-details__body">{desc_html}</div>
    </details>
    <details id="size-guide">
      <summary>Size guide &amp; measurements</summary>
      <div class="pdp-details__body">{size_table}</div>
    </details>
  </section>

  <section class="block">
    <p class="kicker">Keep going</p>
    <h2>More banana</h2>
    <p class="lead">
      <a href="/shop/">← All merch</a> ·
      <a href="/make-a-banana/">\U0001f3a8 Make your own banana</a> ·
      <a href="/dancing-banana-gif-meme/">The story &amp; free GIF</a>
    </p>
  </section>

{footer}

  <script id="pdp-data" type="application/json">{island}</script>
  <script src="/js/main.js"></script>
  <script src="/js/shop.js"></script>
</body>
</html>
""".format(
        url=m["url"], title_tag=esc(title_tag), desc_meta=esc(desc_meta),
        og_title=esc(m["title"]), featured=esc(m["featured"]),
        pmin_plain=("%.2f" % m["pmin"]), cur=esc(m["cur"]), fonts=FONTS,
        jsonld=jsonld(m), nav=NAV, title=esc(m["title"]),
        main_img=esc(m["color_image"].get(m["colors"][0], m["featured"]) if m["colors"] else m["featured"]),
        thumbs=thumbs, tagline=esc(first_sentence(m["desc_html"], 120)),
        pmin_money=money(m["pmin"], m["cur"]), ncolors=len(m["colors"]),
        swatches=swatches, sizes=sizes, desc_html=m["desc_html"],
        size_table=size_table_html(m), footer=FOOTER, island=island_json,
    )

# ---- PLP ------------------------------------------------------------------
def render_plp(models):
    cards = []
    for m in models:
        cards.append(
            '<a class="project-card" href="/shop/{h}/">'
            '<img class="shop-card__img" src="{img}" alt="{t}" loading="lazy">'
            '<div class="project-card__body"><h3>{t}</h3>'
            '<p class="shop-card__price"><span class="shop-card__from">from</span>{p}</p>'
            '</div></a>'.format(h=esc(m["handle"]), img=esc(m["featured"]),
                                t=esc(m["title"]), p=money(m["pmin"], m["cur"])))
    cards_html = "\n      ".join(cards) if cards else \
        '<p class="shop-status">The shop is being stocked — check back soon! \U0001f34c</p>'

    return """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="canonical" href="{site}/shop/">
  <title>Shop — Dancing Banana Merch | Trym Stene</title>
  <meta name="description" content="Official Dancing Banana merch — tees, stickers and more, from the creator of the meme. Printed on demand, shipped worldwide.">
  <meta name="robots" content="index,follow,max-image-preview:large">

  <meta property="og:type" content="website">
  <meta property="og:title" content="Shop — Dancing Banana Merch">
  <meta property="og:description" content="Official Dancing Banana merch from the creator of the meme.">
  <meta property="og:url" content="{site}/shop/">
  <meta property="og:image" content="{site}/assets/dancing-banana-gif.gif">
  <meta name="twitter:card" content="summary_large_image">

  {fonts}
  <link rel="stylesheet" href="/css/styles.css">
  <link rel="stylesheet" href="/css/shop.css">
</head>
<body>

{nav}

  <section class="hero">
    <p class="kicker">Official merch</p>
    <h1 class="hero__title">dancing banana<br>shop</h1>
    <p class="hero__tag" style="text-transform:none;font-weight:500;">Wear the banana. The original meme, on stuff you can actually own.</p>
  </section>

  <section class="block block--yellow">
    <p class="kicker">The goods</p>
    <h2>Dancing Banana merch</h2>
    <p class="lead">Printed on demand, shipped worldwide. Checkout is secured by Shopify.</p>
    <div class="cards">
      {cards}
    </div>
  </section>

  <section class="block">
    <p class="kicker">Or design your own</p>
    <h2>Make a custom banana</h2>
    <p class="lead">Add shades, a hat, a caption — then (soon) put <em>your</em> banana on a sticker.</p>
    <a class="btn btn--dark" href="/make-a-banana/">\U0001f3a8 Make your own dancing banana →</a>
  </section>

{footer}

  <script src="/js/main.js"></script>
</body>
</html>
""".format(site=SITE, fonts=FONTS, nav=NAV, cards=cards_html, footer=FOOTER)

# ---- main -----------------------------------------------------------------
def main():
    with open(DATA_FILE, "r", encoding="utf-8-sig") as f:
        data = json.load(f)
    nodes = [e["node"] for e in data["data"]["products"]["edges"]]
    models = [model(n) for n in nodes]

    # product pages
    for m in models:
        out_dir = os.path.join(ROOT, "shop", m["handle"])
        os.makedirs(out_dir, exist_ok=True)
        with open(os.path.join(out_dir, "index.html"), "w", encoding="utf-8") as f:
            f.write(render_pdp(m))
        print("wrote shop/%s/index.html  (%d colours x %d sizes)" % (m["handle"], len(m["colors"]), len(m["sizes"])))

    # listing page
    with open(os.path.join(ROOT, "shop", "index.html"), "w", encoding="utf-8") as f:
        f.write(render_plp(models))
    print("wrote shop/index.html  (%d products)" % len(models))

    print("\nsitemap URLs:")
    print("  %s/shop/" % SITE)
    for m in models:
        print("  %s" % m["url"])

if __name__ == "__main__":
    main()
