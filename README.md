# AI Challenge Director

A Twitch chat-powered challenge director for streamers. Viewers submit ideas, GPT-4o-mini turns them into short, safety-screened challenges, and the broadcaster or moderators decide the outcome. The dashboard and OBS overlay update live. Completed challenges award **100 points to the viewer who suggested them**. Challenges and scores persist in SQLite.

## Requirements

- Node.js 20 or newer and npm (a C++ build toolchain may be needed if a prebuilt better-sqlite3 binary is unavailable)
- An OpenAI API key with access to `gpt-4o-mini`
- A Twitch account for the bot and a Twitch channel

## Setup

1. Run `npm install`.
2. Copy `.env.example` to `.env` and fill in `OPENAI_API_KEY`, `TWITCH_CHANNEL` (channel name without `#`), `TWITCH_BOT_USERNAME`, and `TWITCH_OAUTH`.
3. Run `npm start` and open http://localhost:3000.

The app creates `data/challenges.sqlite` automatically. Set `DATABASE_PATH` to change its location and back up this file to preserve your history and scores. The timer counts down from challenge creation; reaching zero displays “TIME IS UP”, and the streamer still decides whether it was completed or failed. Active challenges survive restarts, including their original deadline.

### Get a Twitch OAuth token

Use a Twitch account for your bot. Generate a **user access token** for that account with the `chat:read` and `chat:edit` scopes using Twitch's [OAuth authorization flow](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/) or a trusted Twitch chat token generator. Set `TWITCH_BOT_USERNAME` to that account's login name and `TWITCH_OAUTH` to `oauth:YOUR_ACCESS_TOKEN` (include the `oauth:` prefix). Set `TWITCH_CHANNEL` to the streamer's login name. Keep the token and `.env` private. If Twitch rejects the connection, check the token's scopes, account, expiration, and prefix.

## OBS setup

In OBS, add a **Browser Source**, set its URL to `http://localhost:3000/overlay`, and choose a width of 1920 and height of 1080. Resize/crop the source as needed. The page background is transparent around the overlay. If OBS runs on a different machine, replace `localhost` with the server machine's reachable address and allow the port through your firewall.

## Test with real Twitch chat

1. Start the server with valid Twitch and OpenAI credentials. The dashboard should show **Twitch connected**.
2. In the configured channel's chat, have a viewer send `!challenge do a victory dance`. The bot replies with the generated challenge; it appears on the dashboard and overlay.
3. Use **Mark done** in the dashboard, or have the broadcaster or a moderator send `!done`. The viewer who suggested it receives 100 points, visible on both pages. `!fail` marks it failed without awarding points; `!clear` removes it without awarding points. Only the broadcaster and moderators can use these three chat commands.
4. Suggest another challenge and try the other controls. Restart the app to confirm scores and any active challenge persist.

Only one challenge can be active at a time. Suggestions are rejected while one is active or another is being generated. Unsafe or malformed AI responses are rejected. Chat suggestions are untrusted; the AI safety check is a best-effort filter and the streamer should supervise the stream.

## Network access

This hackathon build has no user accounts or login. Anyone who can reach the dashboard can operate its controls, so run it on a trusted machine/network and do not expose it publicly without adding access controls. The overlay and Socket.IO connection share the same server and port. Real Twitch and OpenAI credentials are required for chat and challenge generation; no simulated data is provided.
