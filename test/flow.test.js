const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');
const { io } = require('socket.io-client');

test('queue selection, live update, scoring and theme survive restart', async t => {
 const dir = mkdtempSync(path.join(tmpdir(), 'livedares-test-')); const dbPath = path.join(dir, 'test.sqlite'); const port = 20000 + Math.floor(Math.random() * 20000); const url = `http://127.0.0.1:${port}`; let child;
 t.after(() => { if (child) child.kill(); rmSync(dir, { recursive: true, force: true }); });
 async function start() { child = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(port), DATABASE_PATH: dbPath, TWITCH_CHANNEL: '', TWITCH_OAUTH: '', TWITCH_BOT_USERNAME: '', OPENAI_API_KEY: '' }, stdio: 'ignore' }); for (let i = 0; i < 100; i++) { try { if ((await fetch(url + '/api/state')).ok) return; } catch {} await new Promise(r => setTimeout(r, 50)); } throw Error('server failed to start'); }
 async function stop() { const proc = child; await new Promise(resolve => { proc.once('exit', resolve); proc.kill(); }); child = null; }
 async function post(p, body) { return fetch(url + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) }); }
 await start();
 const db = new Database(dbPath); const now = Date.now();
 db.prepare("INSERT INTO challenges (title, description, seconds, suggested_by, status, created_at, ends_at) VALUES ('First', 'First test', 30, 'viewer1', 'active', ?, ?), ('Second', 'Second test', 45, 'viewer2', 'queued', ?, 0)").run(now, now + 30000, now); db.close();
 assert.equal((await post('/api/queue/2/start')).status, 409);
 assert.equal((await post('/api/challenge/done')).status, 200);
 const socket = io(url, { transports: ['websocket'] }); t.after(() => socket.close());
 const stateEvent = new Promise(resolve => { socket.on('state', s => { if (s.challenge?.id === 2) resolve(s); }); });
 await new Promise(resolve => socket.on('connect', resolve));
 assert.equal((await post('/api/queue/2/start')).status, 200);
 let state = await stateEvent; assert.equal(state.challenge.title, 'Second'); assert.equal(state.leaderboard[0].points, 100); assert.equal(state.leaderboard[0].last_challenge, 'First');
 assert.equal((await post('/api/overlay/theme', { theme: 'ember' })).status, 200);
 assert.equal((await post('/api/challenge/fail')).status, 200);
 socket.close(); await stop(); await start(); state = await (await fetch(url + '/api/state')).json();
 assert.equal(state.overlayTheme, 'ember'); assert.equal(state.leaderboard[0].points, 100); assert.equal(state.recent.length, 2); assert.equal(state.challenge, null);
 assert.equal((await fetch(url + '/overlay')).status, 200);
});
