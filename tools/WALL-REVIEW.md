# The Wall — review runbook

The Wall (`/wall/`) is statically built from `src/data/wall.json`. **Nothing a
user submits becomes public without a commit to that file** — the human gate is
git itself. Submissions land in a PRIVATE R2 inbox and stay there until Trym
reviews them.

## The flow

1. Users hit **Submit to the Wall** in the builder or the forge.
2. `worker-share` stores `{kind, params, by, created}` at
   `banana-shares/wall-inbox/<id>.json`. No IPs — `by` is the submitter's
   OPTIONAL signature (≤24 chars). **Read it as carefully as the art**: the
   name publishes on the wall exactly as approved (add `"by"` to the
   wall.json entry, or drop it if the name is off).
3. Review (run from `worker-share/`, uses the existing wrangler login):

   ```
   # list what's pending (if `r2 object list` is unavailable in your wrangler
   # version, ask Claude — the worker also has a GET /wall/inbox endpoint that
   # activates only if you set a WALL_KEY secret: npx wrangler secret put WALL_KEY)
   npx wrangler r2 object get banana-shares/wall-inbox/<id>.json --pipe --remote
   ```

   Preview a banana submission by opening
   `https://trymstene.com/make-a-banana/?<params>`.
   Preview an emoji submission by pasting its `forge:{...}` params into the
   forge via the shelf format (or ask Claude to render it).

4. **Approve** → add an entry to `src/data/wall.json`:

   ```json
   {
     "id": "<inbox-id or a slug>",
     "kind": "banana" | "emoji",
     "params": "<params from the inbox item>",
     "title": "Something warm",
     "note": "One line from the curator.",
     "date": "2026-07"
   }
   ```

   Commit + push → the deploy hangs it on the wall.

5. **Either way, clean the inbox item:**

   ```
   npx wrangler r2 object delete banana-shares/wall-inbox/<id>.json --remote
   ```

## Guardrails already in place

- Origin allowlist + per-IP throttle + 160 KB cap on submissions.
- The `/wall/inbox` HTTP endpoint is FAIL-CLOSED: it 403s unless the
  `WALL_KEY` secret exists (it is deliberately not set).
- Captions in banana params render only on the wall page itself — review them
  before approving (the builder's profanity filter runs at submit time, but
  eyes beat filters).
- Consider an R2 lifecycle rule on `wall-inbox/` (e.g. 90 days) so ignored
  submissions age out on their own.
