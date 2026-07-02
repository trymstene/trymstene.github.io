# Banana sticker fulfilment worker

Cloudflare Worker + R2 that powers "order your custom banana as a sticker":
the builder uploads the print-res PNG here, Shopify takes the money, and the
`orders/paid` webhook creates a **draft** Printful order (Trym approves each
draft in the Printful dashboard before it prints — the human moderation gate).

## One-time setup

1. **Cloudflare dashboard** (already have the account):
   - Enable **R2** (R2 → get started; free tier is plenty).
   - Create a bucket named **`banana-designs`**.
2. **Login + deploy** (from the repo root, together with Claude):
   ```
   npx wrangler login          # opens the browser, approve access
   cd worker
   npx wrangler deploy         # prints the workers.dev URL
   npx wrangler secret put PRINTFUL_TOKEN
   npx wrangler secret put SHOPIFY_WEBHOOK_SECRET
   ```
3. **Printful**: Settings → Stores → API (or Developers → Tokens) → create a
   token scoped to the store. Also pick the sticker product (Kiss-Cut Sticker)
   — we look up the exact `variant_id` via the API and set `PRINTFUL_VARIANT_ID`
   in `wrangler.toml`.
4. **Shopify admin**:
   - Create the **"Custom Banana Sticker"** product (price = Trym's call),
     publish it to the **Headless** sales channel.
   - Settings → Notifications → Webhooks → Create webhook:
     event `Order payment`, format JSON,
     URL `https://<worker>.workers.dev/webhook/shopify`.
     The signing secret shown on that page = `SHOPIFY_WEBHOOK_SECRET`.

## Routes

| Route | What |
|---|---|
| `POST /upload` | print-res PNG from the builder → R2, returns `{ key, url }` (CORS: trymstene.com) |
| `GET /d/<key>` | serves a stored design (Printful fetches print files here) |
| `POST /webhook/shopify` | HMAC-verified `orders/paid` → draft Printful order |

The cart wiring on the site side attaches the design as a `_design_key`
line-item attribute (Storefront API `cartCreate` → `attributes`), which lands
in the webhook's `line_items[].properties`.
