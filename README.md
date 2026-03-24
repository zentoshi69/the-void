# VOID — Private Clearing Bridge Protocol

A private cross-chain DEX. Users lock assets on Chain A, a private in-memory clearing engine nets opposing trades, and only ZK-proven net settlements are posted on-chain on Chain B. Individual trade details never touch a public blockchain.

## Architecture

```
contracts/    Solidity smart contracts (VoidGateway) — Hardhat
backend/      NestJS clearing engine — in-memory netting, ZK proofs, WebSocket
frontend/     Next.js 14 — wagmi, RainbowKit, live clearing sheet UI
```

## Quick Start

```bash
# 1. Start Redis
docker compose up -d

# 2. Deploy contracts (testnets)
cd contracts && npm install && npx hardhat compile
npx hardhat run scripts/deploy.ts --network sepolia
npx hardhat run scripts/deploy.ts --network fuji
# Copy deployed addresses into .env

# 3. Start backend
cd backend && npm install && npm run start:dev

# 4. Start frontend
cd frontend && npm install && npm run dev

# 5. Open http://localhost:3000
```

## How It Works

1. User locks assets on Chain A via `VoidGateway.sealIntent`
2. Private clearing engine ingests encrypted trade intents (never written to any DB)
3. Netting algorithm collapses opposing trades — reducing N trades to minimal net settlements
4. ZK proof is generated over the net state
5. Only the proof + net settlement amounts are posted on-chain
6. Clearing sheet is wiped from memory after each batch
7. Individual amounts, wallets, counterparties — never on any public chain

## What Is Mock vs Production Ready

**Production ready:** VoidGateway.sol, netting algorithm, WebSocket event flow, commitment hash derivation, threshold signature verification.

**MVP mock (TODO):** ZK proof (currently keccak256), stealth addresses (simplified), amount decryption (simulated), threshold (single validator on testnet).
