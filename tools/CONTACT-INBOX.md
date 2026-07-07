# The contact inbox — how to read your messages

*Zero-context runbook. If you only remember one thing: your messages live at
a URL that ends in `?token=YOUR-PASSWORD`, and that password is in your
password manager under "banana contact inbox".*

## Reading your messages

Open this in any browser (bookmark it somewhere private):

```
https://banana-contact.trymstene.workers.dev/inbox?token=YOUR-TOKEN-HERE
```

Replace `YOUR-TOKEN-HERE` with the secret you created on 7 Jul 2026
(`wrangler secret put INBOX_TOKEN` — the long random string you saved in
your password manager). Newest messages first, up to the latest 200.
Licensing enquiries are tagged **licensing**; everything else **general**.

⚠️ Anyone with that URL can read your messages. Don't share it, don't put
it in a screenshot.

## How messages get there

Every "drop me a line" / contact link on trymstene.com goes to
**trymstene.com/contact/** — a form that posts to the `banana-contact`
Cloudflare Worker. Messages are **stored, never emailed**: there is no
email-sending setup to break, and your real address appears nowhere in the
site's source code (that was the whole point).

Spam protection, in order of who it stops:
- a hidden honeypot field (bots fill it → message silently discarded)
- max 5 messages per day per sender (per browser+IP fingerprint)
- length caps, and only trymstene.com may talk to the worker

## Forgot / leaked the token?

Make a new one — the old one stops working the moment you set it:

```powershell
cd "F:\Web Development\trymstene.com\worker-contact"
npx wrangler secret put INBOX_TOKEN
```

(You MUST run it from that folder — from anywhere else wrangler says
"Required Worker name missing". Generate a fresh password first with:
`"$([guid]::NewGuid())$([guid]::NewGuid())" -replace '-',''` — then paste
it at the prompt, and update your password manager + bookmark.)

## If you ever want messages in your real email inbox

The worker is ready for it: sign up for an email API (e.g. Resend), add the
key as another secret, and ask Claude to "add forwarding to worker-contact"
— the stored inbox stays as the archive either way.

## The moving parts

| Thing | Where |
| --- | --- |
| The form the internet sees | `trymstene.com/contact/` (`src/pages/contact.astro` + `src/components/ContactForm.astro`) |
| The worker | `worker-contact/` in the repo → `banana-contact` on Cloudflare |
| Your inbox page | `…workers.dev/inbox?token=…` (this doc, section 1) |
| The token | Cloudflare secret `INBOX_TOKEN` + your password manager |
| Deploy after changes | `cd worker-contact` then `npx wrangler deploy` |
