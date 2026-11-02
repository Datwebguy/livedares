'use strict';
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const POINTS = 100;
const QUEUE_LIMIT = 20;
const THEMES = ['midnight', 'ember', 'mono'];
const ACTIONS = { done: 'done', fail: 'failed', clear: 'cleared' };

/** Everything that touches SQLite lives here, behind a small interface. */
function createStore(dbPath, { channel = '' } = {}) {
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`CREATE TABLE IF NOT EXISTS challenges (
 id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT NOT NULL,
 seconds INTEGER NOT NULL, suggested_by TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active',
 created_at INTEGER NOT NULL, ends_at INTEGER NOT NULL, resolved_at INTEGER
); CREATE TABLE IF NOT EXISTS leaderboard (username TEXT PRIMARY KEY COLLATE NOCASE, points INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS votes (voter TEXT PRIMARY KEY COLLATE NOCASE, challenge_id INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS challenges_status ON challenges (status, id);`);

  const flags = { twitchConnected: false, generating: false };
  const active = () => db.prepare("SELECT * FROM challenges WHERE status = 'active' ORDER BY id DESC LIMIT 1").get() || null;
  const queuedCount = () => db.prepare("SELECT COUNT(*) AS n FROM challenges WHERE status = 'queued'").get().n;

  function state() {
    return {
      challenge: active(),
      queue: db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM votes v WHERE v.challenge_id = c.id) AS votes FROM challenges c WHERE c.status = 'queued' ORDER BY c.id ASC LIMIT ${QUEUE_LIMIT}`).all(),
      autoStart: db.prepare("SELECT value FROM settings WHERE key = 'auto_start'").get()?.value === '1',
      recent: db.prepare("SELECT * FROM challenges WHERE status IN ('done','failed','cleared') ORDER BY resolved_at DESC, id DESC LIMIT 8").all(),
      leaderboard: db.prepare(`SELECT l.username, l.points, l.wins, (SELECT c.title FROM challenges c WHERE c.status = 'done' AND c.suggested_by = l.username COLLATE NOCASE ORDER BY c.resolved_at DESC, c.id DESC LIMIT 1) AS last_challenge FROM leaderboard l ORDER BY l.points DESC, l.wins DESC, l.username COLLATE NOCASE ASC LIMIT 20`).all(),
      overlayTheme: db.prepare("SELECT value FROM settings WHERE key = 'overlay_theme'").get()?.value || THEMES[0],
      twitchConnected: flags.twitchConnected,
      channel,
      generating: flags.generating,
      stats: db.prepare("SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END),0) AS completed FROM challenges").get(),
    };
  }

  const resolveTx = db.transaction(action => {
    const challenge = active();
    if (!challenge) return null;
    db.prepare('UPDATE challenges SET status = ?, resolved_at = ? WHERE id = ? AND status = ?').run(ACTIONS[action], Date.now(), challenge.id, 'active');
    if (action === 'done') db.prepare('INSERT INTO leaderboard (username, points, wins) VALUES (?, ?, 1) ON CONFLICT(username) DO UPDATE SET points = points + excluded.points, wins = wins + 1').run(challenge.suggested_by, POINTS);
    return challenge;
  });

  /** Mark the active challenge done, failed or cleared. Returns it, or null when nothing was running. */
  const resolve = action => (ACTIONS[action] ? resolveTx(action) : null);

  /** A new idea starts straight away only if nothing is running and nobody is already waiting. */
  const addChallenge = db.transaction(({ title, description, seconds, username }) => {
    const now = Date.now();
    const status = active() || queuedCount() ? 'queued' : 'active';
    const info = db.prepare('INSERT INTO challenges (title, description, seconds, suggested_by, created_at, ends_at, status) VALUES (?, ?, ?, ?, ?, ?, ?)').run(title, description, seconds, username, now, status === 'active' ? now + seconds * 1000 : 0, status);
    return db.prepare('SELECT * FROM challenges WHERE id = ?').get(info.lastInsertRowid);
  });

  /** Returns an error message, or null on success. */
  const startQueued = db.transaction(id => {
    if (active()) return 'Finish or clear the active challenge first.';
    const item = db.prepare("SELECT * FROM challenges WHERE id = ? AND status = 'queued'").get(id);
    if (!item) return 'That queued challenge no longer exists.';
    const now = Date.now();
    db.prepare("UPDATE challenges SET status = 'active', created_at = ?, ends_at = ? WHERE id = ?").run(now, now + item.seconds * 1000, item.id);
    db.prepare('DELETE FROM votes WHERE challenge_id = ?').run(item.id);
    return null;
  });

  const removeQueued = db.transaction(id => { const removed = db.prepare("UPDATE challenges SET status = 'cleared', resolved_at = ? WHERE id = ? AND status = 'queued'").run(Date.now(), id).changes > 0; if (removed) db.prepare('DELETE FROM votes WHERE challenge_id = ?').run(id); return removed; });
  function vote(username, position) { const item = db.prepare("SELECT id FROM challenges WHERE status = 'queued' ORDER BY id LIMIT 1 OFFSET ?").get(position - 1); if (!item || ![1,2,3].includes(position)) return false; db.prepare('INSERT INTO votes (voter, challenge_id) VALUES (?, ?) ON CONFLICT(voter) DO UPDATE SET challenge_id = excluded.challenge_id').run(username, item.id); return true; }
  function startMostVoted() { const item = db.prepare("SELECT c.id, COUNT(v.voter) AS n FROM challenges c LEFT JOIN votes v ON v.challenge_id = c.id WHERE c.status = 'queued' GROUP BY c.id ORDER BY n DESC, c.id ASC LIMIT 1").get(); return item ? startQueued(item.id) : 'There are no dares waiting.'; }
  function setAutoStart(enabled) { if (typeof enabled !== 'boolean') return false; db.prepare("INSERT INTO settings (key,value) VALUES ('auto_start',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(enabled ? '1' : '0'); return true; }

  function setTheme(theme) {
    if (!THEMES.includes(theme)) return false;
    db.prepare("INSERT INTO settings (key, value) VALUES ('overlay_theme', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(theme);
    return true;
  }

  return { db, flags, state, active, queuedCount, resolve, addChallenge, startQueued, removeQueued, vote, startMostVoted, setAutoStart, setTheme, close: () => db.close(), POINTS, QUEUE_LIMIT, THEMES };
}

module.exports = { createStore, POINTS, QUEUE_LIMIT, THEMES };
