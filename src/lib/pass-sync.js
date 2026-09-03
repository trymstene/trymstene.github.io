// Pass sync ceremonies — "Save your pass" / "I have a pass" (WebAuthn).
// Biometrics appear ONLY here, when linking a device; day-to-day sync rides
// the device token this module stores (see pushNow in banana-pass.js).
// CLIENT-ONLY; loaded on /pass/ only.
import { PASS_API, collectBlob, applyBlob, passPush, passNoticeAdd, walletKeep, anonInFlight } from './banana-pass.js';

const LINK_KEY = 'pass-link'; // { credId, token }
const GID_KEY = 'world-gid';  // 🪪 ownership (mirrors banana-pass.js), never the connection sid
const WT_KEY = 'world-wt';    // 🪪 …and its proof (the world token)
const PULL_KEY = 'pass-pull-at';
export { PASS_API, collectBlob, applyBlob };

export const passkeysSupported = () =>
  !!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.create);

export function linked() {
  try { return JSON.parse(localStorage.getItem(LINK_KEY) || 'null'); } catch (e) { return null; }
}
// 🫧 an ANONYMOUS pass (minted by banana-pass ensureAnon, credId 'a:…') is a
// link for sync purposes and NOT a login for the UI: nothing about it survives
// a wipe, so the page must keep asking for the email. loggedIn() is what the
// pass page shows; linked() is what the wire uses.
export const isAnon = (l) => !!(l && String(l.credId || '').startsWith('a:'));
export function loggedIn() {
  const l = linked();
  return l && !isAnon(l) ? l : null;
}

// ⚠️ RETURNS FALSE WHEN THE CREDENTIAL DID NOT LAND. A blocked localStorage
// (private mode, an embedded frame) used to be swallowed here, so every
// entrance reported a cheerful success while the device stored nothing — and
// a magic link is single-use, so the player was left with no way back in and
// no idea why. Callers must surface it.
function setLink(credId, token) {
  let ok = false;
  try { localStorage.setItem(LINK_KEY, JSON.stringify({ credId, token })); ok = true; } catch (e) {}
  // ⏱ a fresh login syncs NOW — the ambient pull's 10-minute throttle would
  // otherwise leave worldOwner() on the connection sid for up to ten minutes
  try { localStorage.removeItem(PULL_KEY); } catch (e) {}
  return ok;
}
const NO_STORE = 'This browser wouldn’t remember the login — private browsing? Try again in a normal window.';
const NO_STORE_MAIL = 'This browser wouldn’t remember the login — private browsing? Open a normal window and send yourself a fresh link (this one is spent).';

// 🪪 THE WORLD ID rides on every /push and /pull answer — and on nothing else.
// Keep it or worldOwner() falls back to the per-browser sid and the garden,
// the homestead and the compost debts stop being this player's.
function keepGid(d) {
  const gid = d && typeof d.gid === 'string' && /^[a-f0-9]{8,32}$/.test(d.gid) ? d.gid : '';
  if (gid) { try { localStorage.setItem(GID_KEY, gid); } catch (e) {} }
  // 🪪 …with its proof (mirror of banana-pass.js keepGid — change both)
  try {
    if (d && typeof d.worldToken === 'string' && /^[a-f0-9]{16}\.\d+\.[a-f0-9,]*\.[a-f0-9]{64}$/.test(d.worldToken)) {
      localStorage.setItem(WT_KEY, d.worldToken);
    }
  } catch (e) {}
  // 🎩 the signed member token rides the same responses (mirror of
  // banana-pass.js keepGid — change both): rooms present it so other
  // players get to SEE the supporter hat. Absent = leave the stored one
  // (it expires on its own; a lapsed grant just stops renewing it).
  try {
    if (d && typeof d.memberToken === 'string' && /^sup-t[123]\.\d+\.[a-f0-9]{64}$/.test(d.memberToken)) {
      localStorage.setItem('bb-mtok', d.memberToken);
    }
  } catch (e) {}
  walletKeep(d);   // 💰 the server wallet lands with a login too
  return gid;
}

// ⬆️ hand this device's world UP right now. The debounced push in
// banana-pass.js only fires on the next pass write, and /link/finish accepts
// no blob at all, so a joining device contributes nothing without this.
async function pushBlob(credId, token) {
  try {
    const r = await fetch(PASS_API + '/push', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credId, token, blob: collectBlob() }),
    });
    if (r.ok) { keepGid(await r.json().catch(() => null)); return true; }
  } catch (e) {}
  passPush(); // 🔁 a blip — let the debounced push carry it instead
  return false;
}

// ---- 🔀 ONE BROWSER, TWO PEOPLE -----------------------------------------
// The family tablet: a parent is signed in, and their kid types their own
// address into the form /pass/ still shows while somebody is logged in. Every
// entrance used to write the new credential and then MERGE the arriving
// account into the world still sitting in localStorage — then push the fused
// save file up to the account that just arrived. Unrecoverable, and nothing on
// screen ever said a word.
// So an arriving account that is NOT this pass gaining a device lands on a
// CLEAN device: the world keys go first, then the blob.
// ⚠️ nothing is lost — the previous world lives on ITS account and comes back
// when it logs in. This only ever clears localStorage, never the server.
// ⚠️ any new key that rides collectBlob/applyBlob belongs in this list, or the
// switch leaves a shred of the last person behind.
const WORLD_KEYS = [
  'pass-v1', 'shelf-v1', 'shelf-del-v1', 'bb-last', 'ps-name-v1', 'rv-glowstick', // the sync blob
  'ps-name-at', 'ps-name-seen', 'bb-at', 'bb-seen',      // …and the name/outfit change-clocks that rank it
  'cat-own-v1', 'cat-subs-v1', 'gal-subs-v1',            // items owned, items and bananas submitted
  'ps-notices-v1', 'bm-mailed-v1', 'bm-reply-legacy-v1', // their timeline and their replies from HQ
  'bwq-c1',                                              // 🕯 the chapter — it belongs to the pass now, never to the next person on this browser
  'bb-member', 'bb-mtok',                                // the supporter grant + its signed room token
  'pass-ev-v1', 'pass-wallet-v1', 'pass-rules-v1',       // 📜 the unsent ledger tape + 💰 the server wallet + 📏 caps used — never the next person's
  GID_KEY, WT_KEY, PULL_KEY,
];
function wipeWorld() {
  for (const k of WORLD_KEYS) { try { localStorage.removeItem(k); } catch (e) {} }
}

// is the pass we just logged into the SAME person? /mail/use and /link/finish
// carry no gid, so ask the account for one (a cheap token call) and compare it
// with the gid this device already holds — equal means one human on a second
// credential. No answer = treat them as a stranger: a needless wipe costs a
// re-sync, a wrong merge costs the save file.
async function gidOf(credId, token) {
  try {
    const r = await fetch(PASS_API + `/pull?credId=${encodeURIComponent(credId)}&token=${encodeURIComponent(token)}`);
    if (!r.ok) return '';
    const d = await r.json();
    keepGid(d);   // the token and the member token land with the gid
    return d && typeof d.gid === 'string' ? d.gid : '';
  } catch (e) { return ''; }
}

// hand the device over to the arriving account; true when that meant SWITCHING
async function settleAccount(prev, credId, token, attached) {
  let prevGid = '';
  try { prevGid = localStorage.getItem(GID_KEY) || ''; } catch (e) {}
  const gid = await gidOf(credId, token);
  // the server's own attach-vs-login signal first (a pass gaining an address
  // is not a switch), then the gid, then the credential as a last resort
  // 🫧 an anonymous pass is never "somebody else": the server folded it into
  // the arriving pass (foldAnon), so this device's world goes UP, not away
  const switched = !!prev && !attached && !isAnon(prev)
    && (prevGid && gid ? gid !== prevGid : prev.credId !== credId);
  // 💰 a different HOME (an anonymous pass folded in, or a switch): its wallet
  // snapshot and caps must not outlive it here, or their seq blocks the new pass's
  if (prev && prev.credId !== credId && !attached) {
    try { localStorage.removeItem('pass-wallet-v1'); localStorage.removeItem('pass-rules-v1'); } catch (e) {}
  }
  if (switched) {
    wipeWorld();
    if (window.gtag) window.gtag('event', 'pass_account_switch');
    // 📣 …and SAY SO. The page toasts its own line a beat later and a toast is
    // gone in seconds anyway; the timeline is where the sentence keeps.
    passNoticeAdd({
      id: 'switch-' + Date.now(),
      icon: '🔄',
      text: '<b>This device switched accounts.</b> Whoever was signed in here before is safe on their own '
        + 'pass — nothing was deleted, and logging in with their email brings their whole world back.',
      link: '/pass/',
    });
  }
  if (gid) { try { localStorage.setItem(GID_KEY, gid); } catch (e) {} }
  return switched;
}

const bufToB64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// (applyBlob moved to banana-pass.js so the ambient pull there can use it
// without a circular import — re-exported above for compatibility)

async function getChallenge() {
  const res = await fetch(PASS_API + '/challenge', { method: 'POST' });
  if (!res.ok) throw new Error('no challenge');
  const payload = await res.json(); // { c, t, s } — travels INSIDE the WebAuthn challenge bytes
  return new TextEncoder().encode(JSON.stringify(payload));
}

// ---- ✉️ THE EMAIL RAIL — the primary way in ----------------------------
// A link in the inbox beats both a password (nothing to remember, nothing for
// us to store) and a passkey on its own (a passkey saved to Windows Hello is
// stranded on that PC). Passkeys stay, demoted to a shortcut.
// ⚠️ /mail/signin answers the same whether or not the address is known, so the
// UI must NEVER phrase the result as "found you" or "no such account" — the
// only honest line is "we sent a link".
export async function mailSignin(email) {
  const res = await fetch(PASS_API + '/mail/signin', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(
      e.error === 'bad email' ? 'That address doesn’t look right — check it over?'
      : e.error === 'slow down' ? 'Hold on a few seconds and try again.'
      : e.error === 'daily limit' ? 'Too much login mail today — try again tomorrow, sorry!'
      : 'Couldn’t send that — try again in a moment.');
  }
  if (window.gtag) window.gtag('event', 'pass_mail_signin');
  return true;
}

// the link lands on /pass/?in=… — spend the ticket and BE logged in
// ⚠️ single use: a failure here means the ticket is already gone, so never
// retry it, and never leave the token sitting in the address bar (the caller
// strips it immediately — it is a bearer credential in a URL).
export async function mailUse(t) {
  await (anonInFlight() || Promise.resolve());   // 🫧 a mint in flight lands first, so it is folded, never lost
  // ⭐ if this device already holds a pass, hand over its token: a first-time
  // address then ATTACHES to that pass instead of starting a second one. This
  // is what makes "add my email" and "log me in" the same single journey.
  const have = linked();
  const proof = have
    ? '&credId=' + encodeURIComponent(have.credId) + '&token=' + encodeURIComponent(have.token)
    : '';
  const res = await fetch(PASS_API + '/mail/use?t=' + encodeURIComponent(t) + proof);
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(
      e.error === 'link expired' ? 'That link has expired — send yourself a fresh one.'
      : e.error === 'used or unknown' ? 'That link was already used — send yourself a fresh one.'
      : 'That link didn’t work — send yourself a fresh one.');
  }
  const d = await res.json();
  const { credId, token, blob, attached } = d;
  // ⚠️ the credential goes first: if this browser refuses to keep it, the
  // device stays exactly as it was rather than half-switched
  if (!setLink(credId, token)) throw new Error(NO_STORE_MAIL);
  keepGid(d); // gid + member token, when the login carries them
  const switched = await settleAccount(have, credId, token, attached);
  // ⚠️ merge THEN push: a brand-new email pass arrives with no blob, and this
  // device's world would be lost on the next pull if we never sent it up.
  if (blob) applyBlob(blob);
  if (window.gtag) window.gtag('event', attached ? 'pass_mail_attached' : 'pass_mail_login');
  return { attached: !!attached, switched };
}

// ---- 📣 the news list — a SECOND rail, deliberately not this one ---------
// ⚠️ We cannot reuse the address someone logged in with, and must not: it is
// stored one-way hashed, it was given for sign-in, and marketing consent has to
// be asked for separately to be freely given. So the box asks again, and the
// confirm click is what proves the inbox AND records the consent.
export async function newsJoin(email) {
  const res = await fetch(PASS_API + '/news/join', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(
      e.error === 'bad email' ? 'That address doesn’t look right — check it over?'
      : e.error === 'busy day' ? 'Lots of post today — try again tomorrow and it’ll go through.'
      : e.error === 'news not configured' ? 'The list isn’t open yet.'
      : 'Couldn’t send that — try again in a moment.');
  }
  if (window.gtag) window.gtag('event', 'news_join');
  return true;
}
export async function newsConfirm(t) {
  const res = await fetch(PASS_API + '/news/confirm?t=' + encodeURIComponent(t));
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error === 'link expired' ? 'That link expired — ask for a new one.'
      : 'That link was already used.');
  }
  if (window.gtag) window.gtag('event', 'news_confirmed');
  return true;
}

// ---- log out ------------------------------------------------------------
// ⚠️ THE SAVE FILE STAYS ON THIS DEVICE. This drops the credential this browser
// logs in with, nothing else: bananas, coins and badges are localStorage and
// wiping them would be indistinguishable from losing them.
// 🪪 BUT THE WORLD ID GOES, and that is not free: the gid IS the ownership key,
// so the garden plots, the homestead address and the compost debts filed under
// it stop answering to this browser until it logs back in. That is the honest
// behaviour — a signed-out browser must not keep claiming an account's things —
// and it IS reversible: the worker HMACs the gid from the pass's own key
// (worldGid in worker-pass), so the next login gets the identical id back and
// every world object recognises its owner again.
// ⚠️ so the toast must not promise "nothing changes" — see banana-pass-page.js.
export function logout() {
  try { localStorage.removeItem(LINK_KEY); } catch (e) {}
  try { localStorage.removeItem(GID_KEY); } catch (e) {}
  try { localStorage.removeItem(WT_KEY); } catch (e) {}
  try { localStorage.removeItem('pass-wallet-v1'); localStorage.removeItem('pass-rules-v1'); } catch (e) {}   // 💰 signed out = the ledger is the wallet again
  // ⏱ and drop the pull throttle, so logging back in syncs at once instead of
  // running on the connection sid until the 10 minutes expire
  try { localStorage.removeItem(PULL_KEY); } catch (e) {}
  if (window.gtag) window.gtag('event', 'pass_logout');
  return true;
}

// "Save your pass" — create the passkey and upload this device's world
export async function savePass() {
  await (anonInFlight() || Promise.resolve());
  const prev = linked();
  const challenge = await getChallenge();
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'the banana world', id: location.hostname },
      user: {
        id: crypto.getRandomValues(new Uint8Array(16)),
        name: 'banana-pass',
        displayName: 'Your banana pass',
      },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
      timeout: 60000,
    },
  });
  const pk = cred.response.getPublicKey && cred.response.getPublicKey();
  if (!pk) throw new Error('no public key from authenticator');
  const body = {
    credId: bufToB64u(cred.rawId),
    pk: bufToB64u(pk),
    alg: cred.response.getPublicKeyAlgorithm(),
    clientDataJSON: bufToB64u(cred.response.clientDataJSON),
    blob: collectBlob(),
    // 🫧 the anonymous pass this device already holds: the passkey JOINS it
    // (a pointer to the same home), so the world id under the yard never moves
    ...(isAnon(prev) ? { fromCredId: prev.credId, fromToken: prev.token } : {}),
  };
  const res = await fetch(PASS_API + '/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('register failed');
  const { token } = await res.json();
  if (!setLink(body.credId, token)) throw new Error(NO_STORE);
  if (window.gtag) window.gtag('event', 'pass_saved');
  return true;
}

// 🔗 LINK ANOTHER DEVICE — for the case a passkey cannot solve on its own:
// saved to Windows Hello, it is bound to that PC and cannot travel. The device
// that already HAS the pass invites the other one with a short code.
// ⚠️ the invite must start on a device that can already prove it owns the pass
// (its token). Anything that starts from the new device would be a takeover.
export async function startLink() {
  const link = linked();
  if (!link) throw new Error('this device has no pass to share');
  const res = await fetch(PASS_API + '/link/start', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credId: link.credId, token: link.token }),
  });
  if (!res.ok) throw new Error('could not make a code');
  if (window.gtag) window.gtag('event', 'pass_link_start');
  return res.json();                                     // { code, mins }
}

// …and on the NEW device: make its own passkey, hand over the code, and it
// joins the SAME pass. It never receives the other device's key — only the pass.
export async function finishLink(code) {
  await (anonInFlight() || Promise.resolve());
  const prev = linked();
  const challenge = await getChallenge();
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'the banana world', id: location.hostname },
      user: {
        id: crypto.getRandomValues(new Uint8Array(16)),
        name: 'banana-pass',
        displayName: 'Your banana pass',
      },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
      timeout: 60000,
    },
  });
  const pk = cred.response.getPublicKey && cred.response.getPublicKey();
  if (!pk) throw new Error('no public key from authenticator');
  const body = {
    code: String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''),
    credId: bufToB64u(cred.rawId),
    pk: bufToB64u(pk),
    alg: cred.response.getPublicKeyAlgorithm(),
    clientDataJSON: bufToB64u(cred.response.clientDataJSON),
    ...(isAnon(prev) ? { fromCredId: prev.credId, fromToken: prev.token } : {}),   // 🫧 folds in
  };
  const res = await fetch(PASS_API + '/link/finish', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error === 'code expired' ? 'that code has expired — make a new one'
      : e.error === 'bad code' ? 'that code did not match'
      : 'could not link this device');
  }
  const dl = await res.json();
  const { token, blob } = dl;
  if (!setLink(body.credId, token)) throw new Error(NO_STORE);
  keepGid(dl);
  const switched = await settleAccount(prev, body.credId, token, false);
  if (blob) applyBlob(blob);
  // ⬆️ …and this device's world goes UP. /link/finish carries no blob and the
  // worker ignores one, so the joining device was the only entrance that
  // handed over nothing — its shelf and badges lived exactly one pull.
  await pushBlob(body.credId, token);
  if (window.gtag) window.gtag('event', 'pass_link_finish');
  return { switched };
}

// "I have a pass" — assert the passkey on this device and merge both worlds
export async function restorePass() {
  await (anonInFlight() || Promise.resolve());
  const prev = linked();
  const challenge = await getChallenge();
  const assertion = await navigator.credentials.get({
    publicKey: { challenge, userVerification: 'preferred', timeout: 60000 },
  });
  const body = {
    credId: bufToB64u(assertion.rawId),
    clientDataJSON: bufToB64u(assertion.response.clientDataJSON),
    authenticatorData: bufToB64u(assertion.response.authenticatorData),
    signature: bufToB64u(assertion.response.signature),
    // this device's world rides along and merges — ⚠️ but NOT while somebody
    // else is signed in here: that uploads THEIR save file into the pass being
    // restored, before anyone can tell the two people apart. It goes up below
    // instead, once the device is settled and the world is provably theirs.
    ...(prev ? {} : { blob: collectBlob() }),
    ...(isAnon(prev) ? { fromCredId: prev.credId, fromToken: prev.token } : {}),   // 🫧 folds in
  };
  const res = await fetch(PASS_API + '/assert', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'assert failed');
  const da = await res.json();
  const { token, blob } = da;
  if (!setLink(body.credId, token)) throw new Error(NO_STORE);
  keepGid(da);
  const switched = await settleAccount(prev, body.credId, token, false);
  applyBlob(blob);
  if (prev && !switched) await pushBlob(body.credId, token); // same person — their world still goes up
  if (window.gtag) window.gtag('event', 'pass_restored');
  return { switched };
}

// pull the latest on page load when already linked (cheap token call)
export async function pullLatest() {
  const link = linked();
  if (!link) return false;
  try {
    const res = await fetch(PASS_API + `/pull?credId=${encodeURIComponent(link.credId)}&token=${encodeURIComponent(link.token)}`);
    if (!res.ok) return false;
    const d = await res.json();
    // 🪪 the answer carries the world id too — throwing it away left
    // worldOwner() answering with the per-browser connection sid
    keepGid(d);
    applyBlob(d && d.blob);
    return true;
  } catch (e) { return false; }
}
