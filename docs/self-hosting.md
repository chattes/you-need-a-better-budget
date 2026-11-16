# Self-hosting YNBB

YNBB is a static web app. A container only serves files. It does not store your budget. Your data goes to your own Google Sheet and to your browser.

This guide covers Docker and Docker Compose. For a local development setup, see the [README](../README.md).

## What you need

- Docker with Compose (Docker Desktop, or `docker` and `docker compose` on Linux).
- A Google OAuth client ID for the address where you will open the app. Follow [google-client-id.md](google-client-id.md). You can skip this step if you only want offline use.

## Option A: Docker Compose (recommended)

The repository includes `docker-compose.yml`.

```bash
git clone https://github.com/chattes/you-need-a-better-budget.git
cd you-need-a-better-budget
GOOGLE_CLIENT_ID=your-id.apps.googleusercontent.com docker compose up -d
```

Open http://localhost:8080.

To stop it:

```bash
docker compose down
```

To update after a new version:

```bash
git pull
docker compose up -d --build
```

## Option B: docker run

Build the image once:

```bash
docker build -t you-need-a-better-budget .
```

Run it:

```bash
docker run -d --name ynbb -p 8080:8080 \
  -e GOOGLE_CLIENT_ID=your-id.apps.googleusercontent.com \
  --restart unless-stopped \
  you-need-a-better-budget
```

Omit `-e GOOGLE_CLIENT_ID=...` if you want to paste the client ID in **Settings** instead.

Once a version is published, you can also pull the prebuilt image (amd64 and arm64):

```bash
docker pull ghcr.io/chattes/you-need-a-better-budget:latest
```

## Environment variables

| Variable | Required | Default | What it does |
|----------|----------|---------|--------------|
| `GOOGLE_CLIENT_ID` | No | empty | Google OAuth client ID. Written to `config.js` when the container starts. Letters, digits, `.`, `-` and `_` only; other values are ignored and a message is printed to the log. |

The container listens on port **8080** inside. Change the host side of the port mapping if 8080 is taken, for example `-p 3000:8080`.

Changing `GOOGLE_CLIENT_ID` needs a container restart (`docker compose up -d` or `docker restart ynbb`).

## How the client ID is picked

1. The value from `GOOGLE_CLIENT_ID` (through `config.js`).
2. A value built into the app (only for builds made with `VITE_GOOGLE_CLIENT_ID`).
3. A value pasted in **Settings > Google client ID**. This is saved in the browser's local storage on that device only.

If you set `GOOGLE_CLIENT_ID`, the Settings field shows that the server sets it, and you cannot change it there.

## HTTPS: Google sign-in needs a secure address

Google sign-in works only on:

- `https://` addresses, and
- `http://localhost`.

A plain `http://` address with an IP number (for example `http://192.168.1.20:8080`) will **not** work. Google blocks sign-in there. Put the app behind HTTPS. Two simple options:

### Caddy (needs a domain name)

Point a domain name at your server, then use this `Caddyfile`:

```
budget.example.com {
    reverse_proxy localhost:8080
}
```

Caddy gets a certificate automatically. Use `https://budget.example.com` as your origin in Google Cloud.

### Tailscale Serve (no public domain needed)

Install Tailscale on the machine that runs the container and turn on HTTPS for your tailnet in the Tailscale admin console. Then run:

```bash
tailscale serve --bg 8080
```

Tailscale prints an `https://<machine>.<tailnet>.ts.net` address. Use that address as your origin in Google Cloud. Only devices on your tailnet can open it.

Either way, the address you open in the browser must match the **Authorized JavaScript origins** in your Google OAuth client exactly, including `https://` and the port if there is one.

## Keeping data safe

- The container has no data to back up. Your budget is in your Google Sheet and in each browser.
- Keep the Google Sheet in your Drive. Deleting it deletes your budget data.
- The sheet is private to your Google account unless you share it with someone.

## Troubleshooting

- **"Sync not set up" in Settings:** no client ID was found. Set `GOOGLE_CLIENT_ID`, or paste the ID in Settings.
- **Google shows "origin_mismatch":** the address in your browser is not in **Authorized JavaScript origins**. Add it exactly, with `https://` (or `http://localhost:8080` for local use).
- **Google shows "Access blocked" or "not verified":** add your Google account under **Test users** on the OAuth consent screen. See [google-client-id.md](google-client-id.md).
- **Warning in `docker logs` about invalid characters:** `GOOGLE_CLIENT_ID` contains a character that is not allowed. Copy the ID again from Google Cloud.
