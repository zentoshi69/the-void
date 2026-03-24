export type IntentStatus = 'SEALED' | 'MATCHING' | 'NETTED' | 'PROVING' | 'ERASED';
export type PhaseLabel = 'COLLECTING' | 'MATCHING' | 'NETTING' | 'PROVING' | 'ERASING';

export interface SealedIntent {
  id: string;
  commitmentHash: `0x${string}`;
  token: `0x${string}`;
  sourceChain: number;
  targetChainId: number;
  recipientHash: `0x${string}`;
  batchWindow: number;
  status: IntentStatus;
  receivedAt: number;
  own?: boolean;
}

export interface NetPosition {
  token: `0x${string}`;
  recipient: `0x${string}`;
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
}

export interface LiveSheetEntry {
  id: string;
  status: IntentStatus;
  sourceChain: number;
  targetChainId: number;
}

export interface PublicStats {
  totalErased: number;
  avgCompression: number;
  batchCount: number;
  totalVolumeUsd: number;
}
