const { test } = require('node:test'); const assert = require('node:assert/strict');
const { createStore } = require('../lib/store'); const { createDirector } = require('../lib/director'); const { createSuggestionHandler } = require('../lib/suggest');
test('page suggestions validate, share the director and limit each address', async () => {
 const store = createStore(':memory:'); let time = 100000;
 const director = createDirector({ store, now: () => time, generate: async () => JSON.stringify({ title: 'Title', description: 'Details', safe: true, seconds: 30 }) });
 const handle = createSuggestionHandler({ director, now: () => time });
 async function send(body, ip = 'a') { const res = { code: 200, status(n) { this.code = n; return this; }, json(data) { this.data = data; return this; } }; await handle({ body, ip }, res); return res; }
 assert.equal((await send({ name: '<bad>', idea: 'idea' })).code, 400);
 assert.equal((await send({ name: 'viewer', idea: '' })).code, 400);
 assert.equal((await send({ name: 'viewer', idea: 'idea' })).code, 200);
 assert.equal((await send({ name: 'other', idea: 'idea' })).code, 429);
 assert.equal((await send({ name: 'VIEWER', idea: 'idea' }, 'b')).code, 400);
 time += 40000; assert.equal((await send({ name: 'other', idea: 'idea' })).code, 200);
 assert.equal(store.state().queue.length, 1); store.close();
});
