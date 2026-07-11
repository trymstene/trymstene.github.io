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
