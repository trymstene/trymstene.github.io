// 🐈 THE CAT KEEPS HER PLACE (28 Sep 2026) — a yard's save is cleaned by yardSan, which keeps only the species it
// knows. The cat joined the dog on the Banana Phone; before the worker knew her, a save would have dropped her and
// the next pull would have lost her (the flock, the long grass and the rehomed alike).
globalThis.WebSocketRequestResponsePair = class { constructor(a, b) { this.a = a; this.b = b; } };
const { YardRoom } = await import('../src/index.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra === undefined ? '' : JSON.stringify(extra)); }
};
const st = { storage: { async get() {}, async put() {}, async delete() {}, async list() { return new Map(); } },
  getWebSockets: () => [], setWebSocketAutoResponse() {}, acceptWebSocket() {} };
const yard = new YardRoom(st, { MEMBER_HMAC: 'x' });
const out = yard.yardSan({
  animals: [
    { sp: 'cat', b: 4, name: 'Tabby', id: 123456, ad: 20400, gs: 3, sd: 777, hm: { x: 700, y: 520 } },
    { sp: 'dog', b: 2, name: '' },
    { sp: 'lion', b: 9, name: 'Leo' },
  ],
  grass: [{ sp: 'cat', name: 'Old Tom', b: 30, gs: 99, ad: 20000, ld: 20390, id: 222222 }],
  memory: [{ sp: 'cat', name: 'Mog', b: 5, id: 333333 }],
});
const cat = out.animals.find((a) => a.sp === 'cat');
ok('the cat stays in the flock', !!cat, out.animals);
ok('her name, hugs, purrs, seed and nap spot ride along', cat && cat.name === 'Tabby' && cat.b === 4 && cat.gs === 3 && cat.sd === 777
  && cat.hm && cat.hm.x === 700, cat);
ok('the dog still does', out.animals.some((a) => a.sp === 'dog'));
ok('a species the yard does not have is still dropped', !out.animals.some((a) => a.sp === 'lion'), out.animals);
ok('a cat at rest stays in the long grass', out.grass.length === 1 && out.grass[0].sp === 'cat' && out.grass[0].name === 'Old Tom', out.grass);
ok('a rehomed cat is still remembered', out.memory.length === 1 && out.memory[0].sp === 'cat', out.memory);
console.log(fail ? `✗ ${fail} failed, ${pass} passed` : `✓ all ${pass} passed`);
process.exit(fail ? 1 : 0);
