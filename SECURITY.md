# Security policy

## Reporting a vulnerability

Please report security issues privately through GitHub's
[security advisories](https://github.com/Datwebguy/livedares/security/advisories/new)
rather than opening a public issue. Include steps to reproduce and the affected version.

## Deployment notes

- LiveDares has no streamer login. Anyone who can reach the dashboard can control dares, so keep it on a trusted network or put access protection in front of it.
- Keep `OPENAI_API_KEY` and `TWITCH_OAUTH` out of the repository; use environment variables or your host's secret store.
- Only set `TRUST_PROXY` for reverse proxies you control.
