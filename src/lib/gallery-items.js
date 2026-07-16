// THE gallery item loader — every surface that reads Trym's editorial items
// (hub, tag/category pages, community route's tag counts, sitemap) goes
// through this so the EDITORIAL OVERRIDES merge happens in exactly one place.
//
// gallery.json (git) is the BASE: images, ids/URLs, captions, descriptions.
// The Banana Mail live desk writes title/tag edits to the share worker
// (gallery-live/editorial-overrides.json) so Trym can administrate metadata
// from the browser; the build pulls them here. Worker down at build = base
// values only (never a broken build). Consolidating overrides back into
// gallery.json is a future tools/ script if divergence ever gets confusing.
import base from '../data/gallery.json';

const WORKER = 'https://banana-share.trymstene.workers.dev';

export async function loadGalleryItems() {
  let ov = {};
  try {
    const res = await fetch(WORKER + '/gallery/overrides');
    if (res.ok) ov = await res.json();
  } catch (e) { /* base values stand */ }
  return base.map((i) => {
    const o = ov[i.id];
    if (!o) return i;
    return {
      ...i,
      ...(o.title ? { title: o.title } : {}),
      ...(Array.isArray(o.tags) ? { tags: o.tags } : {}),
    };
  });
}
