const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

async function boot(env = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'livedares-api-')); const port = 20000 + Math.floor(Math.random() * 20000);
  const child = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(port), DATABASE_PATH: path.join(dir, 't.sqlite'), TWITCH_CHANNEL: '', TWITCH_OAUTH: '', TWITCH_BOT_USERNAME: '', OPENAI_API_KEY: '', ...env }, stdio: 'ignore' });
  const url = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 60; i++) { try { if ((await fetch(url + '/healthz')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  return { url, stop: async () => { await new Promise(r => { child.once('exit', r); child.kill('SIGTERM'); }); rmSync(dir, { recursive: true, force: true }); }, child };
}
const post = (url, p, body, headers = {}) => fetch(url + p, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });

test('without a password the dashboard works as before and answers in JSON', async t => {
  const s = await boot(); t.after(s.stop);
  assert.deepEqual(await (await fetch(s.url + '/healthz')).json(), { ok: true });
  const state = await (await fetch(s.url + '/api/state')).json();
  assert.equal(state.adminRequired, false); assert.equal(state.challenge, null); assert.deepEqual(state.leaderboard, []);
  assert.equal((await post(s.url, '/api/challenge/done')).status, 409);
  assert.equal((await post(s.url, '/api/challenge/nope')).status, 404);
  assert.equal((await post(s.url, '/api/overlay/theme', { theme: 'pink' })).status, 400);
  const bad = await post(s.url, '/api/overlay/theme', '{oops'); assert.equal(bad.status, 400); assert.equal((await bad.json()).error, 'Bad request.');
  assert.equal((await fetch(s.url + '/api/missing')).status, 404);
  assert.equal((await fetch(s.url + '/overlay')).status, 200);
  assert.equal((await fetch(s.url + '/')).headers.get('x-content-type-options'), 'nosniff');
});

test('with ADMIN_TOKEN set, changing the show needs the password and reading does not', async t => {
  const s = await boot({ ADMIN_TOKEN: 'open-sesame' }); t.after(s.stop);
  assert.equal((await (await fetch(s.url + '/api/state')).json()).adminRequired, true);
  assert.equal((await post(s.url, '/api/overlay/theme', { theme: 'ember' })).status, 401);
  assert.equal((await post(s.url, '/api/overlay/theme', { theme: 'ember' }, { 'x-admin-token': 'wrong-pass-xx' })).status, 401);
  assert.equal((await post(s.url, '/api/overlay/theme', { theme: 'ember' }, { 'x-admin-token': 'open-sesame' })).status, 200);
  assert.equal((await (await fetch(s.url + '/api/state')).json()).overlayTheme, 'ember');
  assert.equal((await post(s.url, '/api/challenge/done')).status, 401);
  assert.equal((await post(s.url, '/api/queue/1/remove')).status, 401);
});

test('the server shuts down cleanly when asked', async () => {
  const s = await boot(); const code = await new Promise(r => { s.child.once('exit', c => r(c)); s.child.kill('SIGTERM'); });
  assert.equal(code, 0);
});
