// 💳 WHICH RAIL TAKES THE MONEY — one switch, flipped by hand.
//
// 'kofi'  — LIVE. Ko-fi has no checkout API (webhooks out, nothing in) and its
//           internal mint endpoint is Cloudflare bot-walled, so the buyer must
//           take one hop to ko-fi.com and pick the tier again there.
// 'polar' — PROTOTYPE. Polar is a merchant of record with a real API, so our
//           own button mints the checkout server-side and hands the buyer
//           straight to payment: no middle step, no tier list, no hunting.
//           Dark until worker-pass holds POLAR_TOKEN + POLAR_T1/T2/T3 and the
//           webhook secret — without them /pay/checkout bounces back here with
//           ?pay=unconfigured rather than failing in front of somebody's card.
//
// ⚠️ Flipping this changes NOTHING about the hats: both rails write the same
// member store and deliver the same grant by the same email hash. Ko-fi keeps
// the tip jar either way — one-off support is a Ko-fi strength and needs no API.
export const RAIL = 'kofi';

const WORKER = 'https://banana-pass.trymstene.workers.dev';
export const RAILS = {
  kofi: {
    join: () => 'https://ko-fi.com/trymstene/tiers',
    label: 'Join on Ko-fi →',
    newTab: true,      // their page, so keep the wall open behind it
  },
  polar: {
    join: (t) => WORKER + '/pay/checkout?t=' + t,
    label: 'Join →',
    newTab: false,     // our own redirect into checkout — same tab is the point
  },
};
export const PAY = RAILS[RAIL] || RAILS.kofi;
export const KOFI_TIP = 'https://ko-fi.com/trymstene';
