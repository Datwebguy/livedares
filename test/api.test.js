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

test('the dashboard works for anyone and answers in JSON', async t => {
  const s = await boot(); t.after(s.stop);
  assert.deepEqual(await (await fetch(s.url + '/healthz')).json(), { ok: true });
  const state = await (await fetch(s.url + '/api/state')).json();
  assert.equal(state.challenge, null); assert.deepEqual(state.leaderboard, []);
  assert.equal((await post(s.url, '/api/challenge/done')).status, 409);
  assert.equal((await post(s.url, '/api/challenge/nope')).status, 404);
  assert.equal((await post(s.url, '/api/overlay/theme', { theme: 'pink' })).status, 400);
  const bad = await post(s.url, '/api/overlay/theme', '{oops'); assert.equal(bad.status, 400); assert.equal((await bad.json()).error, 'Bad request.');
  assert.equal((await fetch(s.url + '/api/missing')).status, 404);
  assert.equal((await fetch(s.url + '/overlay')).status, 200);
  assert.equal((await fetch(s.url + '/')).headers.get('x-content-type-options'), 'nosniff');
});

test('the server shuts down cleanly when asked', async () => {
  const s = await boot(); const code = await new Promise(r => { s.child.once('exit', c => r(c)); s.child.kill('SIGTERM'); });
  assert.equal(code, 0);
});

test('the home page carries link-preview tags with the real address', async t => {
  const s = await boot(); t.after(s.stop);
  const html = await (await fetch(s.url + '/')).text();
  assert.ok(html.includes(`<meta property="og:image" content="${s.url}/og.png">`));
  assert.ok(!html.includes('__BASE__'));
  assert.equal((await fetch(s.url + '/og.png')).status, 200);
  const home = await fetch(s.url + '/', { headers: { host: 'bad host"><script>' } }).catch(() => null);
  if (home) assert.ok(!(await home.text()).includes('<script>alert'));
});
