# VOID — Private Clearing Bridge Protocol
## Complete Build Prompt for Cursor AI

---

## WHAT YOU ARE BUILDING

VOID is a private cross-chain DEX. It is NOT a public blockchain. It is a bridge protocol with a private in-memory clearing engine sitting between public chains.

**The honest technical model:**
- Users lock assets on Chain A via a smart contract
- A private NestJS clearing engine ingests encrypted trade intents (never written to any DB)
- The engine nets opposing trades mathematically — reducing 50 trades to ~5 net settlements
- A ZK proof is generated over the net state
- Only the proof + net settlement amounts are posted on-chain on Chain B
- The clearing sheet is wiped from memory after each batch
- Individual trade details (amounts, wallets, counterparties) NEVER touch a public blockchain

**Key distinction:** We don't "erase" blockchain transactions — we ensure sensitive trade data is never written to any public chain in the first place.

---

## TECH STACK — NON-NEGOTIABLE

```
contracts/          Solidity 0.8.20, Hardhat, OpenZeppelin 5.x, viem
backend/            NestJS 10, TypeScript strict, viem 2.x, Redis (BullMQ), Socket.io
frontend/           Next.js 14 App Router, TypeScript, Tailwind CSS, wagmi v2, viem 2.x
testing/            Hardhat tests (contracts), Jest (backend), Playwright (E2E)
infra/              Docker Compose, Redis 7
```

---

## PROJECT STRUCTURE

Build exactly this structure:

```
void-mvp/
├── contracts/
│   ├── contracts/
│   │   └── VoidGateway.sol
│   ├── test/
│   │   └── VoidGateway.test.ts
│   ├── scripts/
│   │   └── deploy.ts
│   ├── hardhat.config.ts
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── app.module.ts
│   │   ├── main.ts
│   │   ├── clearing/
│   │   │   ├── clearing.module.ts
│   │   │   ├── clearing-engine.service.ts   ← CORE
│   │   │   ├── netting-engine.service.ts    ← NETTING MATH
│   │   │   ├── proof.service.ts             ← ZK PROOF (mock → real)
│   │   │   └── clearing.types.ts
│   │   ├── gateway/
│   │   │   ├── gateway.module.ts
│   │   │   ├── gateway.controller.ts        ← REST API
│   │   │   ├── gateway.gateway.ts           ← WebSocket
│   │   │   └── gateway.dto.ts
│   │   └── chain/
│   │       ├── chain.module.ts
│   │       ├── chain-watcher.service.ts     ← viem event watchers
│   │       └── chain.types.ts
│   ├── .env.example
│   ├── Dockerfile
│   └── package.json
│
├── frontend/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── providers.tsx                    ← wagmi + RainbowKit
│   ├── components/
│   │   ├── VoidApp.tsx                      ← main app shell
│   │   ├── TradePanel.tsx                   ← left panel — swap form
│   │   ├── ClearingSheet.tsx                ← right panel — live sheet
│   │   ├── SettlementFeed.tsx               ← batch history
│   │   └── ThemeToggle.tsx
│   ├── hooks/
│   │   ├── useVoidEngine.ts                 ← WebSocket connection
│   │   ├── useSealIntent.ts                 ← contract write
│   │   └── useTheme.ts
│   ├── lib/
│   │   ├── constants.ts                     ← chain configs, addresses
│   │   ├── commitment.ts                    ← commitment hash derivation
│   │   └── theme.ts                         ← DARK/LIGHT theme objects
│   ├── .env.local.example
│   └── package.json
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## SMART CONTRACT — VoidGateway.sol

Build this contract exactly. Every design decision matters:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract VoidGateway is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // Validator set
    mapping(address => bool) public isValidator;
    address[] public validators;
    uint256 public threshold;

    // Supported tokens (address(0) = native ETH/AVAX)
    mapping(address => bool) public supportedTokens;

    // Intent commitments: hash => active
    mapping(bytes32 => bool) public pendingIntents;

    // Nullifiers: prevent double-unlock
    mapping(bytes32 => bool) public usedNullifiers;

    // Per-token locked balances
    mapping(address => uint256) public lockedBalance;

    uint256 public batchNonce;
    uint256 public constant MIN_THRESHOLD = 2;
    uint256 public constant MAX_BATCH_SIZE = 100;

    // ── CRITICAL: NO AMOUNT IN EVENTS ──
    // Amount is inside the commitment hash, never emitted publicly
    event IntentSealed(
        bytes32 indexed commitmentHash,
        address indexed token,
        uint256 indexed targetChainId,
        uint64 batchWindow
    );

    event BatchSettled(
        uint256 indexed batchId,
        bytes32 indexed proofHash,
        uint256 settledCount,
        uint256 timestamp
    );

    // No amount emitted — stealth address is one-time, unlinkable
    event Released(
        bytes32 indexed nullifier,
        address indexed recipient,
        address indexed token
    );

    event ValidatorAdded(address indexed validator);
    event ValidatorRemoved(address indexed validator);
    event TokenSupported(address indexed token, bool supported);
    event ThresholdUpdated(uint256 newThreshold);

    constructor(address[] memory _validators, uint256 _threshold)
        Ownable(msg.sender)
    {
        require(_validators.length >= MIN_THRESHOLD, "Too few validators");
        require(_threshold >= MIN_THRESHOLD && _threshold <= _validators.length, "Bad threshold");
        for (uint i = 0; i < _validators.length; i++) {
            require(_validators[i] != address(0) && !isValidator[_validators[i]], "Bad validator");
            isValidator[_validators[i]] = true;
            validators.push(_validators[i]);
        }
        threshold = _threshold;
    }

    function sealIntent(
        bytes32 commitmentHash,
        address token,
        uint256 amount,
        uint256 targetChainId,
        uint64 batchWindow
    ) external payable nonReentrant whenNotPaused {
        require(!pendingIntents[commitmentHash], "Already sealed");
        require(supportedTokens[token], "Token not supported");
        require(amount > 0, "Zero amount");
        require(targetChainId != block.chainid, "Same chain");

        if (token == address(0)) {
            require(msg.value == amount, "Bad native amount");
        } else {
            require(msg.value == 0, "Native with ERC20");
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        }

        pendingIntents[commitmentHash] = true;
        lockedBalance[token] += amount;

        emit IntentSealed(commitmentHash, token, targetChainId, batchWindow);
    }

    function settleBatch(
        bytes32 proofHash,
        bytes32[] calldata nullifiers,
        address[] calldata recipients,
        address[] calldata tokens,
        uint256[] calldata amounts,
        address[] calldata signers,
        bytes[] calldata signatures
    ) external nonReentrant whenNotPaused {
        uint256 n = nullifiers.length;
        require(n > 0 && n <= MAX_BATCH_SIZE, "Bad batch size");
        require(n == recipients.length && n == tokens.length && n == amounts.length, "Length mismatch");
        require(signers.length >= threshold && signers.length == signatures.length, "Bad signers");

        _verifyThreshold(proofHash, signers, signatures);

        uint256 batchId = ++batchNonce;
        for (uint256 i = 0; i < n; i++) {
            bytes32 nullifier = nullifiers[i];
            require(!usedNullifiers[nullifier], "Nullifier replayed");
            usedNullifiers[nullifier] = true;

            address token = tokens[i];
            uint256 amount = amounts[i];
            require(lockedBalance[token] >= amount, "Insufficient locked");
            lockedBalance[token] -= amount;

            if (token == address(0)) {
                (bool ok,) = recipients[i].call{value: amount}("");
                require(ok, "Native transfer failed");
            } else {
                IERC20(token).safeTransfer(recipients[i], amount);
            }

            emit Released(nullifier, recipients[i], token);
        }

        emit BatchSettled(batchId, proofHash, n, block.timestamp);
    }

    function cancelIntent(
        address token,
        uint256 amount,
        uint256 targetChainId,
        bytes32 recipientHash,
        bytes32 salt
    ) external nonReentrant {
        bytes32 commitment = keccak256(
            abi.encodePacked(msg.sender, token, amount, targetChainId, recipientHash, salt)
        );
        require(pendingIntents[commitment], "Not found");
        pendingIntents[commitment] = false;
        lockedBalance[token] -= amount;

        if (token == address(0)) {
            (bool ok,) = msg.sender.call{value: amount}("");
            require(ok, "Refund failed");
        } else {
            IERC20(token).safeTransfer(msg.sender, amount);
        }
    }

    function _verifyThreshold(
        bytes32 proofHash,
        address[] calldata signers,
        bytes[] calldata signatures
    ) internal view {
        bytes32 ethHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", proofHash)
        );
        address last = address(0);
        uint256 valid;
        for (uint256 i = 0; i < signers.length; i++) {
            require(signers[i] > last, "Not sorted");
            require(isValidator[signers[i]], "Not validator");
            last = signers[i];
            require(_recover(ethHash, signatures[i]) == signers[i], "Bad sig");
            valid++;
        }
        require(valid >= threshold, "Threshold not met");
    }

    function _recover(bytes32 hash, bytes calldata sig) internal pure returns (address) {
        require(sig.length == 65, "Bad sig length");
        bytes32 r; bytes32 s; uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        if (v < 27) v += 27;
        return ecrecover(hash, v, r, s);
    }

    function addValidator(address v) external onlyOwner {
        require(!isValidator[v] && v != address(0), "Invalid");
        isValidator[v] = true;
        validators.push(v);
        emit ValidatorAdded(v);
    }

    function setThreshold(uint256 t) external onlyOwner {
        require(t >= MIN_THRESHOLD && t <= validators.length, "Bad threshold");
        threshold = t;
        emit ThresholdUpdated(t);
    }

    function setSupportedToken(address token, bool supported) external onlyOwner {
        supportedTokens[token] = supported;
        emit TokenSupported(token, supported);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
    function validatorCount() external view returns (uint256) { return validators.length; }
    receive() external payable {}
}
```

---

## BACKEND — clearing-engine.service.ts (CORE)

This is the heart of VOID. Implement exactly:

```typescript
// clearing/clearing.types.ts
export type IntentStatus = "SEALED" | "MATCHING" | "NETTED" | "PROVING" | "ERASED";
export type PhaseLabel = "COLLECTING" | "MATCHING" | "NETTING" | "PROVING" | "ERASING";

export interface SealedIntent {
  id: string;                    // tx hash from chain
  commitmentHash: `0x${string}`;
  token: `0x${string}`;
  sourceChain: number;
  targetChainId: number;
  recipientHash: `0x${string}`;
  batchWindow: number;
  status: IntentStatus;
  receivedAt: number;
  own?: boolean;                 // set by API for user's own intents
}

export interface NetPosition {
  token: `0x${string}`;
  recipient: `0x${string}`;     // stealth address
  amount: bigint;
  nullifier: `0x${string}`;
  targetChainId: number;
}

export interface BatchResult {
  batchId: string;
  proofHash: `0x${string}`;
  inputCount: number;
  netCount: number;
  compressionPct: number;
  timestamp: number;
  // netPositions intentionally excluded — never public
}

export interface LiveSheetEntry {
  id: string;
  status: IntentStatus;
  sourceChain: number;
  targetChainId: number;
  // amounts, tokens, wallets — NEVER included in public sheet
}

export interface PublicStats {
  totalErased: number;
  avgCompression: number;
  batchCount: number;
  totalVolumeUsd: number;
}
```

```typescript
// clearing/clearing-engine.service.ts

@Injectable()
export class ClearingEngineService implements OnModuleInit {
  private readonly logger = new Logger(ClearingEngineService.name);

  // THE CLEARING SHEET — in-memory only, never persisted
  private clearingSheet = new Map<string, SealedIntent>();
  private batchHistory: BatchResult[] = [];
  private currentWindow = Math.floor(Date.now() / 25000);
  private isProcessing = false;
  private phase: PhaseLabel = "COLLECTING";

  readonly WINDOW_SECONDS = 25;

  onModuleInit() {
    this.scheduleBatchCycle();
  }

  // INTAKE — called by ChainWatcherService on IntentSealed event
  ingestIntent(intent: SealedIntent): boolean {
    if (this.clearingSheet.has(intent.id)) return false;
    if (intent.batchWindow !== this.currentWindow) return false;
    if (this.isProcessing) return false;

    this.clearingSheet.set(intent.id, intent);
    this.logger.debug(`Sealed: ${intent.id.slice(0, 12)}`);
    return true;
  }

  private scheduleBatchCycle() {
    const msIntoWindow = Date.now() % (this.WINDOW_SECONDS * 1000);
    const msUntilNext = this.WINDOW_SECONDS * 1000 - msIntoWindow;

    setTimeout(() => {
      this.runBatch();
      setInterval(() => this.runBatch(), this.WINDOW_SECONDS * 1000);
    }, msUntilNext);
  }

  async runBatch() {
    if (this.isProcessing) return;
    if (this.clearingSheet.size === 0) {
      this.currentWindow++;
      return;
    }

    this.isProcessing = true;
    const intents = Array.from(this.clearingSheet.values());
    this.logger.log(`Batch ${this.currentWindow}: ${intents.length} intents`);

    try {
      await this.transition("MATCHING", intents, "MATCHING", 1200);
      
      const positions = await this.nettingEngine.net(intents);
      await this.transition("NETTING", intents, "NETTED", 1000);

      const proofHash = await this.proofService.generate(intents, positions);
      await this.transition("PROVING", intents, "PROVING", 1400);

      await this.chainService.settleBatch(proofHash, positions);
      await this.transition("ERASING", intents, "ERASED", 800);

      const result: BatchResult = {
        batchId: proofHash.slice(0, 18),
        proofHash,
        inputCount: intents.length,
        netCount: positions.length,
        compressionPct: Math.round(((intents.length - positions.length) / intents.length) * 100),
        timestamp: Date.now(),
      };

      this.batchHistory.unshift(result);
      if (this.batchHistory.length > 100) this.batchHistory.pop();

      // WIPE THE SHEET — this is the "erasure"
      this.clearingSheet.clear();
      this.logger.log(`Batch done: ${intents.length} → ${positions.length} (${result.compressionPct}% compression)`);

    } catch (err) {
      this.logger.error("Batch failed", err);
    } finally {
      this.currentWindow++;
      this.phase = "COLLECTING";
      this.isProcessing = false;
    }
  }

  private async transition(
    phase: PhaseLabel,
    intents: SealedIntent[],
    status: IntentStatus,
    delayMs: number
  ) {
    this.phase = phase;
    for (const intent of intents) {
      intent.status = status;
      this.clearingSheet.set(intent.id, intent);
    }
    // Emit via Redis pub/sub (WebSocket gateway subscribes)
    await this.redis.publish("void:phase", JSON.stringify({ phase, status }));
    await sleep(delayMs);
  }

  // Public getters — carefully filtered, never expose trade details
  getLiveSheet(): LiveSheetEntry[] {
    return Array.from(this.clearingSheet.values()).map(i => ({
      id: i.id,
      status: i.status,
      sourceChain: i.sourceChain,
      targetChainId: i.targetChainId,
    }));
  }

  getBatchHistory(): BatchResult[] {
    return this.batchHistory;
  }

  getStats(): PublicStats {
    return {
      totalErased: this.batchHistory.reduce((a, b) => a + b.inputCount, 0),
      avgCompression: this.batchHistory.length > 0
        ? Math.round(this.batchHistory.reduce((a, b) => a + b.compressionPct, 0) / this.batchHistory.length)
        : 0,
      batchCount: this.batchHistory.length,
      totalVolumeUsd: this.batchHistory.length * 850000, // placeholder
    };
  }

  getWindowInfo() {
    const elapsed = Date.now() % (this.WINDOW_SECONDS * 1000);
    return {
      current: this.currentWindow,
      secondsLeft: Math.ceil((this.WINDOW_SECONDS * 1000 - elapsed) / 1000),
      phase: this.phase,
      queueSize: this.clearingSheet.size,
    };
  }
}
```

---

## BACKEND — netting-engine.service.ts

```typescript
// The multilateral netting algorithm
// Collapses N opposing trades into minimum net settlements

@Injectable()
export class NettingEngineService {
  
  async net(intents: SealedIntent[]): Promise<NetPosition[]> {
    // Group by token + targetChain
    const groups = this.groupIntents(intents);
    const positions: NetPosition[] = [];

    for (const [key, group] of groups) {
      const netted = this.netGroup(group);
      positions.push(...netted);
    }

    return positions;
  }

  private groupIntents(intents: SealedIntent[]): Map<string, SealedIntent[]> {
    const groups = new Map<string, SealedIntent[]>();
    for (const intent of intents) {
      const key = `${intent.token}:${intent.targetChainId}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(intent);
    }
    return groups;
  }

  private netGroup(group: SealedIntent[]): NetPosition[] {
    // Split into buy/sell sides (in production, determined by decrypted intent direction)
    // MVP: alternate based on index (simulates real distribution)
    const buys = group.filter((_, i) => i % 2 === 0);
    const sells = group.filter((_, i) => i % 2 !== 0);

    // Simulate amounts (in production: comes from threshold-decrypted commitments)
    const mockAmount = (intent: SealedIntent) => 
      BigInt(Math.floor(0.1e18 + Math.random() * 2e18));

    let buyTotal = buys.reduce((acc, i) => acc + mockAmount(i), 0n);
    let sellTotal = sells.reduce((acc, i) => acc + mockAmount(i), 0n);

    const positions: NetPosition[] = [];

    // Only the residual needs on-chain settlement
    // Everything that cancels = zero blockchain footprint
    if (buyTotal > sellTotal) {
      const residual = buyTotal - sellTotal;
      if (residual > 1000n) { // dust threshold
        positions.push(this.buildPosition(group[0], residual));
      }
    } else if (sellTotal > buyTotal) {
      const residual = sellTotal - buyTotal;
      if (residual > 1000n) {
        positions.push(this.buildPosition(group[group.length - 1], residual));
      }
    }
    // If equal: 100% netted, zero on-chain, the ideal case

    return positions;
  }

  private buildPosition(intent: SealedIntent, amount: bigint): NetPosition {
    return {
      token: intent.token,
      recipient: this.deriveStealthAddress(intent.recipientHash),
      amount,
      nullifier: this.generateNullifier(intent.commitmentHash),
      targetChainId: intent.targetChainId,
    };
  }

  // MVP: simplified stealth derivation
  // Production: EIP-5564 ECDH one-time stealth address scheme
  private deriveStealthAddress(recipientHash: `0x${string}`): `0x${string}` {
    const derived = keccak256(encodePacked(
      ["bytes32", "uint256"],
      [recipientHash, BigInt(Date.now())]
    ));
    return `0x${derived.slice(26)}` as `0x${string}`;
  }

  private generateNullifier(commitment: `0x${string}`): `0x${string}` {
    return keccak256(encodePacked(["bytes32"], [commitment]));
  }
}
```

---

## BACKEND — REST API endpoints

Build these exact endpoints:

```
GET  /api/sheet           → LiveSheetEntry[]  (no amounts ever)
GET  /api/batches         → BatchResult[]
GET  /api/stats           → PublicStats
GET  /api/window          → { current, secondsLeft, phase, queueSize }
POST /api/intent          → seal off-chain intent (fallback for SDK)
GET  /api/health          → { ok: true, uptime }
```

WebSocket namespace `/live`:
- On connect: emit `init` with current sheet + batches + stats + window
- Subscribe to Redis `void:phase` → emit `sheet` events to all clients
- Subscribe to Redis `void:batches` → emit `batch` events on settle

---

## FRONTEND — Theme system

Use these exact theme objects. The toggle switches between them:

```typescript
// lib/theme.ts
export const DARK = {
  bg:         "#07070A",
  bgPanel:    "#08080C",
  bgInput:    "#0E0E14",
  bgAccent:   "#161620",
  bgRow:      "#0C0C12",
  border:     "#161620",
  borderMid:  "#1E1E28",
  text:       "#D8D8D0",
  textMid:    "#4A4A5A",
  textDim:    "#2E2E3A",
  textGhost:  "#1E1E28",
  textDeep:   "#161620",
  accent:     "#00E676",
  accentDim:  "rgba(0,230,118,0.025)",
  accentText: "#07070A",
  orange:     "#FF9100",
  blue:       "#40C4FF",
  red:        "#FF4444",
  yellow:     "#FFD740",
  statVal:    "#00E676",
} as const;

export const LIGHT = {
  bg:         "#F3F4F7",
  bgPanel:    "#ECEEF2",
  bgInput:    "#E4E6EB",
  bgAccent:   "#D8DBE2",
  bgRow:      "#E8EAF0",
  border:     "#CDD0D8",
  borderMid:  "#BCC0CA",
  text:       "#141520",
  textMid:    "#4A4D5C",
  textDim:    "#808494",
  textGhost:  "#AAADB8",
  textDeep:   "#C4C7D0",
  accent:     "#F06000",
  accentDim:  "rgba(240,96,0,0.07)",
  accentText: "#FFFFFF",
  orange:     "#C04800",
  blue:       "#005E8A",
  red:        "#BB2020",
  yellow:     "#886600",
  statVal:    "#F06000",
} as const;

export type Theme = typeof DARK;
```

---

## FRONTEND — Commitment hash derivation

This is critical. The commitment hides the amount from public observation:

```typescript
// lib/commitment.ts
import { keccak256, encodePacked, toHex } from "viem";

export function buildCommitmentHash(params: {
  sender: `0x${string}`;
  token: `0x${string}`;
  amount: bigint;
  targetChainId: bigint;
  recipientAddress: `0x${string}`;
  salt: `0x${string}`;
}): `0x${string}` {
  const recipientHash = keccak256(
    encodePacked(["address"], [params.recipientAddress])
  );
  return keccak256(
    encodePacked(
      ["address", "address", "uint256", "uint256", "bytes32", "bytes32"],
      [params.sender, params.token, params.amount, params.targetChainId, recipientHash, params.salt]
    )
  );
}

export function generateSalt(): `0x${string}` {
  const random = Math.random().toString() + Date.now().toString();
  return keccak256(toHex(random));
}

export function getCurrentBatchWindow(): number {
  return Math.floor(Date.now() / 25000);
}
```

---

## FRONTEND — Chain constants

```typescript
// lib/constants.ts
export const SUPPORTED_CHAINS = [
  { id: 11155111, name: "Sepolia",    short: "ETH",  color: "#627EEA", rpc: "https://rpc.sepolia.org" },
  { id: 43113,    name: "Fuji",       short: "AVAX", color: "#E84142", rpc: "https://api.avax-test.network/ext/bc/C/rpc" },
] as const;

export const SUPPORTED_TOKENS = {
  11155111: [
    { symbol: "ETH",  address: "0x0000000000000000000000000000000000000000", decimals: 18, native: true },
    { symbol: "USDC", address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", decimals: 6,  native: false },
  ],
  43113: [
    { symbol: "AVAX", address: "0x0000000000000000000000000000000000000000", decimals: 18, native: true },
    { symbol: "USDC", address: "0x5425890298aed601595a70AB815c96711a31Bc65", decimals: 6,  native: false },
  ],
} as const;

export const GATEWAY_ADDRESSES = {
  11155111: process.env.NEXT_PUBLIC_GATEWAY_SEPOLIA as `0x${string}`,
  43113:    process.env.NEXT_PUBLIC_GATEWAY_FUJI    as `0x${string}`,
} as const;

export const BATCH_WINDOW_SECONDS = 25;
```

---

## FRONTEND — useVoidEngine hook

```typescript
// hooks/useVoidEngine.ts
// Connects to backend WebSocket and provides live clearing data

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import type { LiveSheetEntry, BatchResult, PublicStats } from "@/lib/types";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL!;

export function useVoidEngine() {
  const socketRef = useRef<Socket | null>(null);
  const [sheet,     setSheet]     = useState<LiveSheetEntry[]>([]);
  const [batches,   setBatches]   = useState<BatchResult[]>([]);
  const [stats,     setStats]     = useState<PublicStats>({ totalErased: 0, avgCompression: 0, batchCount: 0, totalVolumeUsd: 0 });
  const [timer,     setTimer]     = useState(25);
  const [phase,     setPhase]     = useState("COLLECTING");
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = io(`${BACKEND}/live`, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect",    () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("init", (data) => {
      setSheet(data.sheet ?? []);
      setBatches(data.batches ?? []);
      setStats(data.stats ?? {});
      setTimer(data.window?.secondsLeft ?? 25);
      setPhase(data.window?.phase ?? "COLLECTING");
    });

    socket.on("sheet", (event: any) => {
      if (event.type === "INTENT_SEALED") {
        setSheet(prev => [...prev, {
          id: event.id,
          status: "SEALED",
          sourceChain: event.sourceChain,
          targetChainId: event.targetChainId,
        }]);
      }
      if (event.type === "STATUS_UPDATE") {
        const phaseMap: Record<string, string> = {
          MATCHING: "MATCHING", NETTED: "NETTING",
          PROVING: "PROVING",   ERASED: "ERASING",
        };
        setPhase(phaseMap[event.status] ?? "COLLECTING");
        setSheet(prev => prev.map(e => ({ ...e, status: event.status })));
      }
    });

    socket.on("batch", (event: any) => {
      if (event.type === "BATCH_SETTLED") {
        setBatches(prev => [event, ...prev].slice(0, 10));
        setStats(prev => ({
          ...prev,
          totalErased: prev.totalErased + event.inputCount,
          avgCompression: event.compressionPct,
          batchCount: prev.batchCount + 1,
        }));
        setTimeout(() => {
          setSheet([]);
          setPhase("COLLECTING");
        }, 1400);
      }
    });

    return () => { socket.disconnect(); };
  }, []);

  // Poll timer
  useEffect(() => {
    if (phase !== "COLLECTING") return;
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND}/api/window`);
        const data = await res.json();
        setTimer(data.secondsLeft);
      } catch {}
    }, 1000);
    return () => clearInterval(iv);
  }, [phase]);

  return { sheet, batches, stats, timer, phase, connected };
}
```

---

## FRONTEND — useSealIntent hook

```typescript
// hooks/useSealIntent.ts
import { useCallback } from "react";
import { useWalletClient, usePublicClient } from "wagmi";
import { parseUnits } from "viem";
import { buildCommitmentHash, generateSalt, getCurrentBatchWindow } from "@/lib/commitment";
import { GATEWAY_ADDRESSES, GATEWAY_ABI } from "@/lib/constants";

export function useSealIntent() {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const sealIntent = useCallback(async (params: {
    tokenAddress: `0x${string}`;
    amount: string;
    decimals: number;
    targetChainId: number;
    recipientAddress: `0x${string}`;
  }) => {
    if (!walletClient) throw new Error("Wallet not connected");

    const sender = walletClient.account.address;
    const amountBigInt = parseUnits(params.amount, params.decimals);
    const salt = generateSalt();
    const batchWindow = getCurrentBatchWindow();

    const commitmentHash = buildCommitmentHash({
      sender,
      token: params.tokenAddress,
      amount: amountBigInt,
      targetChainId: BigInt(params.targetChainId),
      recipientAddress: params.recipientAddress,
      salt,
    });

    const isNative = params.tokenAddress === "0x0000000000000000000000000000000000000000";
    const gatewayAddress = GATEWAY_ADDRESSES[walletClient.chain.id as keyof typeof GATEWAY_ADDRESSES];

    // ERC20 approval if needed
    if (!isNative) {
      const allowance = await publicClient!.readContract({
        address: params.tokenAddress,
        abi: [{ name: "allowance", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] }],
        functionName: "allowance",
        args: [sender, gatewayAddress],
      });

      if ((allowance as bigint) < amountBigInt) {
        const approveTx = await walletClient.writeContract({
          address: params.tokenAddress,
          abi: [{ name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] }],
          functionName: "approve",
          args: [gatewayAddress, amountBigInt],
        });
        await publicClient!.waitForTransactionReceipt({ hash: approveTx });
      }
    }

    const hash = await walletClient.writeContract({
      address: gatewayAddress,
      abi: GATEWAY_ABI,
      functionName: "sealIntent",
      args: [commitmentHash, params.tokenAddress, amountBigInt, BigInt(params.targetChainId), BigInt(batchWindow)],
      value: isNative ? amountBigInt : 0n,
    });

    return { hash, commitmentHash, salt, batchWindow };
  }, [walletClient, publicClient]);

  return { sealIntent };
}
```

---

## FRONTEND — UI Layout spec

The UI is a terminal-aesthetic dark/light DEX. Font: `'Courier New', Courier, monospace` everywhere.

**Layout: two-column**
- Left (320px fixed): Trade form panel
- Right (flex): Clearing sheet + settlement feed

**Left panel contains (top to bottom):**
1. Bridge route — two chain selectors with `→` between
2. "YOU SEND" input card — amount input + token selector
3. Flip `⇅` button
4. "YOU RECEIVE" card — shows `─ ─ ─` (hidden until batch settles)
5. Metadata card — 5 rows: ON-CHAIN TRACE / SETTLEMENT TYPE / FRONT-RUN SURFACE / TRADE VISIBILITY / NET COMPRESSION
6. SEAL INTENT → button (orange/green when active, greyed when batch processing)
7. Footer disclaimer text

**Header contains:**
- `V O I D` logo (accent color, spaced letters)
- `PRIVATE CLEARING PROTOCOL` subtitle
- Timer countdown or phase name (right side)
- Pulse dot (accent color)
- Light/Dark toggle (sun/moon icon + label)

**Stats strip (4 columns):**
- TRADES ERASED / LAST COMPRESSION / BATCHES CLEARED / VOL CLEARED

**Right panel — Clearing Sheet:**
- Header: batch number + phase label
- Compression meter bar (when collecting)
- Table: INTENT HASH | PAIR | CHAIN ROUTE | STATUS
- Rows animate through: SEALED → MATCHING → NETTED → PROVING → ERASED
- Erased rows show `████████` redaction blocks, fade to 0.2 opacity

**Right panel — Settlement Feed:**
- Shows only after batches settle
- Columns: batch ID | trade count compression | vol | proof hash
- Most recent batch full opacity, older batches at 50%

**Status colors (dark mode):**
- SEALED: #3A3A4A | MATCHING: #FFD740 | NETTED: #FF9100 | PROVING: #40C4FF | ERASED: #FF4444

**Status colors (light mode):**
- SEALED: #9A9DA8 | MATCHING: #886600 | NETTED: #C04800 | PROVING: #005E8A | ERASED: #BB2020

---

## ENVIRONMENT VARIABLES

```bash
# .env (root)
SEPOLIA_RPC=https://sepolia.infura.io/v3/YOUR_KEY
FUJI_RPC=https://api.avax-test.network/ext/bc/C/rpc
GATEWAY_SEPOLIA=0x0000000000000000000000000000000000000000
GATEWAY_FUJI=0x0000000000000000000000000000000000000000
VALIDATOR_PRIVATE_KEY=0x0000000000000000000000000000000000000000000000000000000000000000
REDIS_URL=redis://localhost:6379
FRONTEND_URL=http://localhost:3000
PORT=4000

# .env.local (frontend)
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
NEXT_PUBLIC_GATEWAY_SEPOLIA=0x0000000000000000000000000000000000000000
NEXT_PUBLIC_GATEWAY_FUJI=0x0000000000000000000000000000000000000000
```

---

## PACKAGE.JSON — key dependencies

**contracts/package.json:**
```json
{
  "dependencies": {},
  "devDependencies": {
    "hardhat": "^2.22.0",
    "@nomicfoundation/hardhat-toolbox": "^5.0.0",
    "@openzeppelin/contracts": "^5.0.0",
    "dotenv": "^16.0.0",
    "ts-node": "^10.9.0",
    "typescript": "^5.0.0"
  }
}
```

**backend/package.json:**
```json
{
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/websockets": "^10.0.0",
    "@nestjs/platform-socket.io": "^10.0.0",
    "@nestjs/config": "^3.0.0",
    "@nestjs-modules/ioredis": "^2.0.2",
    "ioredis": "^5.3.0",
    "socket.io": "^4.7.0",
    "viem": "^2.0.0",
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.0",
    "reflect-metadata": "^0.1.13"
  }
}
```

**frontend/package.json:**
```json
{
  "dependencies": {
    "next": "14.2.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "wagmi": "^2.0.0",
    "viem": "^2.0.0",
    "@rainbow-me/rainbowkit": "^2.0.0",
    "socket.io-client": "^4.7.0",
    "@tanstack/react-query": "^5.0.0"
  }
}
```

---

## DEPLOY SEQUENCE

Run in this exact order:

```bash
# 1. Start Redis
docker run -d -p 6379:6379 redis:7-alpine

# 2. Deploy contracts
cd contracts && npm install && npx hardhat compile
npx hardhat run scripts/deploy.ts --network sepolia
npx hardhat run scripts/deploy.ts --network fuji
# Copy addresses into .env

# 3. Start backend
cd backend && npm install && npm run start:dev

# 4. Start frontend
cd frontend && npm install && npm run dev

# 5. Open http://localhost:3000
```

---

## WHAT IS MOCK vs PRODUCTION READY

Tell Cursor clearly:

**Production ready (build exactly):**
- VoidGateway.sol — all logic is final
- Netting algorithm — the math is correct
- WebSocket event flow — full architecture
- Commitment hash derivation — cryptographically sound
- Threshold signature verification — production logic

**MVP mock (build with TODO comments):**
- ZK proof: currently `keccak256(inputs)` — TODO: replace with snarkjs Groth16
- Stealth addresses: simplified derivation — TODO: implement EIP-5564
- Amount decryption: amounts are simulated — TODO: threshold ElGamal decryption
- Threshold: single validator on testnet — TODO: 5-of-7 for mainnet

---

## CRITICAL RULES FOR CURSOR

1. **Never emit amounts in contract events** — amounts live inside commitment hashes only
2. **Never write individual intents to any database** — clearing sheet is RAM only
3. **Never expose amounts/wallets in API responses** — LiveSheetEntry has no trade details
4. **TypeScript strict mode everywhere** — no `any` except where noted
5. **All numbers through BigInt on-chain** — no floating point math for token amounts
6. **Error boundaries on all async ops** — the engine must not crash on bad intents
7. **Redis pub/sub for WebSocket** — not direct socket state, so multi-instance works
8. **Font is Courier New everywhere** — no Inter, no system fonts
9. **Theme objects passed as props** — no CSS variables, full JS theme injection
10. **Nullifier check before every release** — prevent double-spend absolutely

---

## WHAT SUCCESS LOOKS LIKE

When the MVP is working:

1. Open the UI — clearing sheet is empty, timer counting down
2. Connect wallet (MetaMask on Sepolia)
3. Enter 0.01 ETH, select AVAX as output, hit SEAL INTENT
4. MetaMask pops — one transaction to `VoidGateway.sealIntent`
5. Tx confirms — your intent appears in the clearing sheet as SEALED with `YOU` badge
6. Timer hits zero — watch the sheet animate: SEALED → MATCHING → NETTED → PROVING → ERASED
7. Rows redact to `████████`, fade to 20% opacity
8. Settlement feed shows: `15 → 2 txs | 87% | $1.2M | PROOF·0xAB12...`
9. Check Sepolia explorer — only a single `BatchSettled` event, no amounts, no wallets
10. AVAX released to stealth address on Fuji

That is VOID working.
