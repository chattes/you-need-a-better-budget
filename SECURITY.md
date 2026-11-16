# Security policy

## Reporting a vulnerability

Please **do not** open a public issue for a security problem.

Report it privately through GitHub security advisories:

<https://github.com/chattes/you-need-a-better-budget/security/advisories/new>

Include:

- What the problem is and where it is (page, file, or request).
- Steps to reproduce it.
- What an attacker could do with it.

We will reply as soon as we can, confirm the problem, and agree on a fix and a disclosure date with you.

## Scope

In scope:

- The web app in this repository.
- The Docker image and its nginx configuration.
- Handling of Google sign-in tokens and the Google Sheet data.

Out of scope:

- Problems in Google's own services.
- Problems caused by a misconfigured Google OAuth client, such as an origin you did not intend to allow.
- Your own copy of the app, unless the problem also exists in this repository.

## Supported versions

Only the latest release and the `main` branch get security fixes.
