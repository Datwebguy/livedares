'use strict';
const { UserError } = require('./director');
function createSuggestionHandler({ director, now = Date.now, cooldownMs = 40000 }) {
  const ips = new Map();
  return async (req, res) => {
    const { name, idea } = req.body || {};
    if (typeof name !== 'string' || !/^[A-Za-z0-9_]{1,25}$/.test(name)) return res.status(400).json({ error: 'Enter a name using 1 to 25 letters, numbers or underscores.' });
    if (typeof idea !== 'string' || !idea.trim() || idea.length > 400) return res.status(400).json({ error: 'Enter an idea of up to 400 characters.' });
    const time = now(); for (const [ip, at] of ips) if (time - at >= cooldownMs) ips.delete(ip);
    if (ips.has(req.ip)) return res.status(429).json({ error: 'Please wait before sending another idea.' });
    ips.set(req.ip, time);
    try { const challenge = await director.suggest(idea.trim(), name); res.json({ message: challenge.status === 'active' ? 'Your dare is live.' : 'Your dare is in the queue.' }); }
    catch (err) { if (err instanceof UserError && err.message.includes('OPENAI_API_KEY')) ips.delete(req.ip); res.status(err instanceof UserError ? 400 : 503).json({ error: err instanceof UserError && !err.message.includes('OPENAI_API_KEY') ? err.message : 'Dares are unavailable right now. Please try again later.' }); }
  };
}
module.exports = { createSuggestionHandler };
