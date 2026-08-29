#!/usr/bin/env node
// 🖼 PUT A BANANA ON THE CHECKOUT.
//
// Polar's checkout page is whatever the PRODUCT carries: its name, its price,
// its description, and its media. With no media it is a wall of dark grey and
// a card form. One image and a description written like the rest of the site
// is the whole difference between "some payment page" and "the banana's".
//
// Uploading is a three-step S3 flow and there is no shortcut:
//   1. POST /v1/files/           → declare the file, get presigned part URLs
//   2. PUT each part to S3       → ⚠️ with the EXACT headers Polar handed back
//   3. POST /v1/files/{id}/uploaded → confirm, with each part's ETag
// then PATCH the product's `medias`.
//
//   POLAR_TOKEN=... node tools/polar-media.mjs <productId> <file.png>
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { createHash } from 'node:crypto';

const BASE = process.env.POLAR_BASE || 'https://api.polar.sh';
const TOKEN = process.env.POLAR_TOKEN;
const [productId, filePath] = process.argv.slice(2);
if (!TOKEN || !productId || !filePath) {
  console.error('usage: POLAR_TOKEN=... node tools/polar-media.mjs <productId> <file>');
  process.exit(1);
}

const api = async (path, opts = {}) => {
  const r = await fetch(BASE + path, {
    ...opts,
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const text = await r.text();
  let body = null;
  try { body = JSON.parse(text); } catch (e) { body = text; }
  if (!r.ok) { console.error(`${path} → ${r.status}`, JSON.stringify(body).slice(0, 400)); process.exit(1); }
  return body;
};

const buf = readFileSync(filePath);
const sha = createHash('sha256').update(buf).digest('base64');
const product = await api('/v1/products/' + productId);

console.log(`· ${basename(filePath)} — ${buf.length} bytes → ${product.name}`);

// 1. declare it
const file = await api('/v1/files/', {
  method: 'POST',
  // ⚠️ NO organization_id. An organization token already IS the organization,
  // and sending it is a 422 — "disallowed when using an organization token".
  body: JSON.stringify({
    name: basename(filePath),
    mime_type: 'image/png',
    size: buf.length,
    checksum_sha256_base64: sha,
    service: 'product_media',
    upload: { parts: [{ number: 1, chunk_start: 0, chunk_end: buf.length, checksum_sha256_base64: sha }] },
  }),
});
console.log(`+ file ${file.id}`);

// 2. ⚠️ the presigned PUT only accepts the headers Polar signed it with —
//    adding or dropping one gives a SignatureDoesNotMatch that reads like an
//    auth problem and is not
const part = file.upload.parts[0];
const put = await fetch(part.url, { method: 'PUT', headers: part.headers || {}, body: buf });
if (!put.ok) { console.error('S3 PUT →', put.status, (await put.text()).slice(0, 300)); process.exit(1); }
const etag = (put.headers.get('etag') || '').replace(/"/g, '');
console.log(`+ uploaded, etag ${etag}`);

// 3. confirm
await api(`/v1/files/${file.id}/uploaded`, {
  method: 'POST',
  body: JSON.stringify({ id: file.upload.id, path: file.path, parts: [{ number: 1, checksum_etag: etag, checksum_sha256_base64: sha }] }),
});
console.log('+ confirmed');

// 4. hang it on the product
const before = await api('/v1/products/' + productId);
const medias = [...new Set([...(before.medias || []).map((m) => m.id), file.id])];
await api('/v1/products/' + productId, { method: 'PATCH', body: JSON.stringify({ medias }) });
console.log(`✅ ${before.name} now carries ${medias.length} image(s)`);
