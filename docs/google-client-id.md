# Create a Google client ID for YNBB

YNBB signs you in with Google so it can create and edit a budget spreadsheet in **your** Google Drive. To do that, the app needs an OAuth client ID from a Google Cloud project that you control. You only do this once. Google's menus change now and then, so the names below may differ slightly.

You need:

- A Google account.
- The address where you will open the app, for example `http://localhost:8080` or `https://budget.example.com`. Google sign-in works only on `https://` addresses and on `http://localhost`.

## 1. Create a Google Cloud project

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Choose the project menu, then **New project**.
3. Name it, for example `YNBB`, and create it.
4. Make sure the new project is selected.

## 2. Turn on the two APIs

1. Go to **APIs & Services > Library**.
2. Search for **Google Sheets API** and click **Enable**.
3. Search for **Google Drive API** and click **Enable**.

## 3. Set up the OAuth consent screen

1. Go to **APIs & Services > OAuth consent screen** (or **Google Auth Platform**).
2. Choose **User type: External**, then continue.
3. Fill in:
   - **App name:** `You Need a Better Budget` (or your own name for it).
   - **User support email:** your email.
   - **Developer contact email:** your email.
4. On the **Scopes** step, add only this scope:
   - `https://www.googleapis.com/auth/drive.file`
5. On the **Test users** step, add your own Google account. Add any other people who will use the app.
6. Keep the publishing status at **Testing**.

Notes on Testing mode:

- Testing mode allows up to **100 test users**. Only those accounts can sign in.
- Testing is free and needs no Google review, so it is the right choice for personal use.
- To let anyone sign in, you must **publish** the app. Publishing needs Google's brand verification and a domain that you own. Verification is a separate process that Google runs. It is not needed for personal use.

## 4. Create the OAuth client ID

1. Go to **APIs & Services > Credentials**.
2. Click **Create credentials > OAuth client ID**.
3. Set **Application type** to **Web application**.
4. Name it, for example `YNBB Web`.
5. Under **Authorized JavaScript origins**, add each address you will open the app from. An origin is the scheme, host and port, with no path and no trailing slash. Examples:
   - `http://localhost:8080` (Docker on this machine)
   - `http://localhost:5173` (local development with `npm run dev`)
   - `https://budget.example.com` (your own domain)
6. Leave **Authorized redirect URIs** empty. YNBB uses a sign-in popup, so it does not need a redirect URI.
7. Click **Create**. Copy the **Client ID**. It looks like `123456789-abc123.apps.googleusercontent.com`.

Do not use the client secret. YNBB never needs it.

## 5. Give the client ID to YNBB

Use one of these ways:

- **Docker:** set `GOOGLE_CLIENT_ID` when you start the container.

  ```bash
  GOOGLE_CLIENT_ID=123456789-abc123.apps.googleusercontent.com docker compose up -d
  ```

- **Settings in the app:** open **Settings > Google client ID**, paste the ID and save. This is stored in the browser on this device only.
- **Local development:** add `VITE_GOOGLE_CLIENT_ID=...` to `.env.local` in the project folder, then restart `npm run dev`.

See [self-hosting.md](self-hosting.md) for the full list.

## 6. Sign in

1. Open the app and go to **Settings > Data source**.
2. Click **Connect Google Sheet**.
3. Choose your Google account. Allow the Drive permission for files the app creates.
4. YNBB creates a spreadsheet named **YNBB Budget** in your Drive.

## If sign-in fails

- **`origin_mismatch` or `redirect_uri_mismatch`:** the address in the browser is not in **Authorized JavaScript origins**. Add it exactly and wait a few minutes for Google to apply the change.
- **"Access blocked" or "This app isn't verified":** your Google account is not in **Test users**. Add it on the OAuth consent screen.
- **"Sync not set up":** no client ID was found. Check step 5.
