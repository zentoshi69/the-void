# VoidGateway.sol — Security Review Export

**Document type:** Internal / pre-audit technical review (not a substitute for a professional third-party audit)  
**Solidity:** `^0.8.20`  
**Contract path:** `contracts/contracts/VoidGateway.sol`  
**Review date:** 2026-03-24  
**Test suite:** `contracts/test/VoidGateway.test.ts` — **38 passing** (Hardhat)

---

## 1. Scope

| In scope | Out of scope |
|----------|----------------|
| `VoidGateway.sol` | Backend, frontend, ZK circuits, off-chain key management |
| OpenZeppelin dependencies as used | Economic attacks on token issuers |
| Deployment scripts / env hygiene | Mainnet deployment |

---

## 2. Alignment with project “master prompt”

The authoritative product spec in-repo is **`docs/master prompt.md`** (“VOID — Private Clearing Bridge Protocol”). Relevant contract rules:

- **No trade amounts in public events** — `IntentSealed`, `BatchSettled`, `Released` do not emit wei amounts; amounts are only used in internal accounting and transfers.
- **Commitment-based sealing** — Users lock funds under a `commitmentHash`; off-chain clearing is expected to coordinate with `proofHash` / nullifiers.
- **Validators + threshold** — Off-chain signatures over `proofHash` (EIP-191 prefix) must meet `threshold` with sorted, unique validator addresses.

**Note:** The live implementation includes **extensions** beyond the verbatim snippet in `master prompt.md` (e.g. `intentMeta`, `settleBatch(commitments, ...)`, `rescueExpiredIntent`, `removeValidator`, malleability-resistant `s`). These are intentional hardening; frontend/backend ABIs must match the deployed bytecode.

---

## 3. Architecture summary

| Component | Role |
|-----------|------|
| `sealIntent` | Lock native or ERC20 under `commitmentHash`; records `IntentMeta` for cancel/rescue |
| `settleBatch` | Validator threshold signatures on `proofHash`; consumes nullifiers; releases to `recipients`; clears pending state per commitment |
| `cancelIntent` | Depositor cancels pending intent with preimage check (`abi.encode` commitment) |
| `rescueExpiredIntent` | Depositor pulls funds after `INTENT_TTL` (7 days) if still pending |
| Admin | `addValidator` / `removeValidator`, `setThreshold`, `setSupportedToken`, `pause` / `unpause` |

---

## 4. Security checklist (automated review)

| Check | Status |
|-------|--------|
| ReentrancyGuard on `sealIntent`, `settleBatch`, `cancelIntent`, `rescueExpiredIntent` | Yes |
| Pausable on seal / settle / cancel | Yes (`whenNotPaused` on those; rescue intentionally not paused) |
| `IntentSealed` — no amount in event | Yes |
| `Released` — no amount in event | Yes |
| `BatchSettled` — no per-trade amounts | Yes (aggregate `settledCount` only) |
| Nullifier replay prevented | Yes (`usedNullifiers` before transfer) |
| Checks-effects-interactions in `settleBatch` loop | Yes (state updated before external calls) |
| Native sends use `.call`, not `.transfer` | Yes (with `gas: 30000` cap) |
| Signers sorted ascending | Yes |
| `addValidator` rejects `address(0)` | Yes |
| Solidity 0.8 overflow checks | Yes |
| ECDSA `s` upper bound (malleability) | Yes (secp256k1 half-order) |
| `settleBatch` ties release to known pending commitments | Yes (`commitments[]` + `pendingIntents`) |

---

## 5. Residual risks and limitations (informational)

| ID | Severity | Topic | Description |
|----|----------|--------|-------------|
| R-1 | **Operational** | Validator compromise | If `threshold` validators collude or leak keys, they can sign arbitrary `proofHash` values and drain `lockedBalance` to attacker-controlled recipients. Mitigation: key hygiene, HSM, monitoring, eventual multisig / rotated keys. |
| R-2 | **Operational** | Owner centralization | `owner` can pause, add/remove validators, change threshold, support tokens. Mitigate with timelock + multisig for production. |
| R-3 | **Low** | Native gas stipend | `.call{value: amount, gas: 30000}` may fail for contracts needing more gas (e.g. some wallets); EOAs are fine. Intentional tradeoff vs griefing. |
| R-4 | **Low** | ERC20 “fee-on-transfer” / rebasing | `lockedBalance` assumes `amount` received equals `amount` transferred. Non-standard tokens can desync accounting. Mitigation: only list supported, standard ERC20s. |
| R-5 | **Informational** | Proof binding | `proofHash` is not bound on-chain to `commitments[]` / nullifiers / amounts in a single hash. Trust model: validators attest the batch payload off-chain; contract trusts signatures + accounting. |
| R-6 | **Privacy** | `IntentCancelled` | Emits `depositor` indexed — links cancellation to an address (by design for indexers; consider product implications). |
| R-7 | **Informational** | `intentMeta` is on-chain | Stores `amount` per commitment in **contract storage** (not in events). This is **not** “amount in events” but is visible on-chain to storage readers. |

---

## 6. Recommendations before mainnet

1. **External audit** by a recognized firm (in addition to this document).
2. **Formal verification** or **invariant** testing (e.g. `lockedBalance` vs actual token balance) for supported assets.
3. **Governance** hardening: multisig, timelock, documented validator rotation.
4. **Monitoring**: alerts on large `settleBatch`, pause events, unusual `lockedBalance` drift.

---

## 7. Verification commands

```bash
cd contracts
npx hardhat compile
npx hardhat test
```

Expected: compile success; **38** tests passing.

---

## 8. Disclaimer

This document is a **technical review export** for internal use. It does **not** constitute a legal or financial guarantee, an insurance-backed audit, or a certification of fitness for production. Mainnet deployment should follow industry standards and independent review.

---

*Generated as part of the VOID repository. Master prompt reference: `docs/master prompt.md`.*
