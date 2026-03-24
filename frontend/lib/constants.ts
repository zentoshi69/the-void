export const SUPPORTED_CHAINS = [
  { id: 11155111, name: "Sepolia", short: "ETH", color: "#627EEA", rpc: "https://rpc.sepolia.org" },
  { id: 43113, name: "Fuji", short: "AVAX", color: "#E84142", rpc: "https://api.avax-test.network/ext/bc/C/rpc" },
] as const;

export const SUPPORTED_TOKENS = {
  11155111: [
    { symbol: "ETH", address: "0x0000000000000000000000000000000000000000" as `0x${string}`, decimals: 18, native: true },
    { symbol: "USDC", address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as `0x${string}`, decimals: 6, native: false },
  ],
  43113: [
    { symbol: "AVAX", address: "0x0000000000000000000000000000000000000000" as `0x${string}`, decimals: 18, native: true },
    { symbol: "USDC", address: "0x5425890298aed601595a70AB815c96711a31Bc65" as `0x${string}`, decimals: 6, native: false },
  ],
} as const;

export const GATEWAY_ADDRESSES = {
  11155111: (process.env.NEXT_PUBLIC_GATEWAY_SEPOLIA ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
  43113: (process.env.NEXT_PUBLIC_GATEWAY_FUJI ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
} as const;

export const BATCH_WINDOW_SECONDS = 25;

export const GATEWAY_ABI = [
  {
    type: "function" as const,
    name: "sealIntent",
    inputs: [
      { name: "commitmentHash", type: "bytes32" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "targetChainId", type: "uint256" },
      { name: "batchWindow", type: "uint64" },
    ],
    outputs: [],
    stateMutability: "payable" as const,
  },
  {
    type: "function" as const,
    name: "cancelIntent",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "targetChainId", type: "uint256" },
      { name: "recipientHash", type: "bytes32" },
      { name: "salt", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable" as const,
  },
  {
    type: "function" as const,
    name: "settleBatch",
    inputs: [
      { name: "proofHash", type: "bytes32" },
      { name: "nullifiers", type: "bytes32[]" },
      { name: "recipients", type: "address[]" },
      { name: "tokens", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
      { name: "signers", type: "address[]" },
      { name: "signatures", type: "bytes[]" },
    ],
    outputs: [],
    stateMutability: "nonpayable" as const,
  },
  {
    type: "event" as const,
    name: "IntentSealed",
    inputs: [
      { name: "commitmentHash", type: "bytes32", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "targetChainId", type: "uint256", indexed: true },
      { name: "batchWindow", type: "uint64", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event" as const,
    name: "BatchSettled",
    inputs: [
      { name: "batchId", type: "uint256", indexed: true },
      { name: "proofHash", type: "bytes32", indexed: true },
      { name: "settledCount", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event" as const,
    name: "Released",
    inputs: [
      { name: "nullifier", type: "bytes32", indexed: true },
      { name: "recipient", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
    ],
    anonymous: false,
  },
] as const;
