import { Injectable, Logger } from '@nestjs/common';
import { keccak256, encodePacked } from 'viem';
import { SealedIntent, NetPosition } from './clearing.types';

@Injectable()
export class ProofService {
  private readonly logger = new Logger(ProofService.name);

  // TODO: Replace with snarkjs Groth16 proving once circuits are ready
  async generate(
    intents: SealedIntent[],
    positions: NetPosition[],
  ): Promise<`0x${string}`> {
    const commitments = intents.map((i) => i.commitmentHash);
    const nullifiers = positions.map((p) => p.nullifier);

    const packed = encodePacked(
      [...commitments.map(() => 'bytes32' as const), ...nullifiers.map(() => 'bytes32' as const)],
      [...commitments, ...nullifiers],
    );

    const proofHash = keccak256(packed);

    this.logger.log(
      `Mock ZK proof generated: ${proofHash.slice(0, 18)}… (${intents.length} intents, ${positions.length} positions)`,
    );

    return proofHash;
  }
}
