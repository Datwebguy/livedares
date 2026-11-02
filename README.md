# LiveDares

Turn Twitch chat ideas into live challenges. A viewer types `!challenge <idea>`; OpenAI's `gpt-4o-mini` shapes it into a short, safety-screened dare. It appears on the dashboard and OBS overlay. The streamer decides whether it was completed; the viewer who suggested a completed dare earns **100 points**. SQLite persists the queue, history, leaderboard, active deadline and overlay theme. There is no demo data or simulated chat in the running app.

This is a **single-channel** app: one installation connects to one Twitch channel. It has no login. Anyone who can reach the dashboard can control the stream's challenges, so keep the dashboard on a trusted network or put access protection in front of it before exposing it publicly. The overlay itself does not need a login.

## What you need

- Node.js 20 or newer and npm. `better-sqlite3` may need a C++ build toolchain if a prebuilt binary is unavailable.
- An [OpenAI API key](https://platform.openai.com/api-keys) with billing enabled and access to `gpt-4o-mini`.
- A Twitch channel, and a Twitch user account to post bot replies. You can use the streamer account or a separate Twitch account.
- A Twitch **user access token** for that bot account with `chat:read` and `chat:edit` scopes.

## Get a Twitch chat token

1. Sign in to Twitch as the account that will post the bot's replies. That account's login name is `TWITCH_BOT_USERNAME`.
2. Obtain a Twitch **user access token** with both `chat:read` and `chat:edit`. Use Twitch's [official OAuth instructions](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/) or a trusted third-party chat token generator such as [Twitch Chat OAuth Password Generator](https://twitchapps.com/tmi/). Third-party generators receive authorization to your Twitch account; review the requested permissions before approving.
3. Copy the access token. The app expects `oauth:` followed immediately by the token, with no spaces. Do not use a refresh token or client ID as the password.
4. Keep the token private. If it is exposed, revoke the generator's access in [Twitch Connections](https://www.twitch.tv/settings/connections) and generate a new token. Tokens can expire; replace the variable if Twitch rejects it.

## Run locally

1. Clone this repository, open a terminal in it, and install dependencies:
   ```sh
   npm install
   cp .env.example .env
   ```
2. Edit `.env` with your real values:
   ```dotenv
   OPENAI_API_KEY=your_openai_api_key
   TWITCH_CHANNEL=your_stream_channel_login
   TWITCH_BOT_USERNAME=your_bot_account_login
   TWITCH_OAUTH=oauth:your_twitch_access_token
   PORT=3000
   ```
   The channel and bot names are Twitch login names, without `#` or a URL. If the bot is your streamer account, both names can be the same.
3. Run `npm start`. Open [http://localhost:3000](http://localhost:3000). The status should say **Connected to Twitch**. If it does not, inspect the terminal for connection errors and check the token, scopes, account and names.
4. Open [http://localhost:3000/overlay](http://localhost:3000/overlay) to view the OBS source.

The app automatically creates `data/challenges.sqlite`. Set `DATABASE_PATH` to choose another location. For Railway or another container host, mount persistent storage (for example at `/data`) and set `DATABASE_PATH=/data/challenges.sqlite`; otherwise redeployment may erase data. Back up the database, including its WAL files while the app is running, or stop the app before copying the database.

## How the queue works

The first accepted idea starts immediately when nothing is active. Further safe ideas go into the queue, up to 20. Each viewer can submit one idea every 40 seconds; one OpenAI request is processed at a time, so viewers may be asked to retry if another idea is being processed. The cooldown is in memory and resets on restart. The streamer selects **Start** on any queued dare after resolving or clearing the current one. The countdown starts when the dare is activated. When it reaches zero, the streamer still decides the result; it does not automatically fail.

`!done`, `!fail`, and `!clear` are available to the broadcaster and moderators. Dashboard buttons do the same. Only `!done` awards points, to the original suggester. Streamer controls also let you remove a queued item. AI checks are best effort; the streamer should review challenges before performing them.

## Add the overlay in OBS

1. Start the app and confirm the dashboard is reachable from the machine running OBS.
2. In OBS, select **Sources → + → Browser**, name it LiveDares, and select **OK**.
3. Set the URL to `http://localhost:3000/overlay` if OBS runs on the same machine. If the app is hosted elsewhere, use its HTTPS URL followed by `/overlay`.
4. Set **Width: 1920** and **Height: 1080**, then select **OK**. Resize or crop the source in OBS as needed. The background outside the overlay is transparent.
5. On the dashboard, select **Midnight lime**, **Ember orange**, or **Studio white** under OBS overlay theme. Connected overlays update immediately and the selection survives a restart.

## Test with real Twitch chat

1. Verify the dashboard says **Connected to Twitch**. Open the overlay in another browser tab or in OBS.
2. In the configured Twitch channel's real chat, send `!challenge do a victory dance`. Wait for the bot reply and verify the title, description and running timer appear on the dashboard and overlay. If the bot ignores messages from its own account, use another Twitch account to submit.
3. While it is active, have a viewer send another `!challenge` idea. If using the same viewer, wait 40 seconds first. Confirm the idea appears in the dashboard queue.
4. Mark the first dare **Done**, or send `!done` as broadcaster or moderator. Confirm the suggester gains 100 points on the dashboard and overlay. Start the queued dare; then mark it **Failed** and confirm no points are awarded.
5. Change the overlay theme and confirm it changes in OBS. Restart the server and confirm the leaderboard, history, queue and selected theme remain.

## How to demo

Show chat and the dashboard together. Ask a viewer for an idea, point out the AI-generated dare on the OBS overlay, then ask for a second idea while the first is running. Mark the first done to show the viewer's score and recent history, select the next queued idea, and switch overlay themes live. Explain that the streamer has final control and the queue is rate-limited.

## Credits

The flowing background clip is a free stock video from [Mixkit](https://mixkit.co/free-stock-video/abstract-red-fabric-flowing-282/), used under the [Mixkit License](https://mixkit.co/license/#videoFree).

## Project layout and tests

- `server.js` wires the web server, live updates and Twitch chat together.
- `lib/store.js` holds everything that touches SQLite (challenges, queue, scores, theme).
- `lib/director.js` turns a viewer's idea into a challenge. The AI call is passed in, so tests run without the network.
- `lib/chat.js` reads chat commands and decides who may use them.
- `GET /healthz` answers `{ "ok": true }` for deploy health checks.

Run `npm test`. It checks scoring, the queue order, cooldowns, unsafe or malformed AI answers, who may use chat commands, restarts and clean shutdown.

## Page suggestions and chat voting

Anyone opening the dashboard can submit an idea using **Suggest a dare** and a name containing 1–25 letters, numbers or underscores. OpenAI must be configured on the server; Twitch is optional. Page and chat ideas share the same safety checks, queue and name cooldown. Page requests also have an address cooldown.

Viewers can use `!vote 1`, `!vote 2`, or `!vote 3` to vote for a position in the queue; voting again replaces their previous vote. The dashboard can start the most-voted dare, or automatically start it after a short pause. Votes and the automatic-start setting persist. `!queue`, `!leaderboard`, and `!rank` show chat summaries.

OpenAI moderation checks each idea before generation. If moderation is unavailable, the existing generation safety check still applies. If both optional `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` are configured, the app uses Twitch's app access flow to add the live game's name and stream title as untrusted context. [Register a Twitch application](https://dev.twitch.tv/console/apps) to obtain those two values. The feature remains off if either is missing.

## What is verified

The HTTP tests cover direct and forwarded address handling, vote replacement, separation from chat votes, persistence, removal and stored-address checks. Chromium checks at 360 and 1366 pixels used a local injected generator to submit an idea, vote, move the vote, reload, switch themes and check the overlay. Real proxy-header behavior and the voting flow still need a live multi-visitor Railway rehearsal.

- Automated tests cover the existing challenge flow, page input and cooldown, voting and persistence, automatic start, optional Twitch context using injected responses, moderation using injected responses, chat summaries and result values. Run `npm test` with Node 20.
- Chromium was used at 360 and 1366 pixels to check the dashboard and overlay, the theme toggle, horizontal overflow, and page errors. With no local OpenAI key, the page form’s unavailable-service message was checked. A separate isolated browser test used injected generation and chat calls to exercise suggestion, voting, overlay updates and scoring at both widths; it did not call the real services.
- Earlier in this project, a real Twitch chat message produced a dare through OpenAI. The newer page suggestion, votes, moderation, game context, and result overlay have not yet been verified end to end against real Twitch, OpenAI and OBS. Real game-context testing requires the optional Twitch application credentials.

Additional modules: `lib/suggest.js` validates page submissions, `lib/auto-start.js` schedules the next dare, and `lib/twitch-context.js` fetches optional game context. `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` are optional; see `.env.example` for all configuration.

## Page votes and proxy settings

Select **Vote** beside a waiting dare. Selecting another moves the vote; **Voted** stays visible after a reload. Page votes and chat votes count together. The server stores a salted one-way identifier for each page voter, not their address. People sharing an internet connection may share a page vote and rate limit.

Railway deployments use its documented `X-Real-IP` header and the automatically supplied service identity. Local deployments ignore forwarded headers by default. If running behind a different trusted reverse proxy, set the optional `TRUST_PROXY` to the number of trusted proxy hops; use `0` for direct connections. Only set this when those proxies are under your control: an incorrect hop count can let visitors forge their address. Railway's documentation identifies the client-address header and describes its edge proxy, but does not specify a general fixed hop count for every configuration. See [public networking specifications](https://docs.railway.com/networking/public-networking/specs-and-limits) and [edge networking](https://docs.railway.com/networking/edge-networking).
