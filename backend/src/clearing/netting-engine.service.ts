import { Injectable, Logger } from '@nestjs/common';
import { keccak256, encodePacked } from 'viem';
import { SealedIntent, NetPosition } from './clearing.types';

@Injectable()
export class NettingEngineService {
  private readonly logger = new Logger(NettingEngineService.name);

  net(intents: SealedIntent[]): NetPosition[] {
    const groups = new Map<string, SealedIntent[]>();

    for (const intent of intents) {
      const key = `${intent.token}:${intent.targetChainId}`;
      const group = groups.get(key) || [];
      group.push(intent);
      groups.set(key, group);
    }

    const positions: NetPosition[] = [];
    for (const group of groups.values()) {
      const netted = this.netGroup(group);
      if (netted) {
        positions.push(netted);
      }
    }

    this.logger.log(
      `Netted ${intents.length} intents → ${positions.length} positions`,
    );
    return positions;
  }

  private netGroup(group: SealedIntent[]): NetPosition | null {
    if (group.length === 0) return null;

    let buyTotal = 0n;
    let sellTotal = 0n;

    for (let i = 0; i < group.length; i++) {
      const mockAmount = BigInt((i + 1) * 1000);
      if (i % 2 === 0) {
        buyTotal += mockAmount;
      } else {
        sellTotal += mockAmount;
      }
    }

    const residual = buyTotal > sellTotal ? buyTotal - sellTotal : sellTotal - buyTotal;
    if (residual === 0n) return null;

    const first = group[0];
    return {
      token: first.token,
      recipient: this.deriveStealthAddress(first.recipientHash),
      amount: residual,
      nullifier: this.generateNullifier(first.commitmentHash),
      targetChainId: first.targetChainId,
    };
  }

  private deriveStealthAddress(recipientHash: `0x${string}`): `0x${string}` {
    return keccak256(
      encodePacked(['bytes32', 'bytes32'], [recipientHash, recipientHash]),
    );
  }

  private generateNullifier(commitment: `0x${string}`): `0x${string}` {
    return keccak256(
      encodePacked(['bytes32'], [commitment]),
    );
  }
}
