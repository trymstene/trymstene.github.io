// ☝ A LINE SAID ONCE ON THIS DEVICE (24 Sep 2026, the job QA): a counter's opening line at a player's first shift there, the
// post office's at their first round. once(k) is true the first time it is asked for k, and false after (tw-once-v1).
export function once(k) {
  let o = {};
  try { o = JSON.parse(localStorage.getItem('tw-once-v1') || '{}') || {}; } catch (e) {}
  if (o[k]) return false;
  o[k] = 1;
  try { localStorage.setItem('tw-once-v1', JSON.stringify(o)); } catch (e) {}
  return true;
}
