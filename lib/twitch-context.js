'use strict';
function createTwitchContext({ clientId, clientSecret, channel, fetchFn = fetch, now = Date.now }) {
 let token, tokenUntil = 0, value = null, checkedUntil = 0, pending;
 async function get() {
  if (!clientId || !clientSecret || !channel) return null;
  if (now() < checkedUntil) return value;
  if (pending) return pending;
  pending = (async () => { try {
   if (!token || now() >= tokenUntil) {
    const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' });
    const auth = await fetchFn('https://id.twitch.tv/oauth2/token', { method: 'POST', body }); if (!auth.ok) throw Error('Unavailable');
    const data = await auth.json(); if (!data.access_token) throw Error('Unavailable'); token = data.access_token; tokenUntil = now() + Math.max(0, (data.expires_in - 60) * 1000);
   }
   const response = await fetchFn(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(channel)}`, { headers: { 'Client-Id': clientId, Authorization: `Bearer ${token}` } });
   if (!response.ok) { if (response.status === 401) token = null; throw Error('Unavailable'); }
   const data = await response.json(), stream = data.data?.[0];
   value = stream ? { game: String(stream.game_name || '').slice(0, 100), title: String(stream.title || '').slice(0, 200) } : null;
  } catch { value = null; } finally { checkedUntil = now() + 60000; } return value; })();
  try { return await pending; } finally { pending = null; }
 }
 return { get };
}
module.exports = { createTwitchContext };
