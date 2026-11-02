'use strict';
const { UserError } = require('./director');

const COMMAND = /^!(challenge|done|fail|clear|vote|queue|leaderboard|rank)(?:\s+([\s\S]*))?$/i;

/** "!Challenge sing" -> { command: 'challenge', arg: 'sing' }, anything else -> null. */
function parseCommand(message) {
  const m = String(message || '').trim().match(COMMAND);
  return m ? { command: m[1].toLowerCase(), arg: (m[2] || '').trim() } : null;
}

const canModerate = tags => Boolean(tags && (tags.mod || tags.badges?.broadcaster === '1'));

/** Handles one chat message. `say` posts a reply; `onChange` tells the screens to refresh. */
function createChatHandler({ store, director, say, onChange = () => {}, log = console }) {
  const lastReply = new Map();
  return async function handle(tags, message) {
    const parsed = parseCommand(message);
    const username = tags?.username;
    if (!parsed || !username) return;
    const { command, arg } = parsed;
    if (['queue', 'leaderboard', 'rank'].includes(command)) {
      const key = `${username.toLowerCase()}:${command}`, now = Date.now();
      if (now - (lastReply.get(key) || 0) < 10000) return;
      for (const [k, v] of lastReply) if (now - v >= 10000) lastReply.delete(k);
      lastReply.set(key, now);
      const state = store.state(); let reply;
      if (command === 'queue') reply = state.queue.length ? 'Waiting: ' + state.queue.slice(0,3).map((q,i) => `${i+1}. ${q.title} (${q.votes} votes)`).join(' | ') : 'No dares are waiting.';
      if (command === 'leaderboard') reply = state.leaderboard.length ? 'Top viewers: ' + state.leaderboard.slice(0,3).map((u,i) => `${i+1}. ${u.username}: ${u.points}`).join(' | ') : 'No points have been awarded yet.';
      if (command === 'rank') { const r = store.rank(username); reply = r ? `@${username} You are number ${r.rank} with ${r.points} points.` : `@${username} You do not have points yet.`; }
      return void await say(reply.slice(0, 450));
    }
    if (command === 'challenge') {
      if (!arg) return void say(`@${username} Add an idea after !challenge.`);
      try {
        const c = await director.suggest(arg, username);
        await say(c.status === 'queued' ? `@${username} Your challenge is queued: ${c.title} (${c.seconds}s).` : `Challenge from @${username}: ${c.title} — ${c.description} (${c.seconds}s)`);
      } catch (err) {
        log.error('Challenge creation failed.');
        await say(`@${username} ${err instanceof UserError ? err.message : 'Could not create a challenge right now. Check the server logs.'}`);
      }
      return;
    }
    if (command === 'vote') { const position = Number(arg); if (!/^[123]$/.test(arg) || !store.vote(username, position)) return void say(`@${username} Choose a waiting dare: !vote 1, !vote 2 or !vote 3.`); onChange(); return; }
    if (!canModerate(tags)) return;
    const c = store.resolve(command);
    if (!c) return void say('There is no active challenge.');
    onChange();
    await say(command === 'done' ? `Challenge complete! @${c.suggested_by} earns ${store.POINTS} points.` : command === 'fail' ? 'Challenge failed. Better luck next time!' : 'Challenge cleared. Chat can suggest the next one!');
  };
}

module.exports = { parseCommand, canModerate, createChatHandler };
