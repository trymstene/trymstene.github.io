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
// member store and deliver the same grant by the same email hash.
export const RAIL = 'polar';

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
// ☕ one-off support goes through OUR OWN checkout now (worker /pay/tip) —
// Trym, 29 Aug: "more consistent and probably easier to remove uneccessary
// middle steps for CRO". Ko-fi survives only as the worker's outage fallback,
// where its URL lives; nothing on the site links to it any more.

// 🚪 THE WAY OUT — Polar's own customer portal: the supporter enters the email
// they paid with, gets a one-time code, and can cancel there themselves. It must
// be easy to find and never behind a tab; a subscription you cannot leave is a
// trap, and hiding the exit is the oldest dark pattern there is.
export const MANAGE = {
  polar: 'https://polar.sh/trym-stene/portal',
  kofi: 'https://ko-fi.com/manage/supportreceived',   // Ko-fi members manage from their own Ko-fi account
}[RAIL] || 'https://polar.sh/trym-stene/portal';
