# VOID — Private Clearing Bridge Protocol

A private cross-chain DEX. Users lock assets on Chain A, a private in-memory clearing engine nets opposing trades, and only ZK-proven net settlements are posted on-chain on Chain B. Individual trade details never touch a public blockchain.

## Architecture

```
contracts/    Solidity smart contracts (VoidGateway) — Hardhat
backend/      NestJS clearing engine — in-memory netting, ZK proofs, WebSocket
frontend/     Next.js 14 — wagmi, RainbowKit, live clearing sheet UI
```

## Prerequisites

- **Node.js 20+** (see `.nvmrc` if you use [nvm](https://github.com/nvm-sh/nvm))
- **Redis** (see below)

## Environment

1. Copy examples to real env files (never commit secrets):

   ```bash
   cp .env.example .env
   cp backend/.env.example backend/.env
   cp frontend/.env.local.example frontend/.env.local
   ```

2. Fill `VALIDATOR_PRIVATE_KEY` (testnet only), RPC URLs if needed, and gateway addresses after deploy.

See `.env.example` for every variable used by Hardhat, backend, frontend, and Docker.

## Quick start (local dev)

**1. Redis only** (backend + frontend run on your machine):

```bash
docker compose up -d redis
```

Wait until Redis is healthy, then:

```bash
cd backend && npm install && npm run start:dev
# other terminal:
cd frontend && npm install && npm run dev
```

Open [http://localhost:3000](http://localhost:3000). API: [http://localhost:4000/api/health](http://localhost:4000/api/health).

**2. Full stack in Docker** (API + web + Redis):

```bash
docker compose up -d --build
```

Set `PUBLIC_URL` / `FRONTEND_URL` / `NEXT_PUBLIC_*` in `.env` so the browser can reach the API (see `.env.example`).

## Contracts (testnets)

```bash
cd contracts && npm install && npx hardhat compile
npx hardhat run scripts/deploy.ts --network sepolia
npx hardhat run scripts/deploy.ts --network fuji
```

Copy deployed addresses into `.env` and `frontend/.env.local` (`GATEWAY_*`, `NEXT_PUBLIC_GATEWAY_*`).

## Repo-wide checks

From the repository root:

```bash
npm run ci
```

Runs compile/tests/typecheck/build across contracts, backend, and frontend (same as CI).

## How it works

1. User locks assets on Chain A via `VoidGateway.sealIntent`
2. Private clearing engine ingests trade intents (never written to any DB)
3. Netting collapses opposing trades — reducing N trades to minimal net settlements
4. ZK proof is generated over the net state (MVP: mock hash)
5. Only the proof + net settlement data is posted on-chain as designed
6. Clearing sheet is wiped from memory after each batch
7. Individual amounts, wallets, counterparties — not exposed in public API/events per spec

## MVP definition of done

- **Testnets only** (e.g. Sepolia + Fuji), not mainnet
- **No database** storing per-intent trade rows
- **No amounts** in the contract events flagged as privacy-preserving in the spec
- **Live sheet API** exposes only non-sensitive fields (`id`, `status`, `sourceChain`, `targetChainId`)

## What is mock vs production ready

**Production ready (MVP scope):** VoidGateway pattern, netting + WebSocket flow, commitment hashing, threshold signature verification path.

**Explicitly mock / later:** Real ZK (Groth16), EIP-5564 stealth, threshold ElGamal, 5-of-7 validators, external audit before mainnet.

See `docs/master prompt.md`.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).
