# Contributing

Thanks for helping. YNBB is a small project, so small, focused changes are easiest to review.

## Before you start

- For a large change, open an issue first and describe the problem. This saves time for both of us.
- Never include real budget data, Google credentials, tokens or client secrets in an issue, a pull request or a commit. Use sample data instead.

## Set up

Requires Node.js 24.

```bash
npm install
npm run dev
```

## Checks before you open a pull request

Run all four. They must pass:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Run `npm run format` to format your changes with Prettier.

## Code guidelines

- Keep budget rules in `src/lib/domain/`. That code is pure TypeScript with no UI and no I/O, and it should have unit tests in `src/test/`.
- Store money as integer cents. Use UUIDs for IDs.
- Do not add analytics, tracking, or a backend. YNBB is browser-only by design.
- Keep new user-facing text short and in plain English.
- Add a test for each bug you fix.

## Commits and pull requests

- Use clear commit messages, for example `fix(budget): ...` or `feat(settings): ...`.
- Keep each pull request to one topic.
- Describe what changed and how you checked it.
- Include screenshots for visual changes, if you can.

## License

By contributing, you agree that your work is released under the MIT license in [LICENSE](LICENSE).
