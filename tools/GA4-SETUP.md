# GA4 data pull — setup (one time, ~10 min)

`tools/ga4.py` pulls fresh numbers straight from the GA4 Data API so we can
build on real insight (and watch the *trend*, not just today's number) without
manual exports or clunky dashboards. This is the one-time setup.

## 1. Google Cloud: a service account + the Data API
1. Go to <https://console.cloud.google.com/> → create a project (or reuse one),
   e.g. `trymstene-analytics`.
2. **APIs & Services → Library** → search **"Google Analytics Data API"** →
   **Enable**.
3. **APIs & Services → Credentials → Create credentials → Service account**.
   Name it something like `ga4-reader`. Skip the optional role steps → **Done**.
4. Open the new service account → **Keys → Add key → Create new key → JSON**.
   A `.json` file downloads. This is a **secret** — treat it like a password.

## 2. Give the service account read access to the GA4 property
1. Copy the service account's email (looks like
   `ga4-reader@trymstene-analytics.iam.gserviceaccount.com`).
2. In **GA4 → Admin → Property Access Management → +** → paste that email →
   role **Viewer** → uncheck "notify by email" → **Add**.

## 3. Find the property id
GA4 → Admin → **Property Settings** → the numeric **Property ID** (e.g.
`123456789`). Not the "G-XXXX" measurement id — the numeric one.

## 4. Wire it up locally (secrets, gitignored)
Put the downloaded key somewhere on disk (outside the repo is fine, or inside —
it's gitignored). Then create `tools/ga4.local.json`:

```json
{
  "property_id": "123456789",
  "key_path": "C:/Users/trym/secrets/trymstene-ga4-key.json"
}
```

`tools/ga4.local.json` and `*service-account*.json` / `*-ga4-key*.json` are all
in `.gitignore` — they will never be committed. (Env vars `GA4_PROPERTY_ID` and
`GOOGLE_APPLICATION_CREDENTIALS` work too, if you prefer.)

## 5. Install the one dependency + run
```bash
pip install google-analytics-data
python tools/ga4.py                 # last 28 days vs the 28 before
python tools/ga4.py --range 7d      # last 7 days vs the 7 before
python tools/ga4.py --range 90d
python tools/ga4.py --events        # + the full event table
```

## Recommended (so the CTA test is readable)
To see **`generator_click` broken down by placement** (e.g. the new
`hub_sticker` block vs the old `hub_cta` / `post-dl-hub`), register `placement`
as a custom dimension:

GA4 → Admin → **Custom definitions → Create custom dimension** →
- Dimension name: `placement`
- Scope: **Event**
- Event parameter: `placement`

Do the same for `design`, `file`, `size` if you want those breakdowns. Custom
dimensions only apply going forward (not retroactively), so the sooner the
better. Until then `ga4.py` shows a note where the placement table would be.

Also worth doing once (from the monetization notes): mark the money-funnel
events (`sticker_preview_confirm`, `checkout_redirect`, `generator_click`) as
**Key events** in GA4 so they count as conversions.
