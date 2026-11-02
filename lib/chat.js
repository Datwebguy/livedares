'use strict';
const { UserError } = require('./director');

const COMMAND = /^!(challenge|done|fail|clear)(?:\s+([\s\S]*))?$/i;

/** "!Challenge sing" -> { command: 'challenge', arg: 'sing' }, anything else -> null. */
function parseCommand(message) {
  const m = String(message || '').trim().match(COMMAND);
  return m ? { command: m[1].toLowerCase(), arg: (m[2] || '').trim() } : null;
}

const canModerate = tags => Boolean(tags && (tags.mod || tags.badges?.broadcaster === '1'));

/** Handles one chat message. `say` posts a reply; `onChange` tells the screens to refresh. */
function createChatHandler({ store, director, say, onChange = () => {}, log = console }) {
  return async function handle(tags, message) {
    const parsed = parseCommand(message);
    const username = tags?.username;
    if (!parsed || !username) return;
    const { command, arg } = parsed;
    if (command === 'challenge') {
      if (!arg) return void say(`@${username} Add an idea after !challenge.`);
      try {
        const c = await director.suggest(arg, username);
        await say(c.status === 'queued' ? `@${username} Your challenge is queued: ${c.title} (${c.seconds}s).` : `Challenge from @${username}: ${c.title} — ${c.description} (${c.seconds}s)`);
      } catch (err) {
        log.error('Challenge creation:', err.message);
        await say(`@${username} ${err instanceof UserError ? err.message : 'Could not create a challenge right now. Check the server logs.'}`);
      }
      return;
    }
    if (!canModerate(tags)) return;
    const c = store.resolve(command);
    if (!c) return void say('There is no active challenge.');
    onChange();
    await say(command === 'done' ? `Challenge complete! @${c.suggested_by} earns ${store.POINTS} points.` : command === 'fail' ? 'Challenge failed. Better luck next time!' : 'Challenge cleared. Chat can suggest the next one!');
  };
}

module.exports = { parseCommand, canModerate, createChatHandler };
