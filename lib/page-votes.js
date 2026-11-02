'use strict';
function createPageVotes({ store, clientIp, onChange = () => {}, now = Date.now, cooldownMs = 1000 }) {
  const recent = new Map();
  const voter = req => store.pageVoter(clientIp(req));
  function get(req, res) { res.set('Cache-Control', 'no-store').json({ challengeId: store.myVote(voter(req)) }); }
  function post(req, res) {
    const id = req.params.id;
    if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) return res.status(400).json({ error: 'Choose a dare from the queue.' });
    const key = voter(req), time = now();
    for (const [k, v] of recent) if (time - v >= cooldownMs) recent.delete(k);
    if (recent.has(key)) return res.status(429).json({ error: 'Please wait a moment before voting again.' });
    if (!store.voteForId(key, Number(id))) return res.status(404).json({ error: 'That dare is no longer waiting.' });
    recent.set(key, time); onChange(); return res.json({ challengeId: Number(id) });
  }
  return { get, post };
}
module.exports = { createPageVotes };
