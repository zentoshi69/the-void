# Contributing to VOID

## Prerequisites

- **Node.js 20+** (`node -v`)
- **Redis** for the backend (local Docker or native)

## Secrets

- Never commit **private keys**, `.env`, or API keys.
- Copy `.env.example` → `.env` at the repo root; use `backend/.env.example` and `frontend/.env.local.example` as needed.
- If a key was ever committed, rotate it and use `git filter-repo` or GitHub secret scanning.

## Branching

- Open PRs against `main`; keep branches short-lived and focused.
- Prefer conventional, descriptive commit messages.

## Before opening a PR

Run from repo root:

```bash
npm run ci
```

Or per package: contracts `compile` + `test`, backend `build`, frontend `typecheck` + `build`.

## GitHub settings (maintainers)

- Enable **branch protection** on `main` (required reviews, status checks).
- Enable **secret scanning** and **push protection** for secrets.

## Product rules (non-negotiable)

- No **amounts** in contract events meant to be private.
- No **individual trade payloads** in databases — clearing sheet is in-memory only.
- **LiveSheetEntry** and public API responses must not expose amounts or wallet addresses.

See `docs/master prompt.md` and `.cursor/rules/the-void.mdc`.
