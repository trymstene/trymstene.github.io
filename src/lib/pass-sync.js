// Pass sync ceremonies — "Save your pass" / "I have a pass" (WebAuthn).
// Biometrics appear ONLY here, when linking a device; day-to-day sync rides
// the device token this module stores (see pushNow in banana-pass.js).
// CLIENT-ONLY; loaded on /pass/ only.
import { PASS_API, collectBlob, applyBlob } from './banana-pass.js';

const LINK_KEY = 'pass-link'; // { credId, token }
export { PASS_API, collectBlob, applyBlob };

export const passkeysSupported = () =>
  !!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.create);

export function linked() {
  try { return JSON.parse(localStorage.getItem(LINK_KEY) || 'null'); } catch (e) { return null; }
}
function setLink(credId, token) {
  try { localStorage.setItem(LINK_KEY, JSON.stringify({ credId, token })); } catch (e) {}
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
  const { credId, token, blob, attached } = await res.json();
  setLink(credId, token);
  // ⚠️ merge THEN push: a brand-new email pass arrives with no blob, and this
  // device's world would be lost on the next pull if we never sent it up.
  if (blob) applyBlob(blob);
  if (window.gtag) window.gtag('event', attached ? 'pass_mail_attached' : 'pass_mail_login');
  return { attached: !!attached };
}

// ---- log out ------------------------------------------------------------
// ⚠️ THE SAVE FILE STAYS. This drops the credential this browser logs in with,
// nothing else: bananas, coins and badges are localStorage and wiping them
// would be indistinguishable from losing them. Logging back in re-merges.
export function logout() {
  try { localStorage.removeItem(LINK_KEY); } catch (e) {}
  if (window.gtag) window.gtag('event', 'pass_logout');
  return true;
}

// "Save your pass" — create the passkey and upload this device's world
export async function savePass() {
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
  };
  const res = await fetch(PASS_API + '/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('register failed');
  const { token } = await res.json();
  setLink(body.credId, token);
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
  const { token, blob } = await res.json();
  setLink(body.credId, token);
  if (blob) applyBlob(blob);
  if (window.gtag) window.gtag('event', 'pass_link_finish');
  return true;
}

// "I have a pass" — assert the passkey on this device and merge both worlds
export async function restorePass() {
  const challenge = await getChallenge();
  const assertion = await navigator.credentials.get({
    publicKey: { challenge, userVerification: 'preferred', timeout: 60000 },
  });
  const body = {
    credId: bufToB64u(assertion.rawId),
    clientDataJSON: bufToB64u(assertion.response.clientDataJSON),
    authenticatorData: bufToB64u(assertion.response.authenticatorData),
    signature: bufToB64u(assertion.response.signature),
    blob: collectBlob(), // this device's world rides along and merges
  };
  const res = await fetch(PASS_API + '/assert', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'assert failed');
  const { token, blob } = await res.json();
  setLink(body.credId, token);
  applyBlob(blob);
  if (window.gtag) window.gtag('event', 'pass_restored');
  return true;
}

// pull the latest on page load when already linked (cheap token call)
export async function pullLatest() {
  const link = linked();
  if (!link) return false;
  try {
    const res = await fetch(PASS_API + `/pull?credId=${encodeURIComponent(link.credId)}&token=${encodeURIComponent(link.token)}`);
    if (!res.ok) return false;
    const { blob } = await res.json();
    applyBlob(blob);
    return true;
  } catch (e) { return false; }
}
