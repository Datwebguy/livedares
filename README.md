# LiveDares

**Turn chat’s ideas into challenges on stream.** LiveDares takes an idea from Twitch chat or the dashboard, shapes it into a short dare with OpenAI, and displays it on a live dashboard and an OBS overlay. The streamer decides the outcome; a completed dare earns its suggester 100 points.

[Open LiveDares](https://livedare.up.railway.app/) · [Open the OBS overlay](https://livedare.up.railway.app/overlay) · [Submission notes](SUBMISSION.md) · [Video plan](VIDEO.md)

LiveDares is a single-channel hackathon app. Viewers can use the page without an account, or participate in Twitch chat when a channel is connected. The app has no streamer login: **anyone who can reach the dashboard can operate its controls**.

## How it works

1. A viewer submits an idea on the page or sends `!challenge` followed by an idea in Twitch chat.
2. OpenAI checks the idea and turns it into a short challenge. The first challenge starts immediately; later ideas join the queue.
3. Viewers vote on queued dares on the page or with `!vote 1`, `!vote 2`, or `!vote 3` in chat. The streamer can pick a dare or turn on automatic selection of the most-voted one.
4. The dashboard and OBS overlay update live. The streamer marks the dare done or failed; the leaderboard and recent history persist in SQLite.

Dares can be suggested once every 40 seconds per viewer, and page submissions also have an address cooldown. The queue holds up to 20 waiting ideas. The countdown does not automatically decide the result. The streamer should review each dare before performing it: safety checks are best effort.

## Try the live app

Open the [dashboard](https://livedare.up.railway.app/), enter your name and an idea under **Suggest a dare**, and select **Send idea**. Open the [overlay](https://livedare.up.railway.app/overlay) in a second tab to see the stream view. When a dare is active, use **Done** or **Failed** on the dashboard.

For a guided presentation, see the [submission notes](SUBMISSION.md) and the [video plan](VIDEO.md).

## Run locally

You need Node.js 20 or newer, npm, and an [OpenAI API key](https://platform.openai.com/api-keys) with billing enabled and access to `gpt-4o-mini`. The dashboard and overlay run without Twitch credentials; Twitch chat and automatic game detection are optional. If a prebuilt `better-sqlite3` binary is unavailable, a C++ build toolchain may be needed.

```sh
git clone https://github.com/Datwebguy/livedares.git
cd livedares
npm install
cp .env.example .env
```

Open `.env` and set `OPENAI_API_KEY`. Then start the app:

```sh
npm start
```

Visit [http://localhost:3000](http://localhost:3000) for the dashboard and [http://localhost:3000/overlay](http://localhost:3000/overlay) for the overlay. The app starts without an OpenAI key, but cannot generate dares until one is configured.

## Connect Twitch chat

1. Choose the Twitch account that will post bot replies. This can be the streamer’s existing account or a separate account.
2. While signed in as that account, obtain a **user access token** with `chat:read` and `chat:edit` using [Twitch’s OAuth instructions](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/) or a trusted third-party tool such as [Twitch Chat OAuth Password Generator](https://twitchapps.com/tmi/). Review the permissions before authorizing a third party.
3. Set `TWITCH_CHANNEL` to the streamer’s Twitch login name, `TWITCH_BOT_USERNAME` to the bot account’s login name, and `TWITCH_OAUTH` to `oauth:` followed immediately by the access token. Use login names without `#` or a URL; do not use a refresh token or client ID as the chat password.
4. Restart the app. The dashboard should show **Connected to Twitch**. Keep the token private; if it is exposed, revoke access in [Twitch Connections](https://www.twitch.tv/settings/connections) and obtain a new token.

The broadcaster and moderators can use `!done`, `!fail`, and `!clear`. `!queue`, `!leaderboard`, and `!rank` provide chat summaries. If the bot ignores messages sent by its own account, use another account to test chat.

## Add the overlay to OBS

1. In OBS, choose **Sources → + → Browser** and give the source a name.
2. Set its URL to `http://localhost:3000/overlay` if OBS and the app run on the same computer. For the hosted app, use `https://livedare.up.railway.app/overlay`.
3. Set **Width** to `1920` and **Height** to `1080`, then select **OK**. Place the browser source above the game or camera source. The background around the overlay is transparent.
4. Select an overlay theme on the dashboard. Connected overlays update live, and the choice survives a restart.

Use **What are you playing?** on the dashboard to save a game name for the overlay and challenge generation. If optional Twitch application credentials are configured and Twitch reports a live game, that game takes priority.

## Configuration and persistence

Set values in `.env` locally or in your host’s environment settings. Never commit credentials.

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Enables real idea moderation and dare generation. |
| `TWITCH_CHANNEL` | Twitch channel login name; optional. |
| `TWITCH_BOT_USERNAME` | Account that posts bot replies; optional. |
| `TWITCH_OAUTH` | Bot account’s chat token with the `oauth:` prefix; optional. |
| `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` | Optional application credentials for live game context; [register an application](https://dev.twitch.tv/console/apps) to obtain them. |
| `PORT` | Web server port; defaults to `3000`. |
| `DATABASE_PATH` | SQLite file path; defaults to `data/challenges.sqlite`. |
| `TRUST_PROXY` | Optional number of trusted proxy hops; direct local requests ignore forwarded headers by default. |
| `PUBLIC_URL` | Optional public address used in link previews. |

For a container host, attach persistent storage and set `DATABASE_PATH` to a file on that volume; otherwise a redeployment may erase data. Back up SQLite with its WAL files, or stop the app before copying the database.

Page votes use a salted one-way identifier, not a stored visitor address. People sharing a connection may share a page vote and cooldown. Railway uses its documented `X-Real-IP` header. For a different reverse proxy, set `TRUST_PROXY` only to the number of proxies you control; an incorrect value can allow forged addresses. See Railway’s [public networking specifications](https://docs.railway.com/networking/public-networking/specs-and-limits) and [edge networking documentation](https://docs.railway.com/networking/edge-networking).

## Project layout

| Path | Purpose |
| --- | --- |
| `server.js` | Connects the web server, live updates, and optional Twitch bot. |
| `lib/store.js` | SQLite storage for challenges, scores, votes, and settings. |
| `lib/director.js` | OpenAI generation and moderation flow. |
| `lib/chat.js` | Twitch chat commands. |
| `lib/suggest.js`, `lib/page-votes.js`, `lib/client-ip.js` | Page participation and address handling. |
| `lib/auto-start.js`, `lib/twitch-context.js` | Optional queue automation and game context. |
| `public/` | Dashboard, overlay, styles, and assets. |
| `test/` | Automated tests with isolated data and injected service calls. |

Run the tests with `npm test`. `GET /healthz` returns `{"ok":true}` when the server is running.

## What is verified

- The automated suite covers challenge handling, input validation, cooldowns, moderation, queue and vote persistence, automatic start, proxy handling, overlay result values, and manual game settings. Tests were last run with Node 20.
- Chromium checks at 360px and 1366px exercised the dashboard, themes and overlay. An isolated browser run with injected services tested page suggestion, voting and scoring. Manual game save, reload, clear, and overlay updates were checked on a local server.
- Earlier in the project, a real Twitch chat message produced a dare through OpenAI. The newer page voting, moderation, game context and result overlay have not been verified together against real Twitch, OpenAI and OBS. A live multi-visitor Railway rehearsal is still needed for proxy behavior and page votes.

## Credits

The flowing background clip is a free stock video from [Mixkit](https://mixkit.co/free-stock-video/abstract-red-fabric-flowing-282/), used under the [Mixkit License](https://mixkit.co/license/#videoFree).
