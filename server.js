require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const tmi = require('tmi.js');
const { createStore } = require('./lib/store');
const { createDirector, openAiGenerator } = require('./lib/director');
const { createChatHandler } = require('./lib/chat');
const { createSuggestionHandler } = require('./lib/suggest');
const { createAutoStart } = require('./lib/auto-start');

const channel = process.env.TWITCH_CHANNEL?.replace(/^#/, '').trim() || '';
const store = createStore(process.env.DATABASE_PATH || path.join(__dirname, 'data', 'challenges.sqlite'), { channel });
const director = createDirector({ store, generate: process.env.OPENAI_API_KEY ? openAiGenerator(process.env.OPENAI_API_KEY) : null });

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const publicState = () => store.state();
let auto;
const broadcast = () => { io.emit('state', publicState()); auto?.schedule(); };
auto = createAutoStart({ store, onChange: broadcast });
auto.schedule();
store.onChange = broadcast;

app.disable('x-powered-by');
app.use((_req, res, next) => { res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' }); next(); });
app.use(express.json({ limit: '4kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/overlay', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'overlay.html')));
app.get('/healthz', (_req, res) => res.json({ ok: true }));
app.get('/api/state', (_req, res) => res.json(publicState()));

app.post('/api/suggest', createSuggestionHandler({ director }));
app.post('/api/challenge/:action', (req, res) => {
  if (!['done', 'fail', 'clear'].includes(req.params.action)) return res.status(404).json({ error: 'Unknown action.' });
  if (!store.resolve(req.params.action)) return res.status(409).json({ error: 'There is no active challenge.' });
  broadcast(); res.json({ ok: true });
});
app.post('/api/queue/start-most-voted', (_req, res) => { const error = store.startMostVoted(); if (error) return res.status(409).json({ error }); broadcast(); res.json({ ok: true }); });
app.post('/api/queue/auto', (req, res) => { if (!store.setAutoStart(req.body?.enabled)) return res.status(400).json({ error: 'Choose on or off.' }); broadcast(); res.json({ ok: true }); });
app.post('/api/queue/:id/start', (req, res) => {
  const error = store.startQueued(req.params.id);
  if (error) return res.status(409).json({ error });
  broadcast(); res.json({ ok: true });
});
app.post('/api/queue/:id/remove', (req, res) => {
  if (!store.removeQueued(req.params.id)) return res.status(404).json({ error: 'Queued challenge not found.' });
  broadcast(); res.json({ ok: true });
});
app.post('/api/overlay/theme', (req, res) => {
  if (!store.setTheme(req.body?.theme)) return res.status(400).json({ error: 'Unknown theme.' });
  broadcast(); res.json({ ok: true });
});
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));
// Bad JSON and similar should answer with JSON, not an HTML error page.
app.use((err, _req, res, _next) => { const status = err.status || 500; if (status >= 500) console.error(err); res.status(status).json({ error: status >= 500 ? 'Something went wrong.' : 'Bad request.' }); });

io.on('connection', socket => socket.emit('state', publicState()));

let client;
if (channel && process.env.TWITCH_BOT_USERNAME && process.env.TWITCH_OAUTH && process.env.TWITCH_OAUTH !== 'oauth:') {
  client = new tmi.Client({ options: { debug: false }, connection: { reconnect: true, secure: true }, identity: { username: process.env.TWITCH_BOT_USERNAME, password: process.env.TWITCH_OAUTH }, channels: [channel] });
  client.on('connected', () => { store.flags.twitchConnected = true; broadcast(); console.log(`Twitch connected to #${channel}`); });
  client.on('disconnected', reason => { store.flags.twitchConnected = false; broadcast(); console.warn('Twitch disconnected:', reason); });
  const say = message => client.say(channel, message).catch(err => console.error('Twitch message failed:', err.message));
  const handle = createChatHandler({ store, director, say, onChange: broadcast });
  client.on('message', (_channel, tags, message, self) => { if (!self) handle(tags, message).catch(err => console.error('Chat handler:', err.message)); });
  client.connect().catch(err => { store.flags.twitchConnected = false; broadcast(); console.error('Twitch connection failed:', err.message); });
} else console.log('Twitch is not configured. Set TWITCH_CHANNEL, TWITCH_BOT_USERNAME and TWITCH_OAUTH in .env.');

const port = Number(process.env.PORT) || 3000;
server.listen(port, () => console.log(`LiveDares running at http://localhost:${port}`));

// Railway stops the old container on every deploy: close cleanly so the database is never cut mid-write.
function shutdown() {
  auto.close();
  client?.disconnect().catch(() => {});
  io.close(); server.close(() => { try { store.close(); } catch {} process.exit(0); });
  setTimeout(() => process.exit(0), 4000).unref();
}
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
