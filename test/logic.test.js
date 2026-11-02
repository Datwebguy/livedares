const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createStore } = require('../lib/store');
const { createDirector, UserError } = require('../lib/director');
const { parseCommand, createChatHandler } = require('../lib/chat');

const ok = (over = {}) => JSON.stringify({ title: 'Sing a song', description: 'Make up a song about the game.', seconds: 30, safe: true, ...over });
function setup({ generate = async () => ok(), cooldownMs = 40000 } = {}) {
  const store = createStore(':memory:'); let t = 1_000_000;
  const director = createDirector({ store, generate, cooldownMs, now: () => t });
  return { store, director, tick: ms => { t += ms; } };
}

test('parseCommand reads commands in any case and ignores other chat', () => {
  assert.deepEqual(parseCommand('!Challenge  sing loudly '), { command: 'challenge', arg: 'sing loudly' });
  assert.deepEqual(parseCommand('!done'), { command: 'done', arg: '' });
  assert.equal(parseCommand('hello !done'), null);
  assert.equal(parseCommand('!challengeX nope'), null);
  assert.equal(parseCommand(undefined), null);
});

test('the first idea starts at once and later ones wait their turn', async () => {
  const { store, director, tick } = setup({ cooldownMs: 0 });
  const first = await director.suggest('sing', 'ann');
  assert.equal(first.status, 'active'); assert.ok(first.ends_at > Date.now() - 1000);
  const second = await director.suggest('dance', 'bob');
  assert.equal(second.status, 'queued'); assert.equal(second.ends_at, 0);
  store.resolve('done'); // nothing is running now, but bob is still waiting
  const third = await director.suggest('jump', 'cy');
  assert.equal(third.status, 'queued', 'a new idea must not jump ahead of the queue');
  assert.equal(store.state().queue.length, 2);
  tick(1);
});

test('unsafe, malformed and empty answers never reach the database', async () => {
  for (const raw of [ok({ safe: false }), ok({ seconds: 15 }), ok({ title: '   ' }), 'not json', '']) {
    const { store, director } = setup({ generate: async () => raw });
    await assert.rejects(director.suggest('anything', 'ann'), UserError);
    assert.equal(store.state().stats.total, 0);
    assert.equal(store.flags.generating, false, 'the busy flag must reset after a failure');
  }
});

test('titles and descriptions are trimmed to their limits', async () => {
  const { director } = setup({ generate: async () => ok({ title: 'T'.repeat(90), description: 'D'.repeat(200) }) });
  const c = await director.suggest('x', 'ann');
  assert.equal(c.title.length, 60); assert.equal(c.description.length, 120);
});

test('the cooldown is per viewer, ends on time, and is not used up when the key is missing', async () => {
  const { director, tick } = setup();
  await director.suggest('a', 'Ann');
  await assert.rejects(director.suggest('b', 'ann'), /wait 40 seconds/);
  await director.suggest('c', 'bob');
  tick(40000);
  await director.suggest('d', 'ANN');
  const none = setup({ generate: null });
  await assert.rejects(none.director.suggest('a', 'ann'), /OPENAI_API_KEY/);
  none.director = createDirector({ store: none.store, generate: async () => ok(), now: () => 1_000_000 });
  await none.director.suggest('a', 'ann');
});

test('the queue stops at its limit and a busy director refuses a second idea', async () => {
  const { store, director } = setup({ cooldownMs: 0 });
  for (let i = 0; i < 21; i++) await director.suggest('x', 'v' + i);
  await assert.rejects(director.suggest('x', 'late'), /queue is full/);
  const slow = setup({ generate: () => new Promise(() => {}) });
  slow.director.suggest('x', 'ann').catch(() => {});
  await assert.rejects(slow.director.suggest('x', 'bob'), /Another idea/);
  assert.equal(store.queuedCount(), 20);
});

test('chat: viewers suggest, only the broadcaster and mods decide, points go to the suggester', async () => {
  const { store, director } = setup({ cooldownMs: 0 }); const said = [];
  const handle = createChatHandler({ store, director, say: async m => { said.push(m); }, log: { error() {} } });
  await handle({ username: 'ann' }, '!challenge sing');
  assert.match(said.at(-1), /^Challenge from @ann: Sing a song/);
  await handle({ username: 'bob' }, '!challenge dance');
  assert.match(said.at(-1), /^@bob Your challenge is queued/);
  await handle({ username: 'bob' }, '!done');
  assert.equal(store.state().leaderboard.length, 0, 'a normal viewer cannot mark it done');
  await handle({ username: 'zed', mod: true }, '!done');
  assert.match(said.at(-1), /@ann earns 100 points/);
  assert.deepEqual(store.state().leaderboard.map(l => [l.username, l.points]), [['ann', 100]]);
  await handle({ username: 'zed', badges: { broadcaster: '1' } }, '!clear');
  assert.equal(said.at(-1), 'There is no active challenge.');
  await handle({ username: 'ann' }, '!challenge');
  assert.match(said.at(-1), /Add an idea/);
  await handle({ username: 'chatter' }, 'just talking');
  const before = said.length; await handle({}, '!done'); assert.equal(said.length, before);
});

test('chat: a failing idea service is reported in plain words without leaking details', async () => {
  const { store, director } = setup({ generate: async () => { throw Object.assign(new Error('401 Incorrect API key sk-secret'), { status: 401 }); } }); const said = [];
  await createChatHandler({ store, director, say: async m => { said.push(m); }, log: { error() {} } })({ username: 'ann' }, '!challenge sing');
  assert.equal(said[0], '@ann Could not create a challenge right now. Check the server logs.');
  assert.ok(!said[0].includes('sk-'));
});

test('scores add up, names match any capitalisation, and failed dares score nothing', () => {
  const store = createStore(':memory:');
  const run = (u, outcome) => { store.addChallenge({ title: 't' + u + outcome, description: 'd', seconds: 20, username: u }); return store.resolve(outcome); };
  run('Ann', 'done'); run('ann', 'done'); run('bob', 'fail'); run('cy', 'clear');
  const board = store.state().leaderboard;
  assert.equal(board.length, 1); assert.equal(board[0].points, 200); assert.equal(board[0].wins, 2);
  assert.equal(store.resolve('nonsense'), null);
  assert.equal(store.state().recent.length, 4);
});
