/* ============================================================
   shop.js — product detail page interactivity
   Content is pre-rendered in HTML (SEO); this only wires the
   colour/size pickers, gallery and Shopify checkout.
   ============================================================ */
(function () {
  var root = document.querySelector('[data-pdp]');
  if (!root) return;

  var SHOP = 'officialdancingbanana.myshopify.com';
  var TOKEN = '1032480366b6bf67760ba73ace4fe0f8';
  var API = 'https://' + SHOP + '/api/2024-10/graphql.json';

  var dataEl = document.getElementById('pdp-data');
  var DATA;
  try { DATA = JSON.parse(dataEl.textContent); } catch (e) { return; }
  // DATA = { currency, priceMin, colorImage:{color:url}, variants:{ "color||size": {id,price,available} } }

  var mainImg = root.querySelector('.pdp__main');
  var priceEl = root.querySelector('.pdp__price');
  var stockEl = root.querySelector('.pdp-stock');
  var buyBtn = root.querySelector('.pdp-buy');
  var swatches = [].slice.call(root.querySelectorAll('.pdp-swatch'));
  var thumbs = [].slice.call(root.querySelectorAll('.pdp-thumb'));
  var sizeBtns = [].slice.call(root.querySelectorAll('.pdp-size'));

  // a product may have colours+sizes (tee), only sizes (poster), or a single
  // variant (mug/tote). Missing dimension = '' so the variant key still matches.
  var hasColors = swatches.length > 0;
  var hasSizes = sizeBtns.length > 0;
  var selColor = hasColors ? null : '';
  var selSize = hasSizes ? null : '';

  function money(amount) {
    var n = parseFloat(amount);
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: DATA.currency, maximumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n); }
    catch (e) { return n + ' ' + DATA.currency; }
  }
  function key(c, s) { return c + '||' + s; }
  function variantFor(c, s) { return DATA.variants[key(c, s)]; }

  function markColour(c) {
    swatches.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.color === c)); });
    thumbs.forEach(function (t) { t.setAttribute('aria-current', String(t.dataset.color === c)); });
  }
  function markSize(s) {
    sizeBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.size === s)); });
  }

  // enable/disable size buttons for the chosen colour
  function refreshSizes() {
    sizeBtns.forEach(function (b) {
      var v = variantFor(selColor, b.dataset.size);
      var ok = v && v.available;
      b.disabled = !ok;
    });
  }

  function update() {
    var needColor = hasColors && selColor === null;
    var needSize = hasSizes && selSize === null;
    var v = (!needColor && !needSize) ? variantFor(selColor, selSize) : null;
    if (needColor || needSize) {
      priceEl.innerHTML = '<small>from</small> ' + money(DATA.priceMin);
      stockEl.textContent = '';
      stockEl.className = 'pdp-stock';
      buyBtn.disabled = true;
      buyBtn.textContent = needSize ? 'Select a size' : 'Select a colour';
    } else if (v && v.available) {
      priceEl.textContent = money(v.price);
      stockEl.textContent = 'In stock · printed & shipped on demand';
      stockEl.className = 'pdp-stock pdp-stock--ok';
      buyBtn.disabled = false;
      buyBtn.textContent = 'Buy →';
    } else {
      priceEl.textContent = v ? money(v.price) : money(DATA.priceMin);
      stockEl.textContent = 'Sold out' + (hasColors || hasSizes ? ' in this option' : '');
      stockEl.className = 'pdp-stock pdp-stock--no';
      buyBtn.disabled = true;
      buyBtn.textContent = 'Unavailable';
    }
  }

  function pickColour(c) {
    selColor = c;
    markColour(c);
    if (DATA.colorImage[c]) mainImg.src = DATA.colorImage[c];
    refreshSizes();
    // drop a size selection that isn't available in the new colour
    if (selSize) {
      var v = variantFor(c, selSize);
      if (!v || !v.available) { selSize = null; markSize(null); }
    }
    update();
  }
  function pickSize(s) {
    var v = variantFor(selColor, s);
    if (!v || !v.available) return;
    selSize = s;
    markSize(s);
    update();
  }

  swatches.forEach(function (b) { b.addEventListener('click', function () { pickColour(b.dataset.color); }); });
  thumbs.forEach(function (t) { t.addEventListener('click', function () { pickColour(t.dataset.color); }); });
  sizeBtns.forEach(function (b) { b.addEventListener('click', function () { pickSize(b.dataset.size); }); });

  // checkout
  function gql(query, variables) {
    return fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': TOKEN },
      body: JSON.stringify({ query: query, variables: variables || {} })
    }).then(function (r) { return r.json(); });
  }
  var CART_M = 'mutation cartCreate($id: ID!) { cartCreate(input: { lines: [{ merchandiseId: $id, quantity: 1 }] }) { cart { checkoutUrl } userErrors { message } } }';

  buyBtn.addEventListener('click', function () {
    var v = variantFor(selColor, selSize);
    if (!v || !v.available) return;
    buyBtn.disabled = true;
    var orig = buyBtn.textContent; buyBtn.textContent = 'Opening checkout…';
    gql(CART_M, { id: v.id }).then(function (res) {
      var url = res && res.data && res.data.cartCreate && res.data.cartCreate.cart && res.data.cartCreate.cart.checkoutUrl;
      if (url) {
        if (window.gtag) gtag('event', 'begin_checkout', { items: [{ item_name: DATA.title, item_variant: selColor + ' / ' + selSize }] });
        window.location.href = url;
      } else {
        buyBtn.disabled = false; buyBtn.textContent = orig;
        alert('Sorry — could not start checkout. Try again in a sec.');
      }
    }).catch(function () { buyBtn.disabled = false; buyBtn.textContent = orig; alert('Network hiccup — try again.'); });
  });

  // init: pick the first colour (nudges an explicit size choice); products with
  // no colours still need their sizes enabled + the buy state initialised.
  if (hasColors) {
    var firstColour = (swatches[0] && swatches[0].dataset.color) || (thumbs[0] && thumbs[0].dataset.color);
    if (firstColour) pickColour(firstColour);
  } else {
    refreshSizes();
    update();
  }

  // unit toggle for the size table (in / cm)
  var toggle = document.querySelector('.size-toggle');
  if (toggle) {
    toggle.addEventListener('click', function (e) {
      var btn = e.target.closest('button'); if (!btn) return;
      var unit = btn.dataset.unit;
      toggle.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
      document.querySelectorAll('.size-table [data-unit]').forEach(function (c) {
        c.style.display = (c.dataset.unit === unit) ? '' : 'none';
      });
    });
  }
})();
