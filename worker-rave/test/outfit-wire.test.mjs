// 🧢 WHAT A ROOM PASSES ON OF YOUR FORGE PIECES (1 Oct 2026). Every room — the rave, the park, the beach, a yard —
// cleans an outfit with sanitizeOutfit, and its `c` list kept the FIRST four: a banana wearing six pieces reached
// everybody else without the two it had put on last. One piece per spot now (head, face, chest, feet and each hand),
// the newest kept, and a malformed id dropped on its own instead of taking the whole slot with it.
globalThis.WebSocketRequestResponsePair = class { constructor(a, b) { this.a = a; this.b = b; } };
const { ParkRoom } = await import('../src/index.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra === undefined ? '' : JSON.stringify(extra)); }
};
const fakeWs = () => ({ att: null, sent: [], serializeAttachment(a) { this.att = structuredClone(a); }, deserializeAttachment() { return this.att; }, send(s) { this.sent.push(s); }, close() {} });
const fakeState = (sockets) => {
  const m = new Map();
  return {
    storage: { async get(k) { return m.get(k); }, async put(k, v) { m.set(k, v); }, async delete(k) { m.delete(k); }, async list() { return new Map(); } },
    getWebSockets: () => sockets, setWebSocketAutoResponse() {}, getWebSocketAutoResponseTimestamp() { return new Date(); }, acceptWebSocket() {},
  };
};

console.log('\n🧢  the outfit on the wire');
const ws = fakeWs();
const room = new ParkRoom(fakeState([ws]), {});
const six = ['c_aaaaaa01', 'c_bbbbbb02', 'c_cccccc03', 'c_dddddd04', 'c_eeeeee05', 'c_ffffff06'];
const say = (msg) => room.webSocketMessage(ws, JSON.stringify(msg));

await say({ t: 'hi', sid: 's1', outfit: { hat: 'none', glasses: 'none', extras: {}, c: six.join(',') } });
ok('⭐ six pieces all reach the room', ws.att && ws.att.outfit.c === six.join(','), ws.att && ws.att.outfit);
await say({ t: 'outfit', outfit: { c: ['c_0000000a', ...six].join(',') } });
ok('⭐ over six, the OLDEST goes — never the one just put on', ws.att.outfit.c === six.join(','), ws.att.outfit);
await say({ t: 'outfit', outfit: { c: 'c_aaaaaa01,<script>,c_bbbbbb02' } });
ok('a malformed id is dropped on its own; the rest stay on', ws.att.outfit.c === 'c_aaaaaa01,c_bbbbbb02', ws.att.outfit);
await say({ t: 'outfit', outfit: { c: 'nope' } });
ok('nothing valid is no slot at all', !('c' in ws.att.outfit), ws.att.outfit);

console.log('\n' + pass + ' pass, ' + fail + ' fail\n');
process.exit(fail ? 1 : 0);
