const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createStore } = require('../lib/store');

test('"Tonight" counts the last 12 hours, not the server clock day', () => {
  const store = createStore(':memory:'); const now = Date.now();
  const add = (status, ago) => store.db.prepare("INSERT INTO challenges (title, description, seconds, suggested_by, status, created_at, ends_at, resolved_at) VALUES ('t', 'd', 20, 'v', ?, ?, ?, ?)").run(status, now - ago, now - ago, now - ago);
  add('done', 13 * 3600e3); add('done', 11 * 3600e3); add('failed', 3600e3); add('cleared', 1000);
  assert.deepEqual({ ...store.state().tonight }, { total: 2, completed: 1 });
});
