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
