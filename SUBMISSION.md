# LiveDares

LiveDares turns viewer ideas into short on-stream challenges. Chat and the dashboard share one queue. The streamer decides the outcome, and a completed challenge awards points to the person who suggested it.

## Features

- Live Twitch chat and page suggestions, with moderation and per-person cooldowns.
- A queue with chat votes, manual selection and optional automatic start.
- A live dashboard, persistent leaderboard and recent challenges.
- A transparent OBS overlay with three themes, a countdown, votes and results.
- Optional game-aware challenges using Twitch stream information.

## How OpenAI Codex was used

OpenAI Codex helped build and revise the Node application, its Twitch and OpenAI integrations, the dashboard and OBS overlay, and automated tests. The project was reviewed and iterated during a conversation with the owner; the real Twitch-to-OpenAI challenge creation was tested in the owner's channel.

Codex session ID: unavailable in this environment. The `/status` command is not available here, so the ID needs to be obtained from the session interface before submission.

## Try it in 60 seconds

Open https://livedare.up.railway.app/ . Under **Suggest a dare**, enter your name and idea, then select **Send idea**. Watch the countdown, select **Done**, and see the points and recent history. No account is required to use the page. The hosted service must have a working OpenAI key configured. Open https://livedare.up.railway.app/overlay in a second tab to see the broadcast view.

## Run locally and connect Twitch and OBS

Follow the [README](README.md) for Node setup, environment variables, Twitch chat credentials, and the OBS Browser Source steps. The Twitch app client ID and secret are optional and only enable game context. A separate Twitch account can be used as a chat bot, or the streamer's existing account can be used.
