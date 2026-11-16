# You Need a Better Budget (YNBB)

A free, open-source budgeting app that runs in your browser. Your data lives in a Google Sheet that **you** own. There is no server to sign up for and no account to create with us.

- **Free and open source** under the MIT license.
- **Browser only.** It is a static web app. Nothing runs on a server we control.
- **Your data stays yours.** It lives in your own Google Sheet and in your browser.
- **Works offline.** The app keeps a local copy in IndexedDB and syncs when you connect.

## Screenshots

_Screenshot placeholder: Dashboard_

_Screenshot placeholder: Budget (assign money to categories)_

_Screenshot placeholder: Activity (transactions and CSV import/export)_

_Screenshot placeholder: Reports and Net Worth_

## Features

- **Budget:** plan a monthly income, set a target for each category, and see what is left to assign.
- **Activity:** add income, expenses, refunds and transfers. Split one transaction across categories. Import and export CSV files.
- **Accounts:** track cash, bank and credit accounts, with a register page for each one.
- **Credit cards:** each card has a payment category, so you can see whether the card bill is covered.
- **Goals:** savings and debt goals with a projected completion month.
- **Calendar and subscriptions:** see scheduled and recurring payments.
- **Reports:** spending by group, cash flow over time, and trouble spots.
- **Net worth:** assets, liabilities, and a trend chart. Save snapshots over time.
- **Sample data:** try the app with example data, then clear it with one click.
- **Light and dark themes.**

## Privacy

- **No server.** The app is only HTML, CSS and JavaScript. It does not send your budget to any server operated by this project.
- **No analytics, no ads, no tracking cookies.** There is no analytics code on any page.
- **Your data is in your Google Sheet.** When you connect Google, the app creates a spreadsheet named **YNBB Budget** in your Google Drive. It only reads and writes files that it creates (the `drive.file` permission).
- **Sign-in tokens stay in memory.** The Google access token is held in memory and is never saved to local storage.

## Quick start

### Option 1: use a hosted copy

Open <https://you-need-a-better-budget.vercel.app>. Sign-in there is limited to test users until Google verification is complete; **Try with sample data** works for everyone. If you host your own copy, see [Self-hosting](docs/self-hosting.md).

### Option 2: run it with Docker

From the cloned repository folder:

```bash
GOOGLE_CLIENT_ID=your-id.apps.googleusercontent.com docker compose up -d
```

Then open http://localhost:8080. You can also leave `GOOGLE_CLIENT_ID` empty and paste the client ID in **Settings** later. Full details are in [docs/self-hosting.md](docs/self-hosting.md).

### Option 3: run it locally for development

Requires Node.js 24.

```bash
git clone https://github.com/chattes/you-need-a-better-budget.git
cd you-need-a-better-budget
npm install
npm run dev
```

Open http://localhost:5173. The app works without Google. Add a client ID only when you want Sheets sync.

## Google sign-in

Google Sheets sync needs a Google OAuth client ID. You create it once in Google Cloud. The steps are in [docs/google-client-id.md](docs/google-client-id.md).

The app looks for the client ID in this order:

1. `GOOGLE_CLIENT_ID` in the Docker container (written to `config.js` at start).
2. `VITE_GOOGLE_CLIENT_ID` at build time (for example in `.env.local`).
3. A value you paste in **Settings > Google client ID** (saved in this browser only).

Without a client ID the app still works fully offline. Only the Google sync buttons are disabled.

## Scripts

```bash
npm run dev        # Vite dev server
npm run build      # Production build into dist/
npm run preview    # Preview dist/
npm test           # Unit tests (Vitest)
npm run lint       # ESLint
npm run typecheck  # TypeScript check
npm run format     # Prettier
```

## Project layout

- `src/lib/domain/`: the budget engine. Pure TypeScript with no UI and no I/O. Money is stored as integer cents.
- `src/lib/storage/`: IndexedDB cache, Google Sheets client, and sync (outbox, last write wins).
- `src/lib/components/` and `src/routes/`: the Svelte 5 user interface.
- `docker/`, `Dockerfile`, `docker-compose.yml`: the self-hosting image.

## Contributing

Bug reports, feature ideas and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first.

## Security

Please report security problems privately. See [SECURITY.md](SECURITY.md).

## License

MIT. See [LICENSE](LICENSE).
