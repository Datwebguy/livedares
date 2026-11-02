const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { createStore } = require('../lib/store');
const { createDirector } = require('../lib/director');
const { choosePlaying } = require('../lib/twitch-context');

test('saved playing value is cleaned, survives restart and can be cleared', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'livedares-playing-')); const file = path.join(dir, 'data.sqlite');
  let store = createStore(file);
  assert.equal(store.getManualPlaying(), '');
  assert.equal(store.setManualPlaying('  Test\u0000 game\u007f  '), 'Test game');
  assert.equal(store.setManualPlaying('x'.repeat(61)), null);
  assert.equal(store.setManualPlaying(12), null);
  store.close(); store = createStore(file);
  assert.equal(store.getManualPlaying(), 'Test game');
  assert.equal(store.setManualPlaying(''), ''); assert.equal(store.getManualPlaying(), '');
  store.close(); rmSync(dir, { recursive: true, force: true });
});

test('live game wins, manual game falls back and selected game reaches generator', async () => {
  assert.equal(choosePlaying(null, ''), null);
  assert.deepEqual(choosePlaying({ game: '', title: 'Live title' }, 'Manual'), { game: 'Manual', title: 'Live title' });
  assert.deepEqual(choosePlaying({ game: 'Live', title: 'Live title' }, 'Manual'), { game: 'Live', title: 'Live title' });
  const store = createStore(':memory:'); store.setManualPlaying('Manual'); let context;
  const director = createDirector({ store, getContext: async () => choosePlaying(null, store.getManualPlaying()), generate: async (_, value) => { context = value; return JSON.stringify({ title: 'Test', description: 'Test', seconds: 20, safe: true }); } });
  await director.suggest('Test', 'tester'); assert.equal(context.game, 'Manual'); store.close();
});

test('playing endpoint validates, broadcasts current state and persists across restart', async t => {
  const dir = mkdtempSync(path.join(tmpdir(), 'livedares-playing-api-')); const db = path.join(dir, 'data.sqlite'); const port = 22000 + Math.floor(Math.random() * 15000); const base = `http://127.0.0.1:${port}`; let child;
  async function start() { child = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(port), DATABASE_PATH: db, TWITCH_CHANNEL: '', TWITCH_CLIENT_ID: '', TWITCH_CLIENT_SECRET: '', OPENAI_API_KEY: '' }, stdio: 'ignore' }); for (let i=0; i<80; i++) { try { if ((await fetch(base + '/healthz')).ok) return; } catch {} await new Promise(r=>setTimeout(r,50)); } throw Error('Server did not start'); }
  async function stop() { if (!child) return; const c = child; child = null; await new Promise(r => { c.once('exit', r); c.kill('SIGTERM'); }); }
  t.after(async () => { await stop(); rmSync(dir, { recursive: true, force: true }); });
  const post = game => fetch(base + '/api/playing', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({game}) });
  await start(); assert.equal((await post('x'.repeat(61))).status, 400); assert.equal((await post({})).status, 400);
  assert.deepEqual(await (await post('  A\u0001 B  ')).json(), { game: 'A B' });
  assert.equal((await (await fetch(base + '/api/state')).json()).playing.game, 'A B');
  await stop(); await start(); assert.equal((await (await fetch(base + '/api/state')).json()).manualPlaying, 'A B');
  assert.equal((await post('')).status, 200); assert.equal((await (await fetch(base + '/api/state')).json()).playing, null);
});
