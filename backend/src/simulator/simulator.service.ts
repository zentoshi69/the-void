import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { keccak256, encodePacked, toHex } from 'viem';
import { ClearingEngineService } from '../clearing/clearing-engine.service';
import { SealedIntent } from '../clearing/clearing.types';

const SEPOLIA_ID = 11155111;
const FUJI_ID = 43113;
const MOCK_TOKENS: `0x${string}`[] = [
  '0x0000000000000000000000000000000000000001',
  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
];

const PAIRS: [number, number][] = [
  [SEPOLIA_ID, FUJI_ID],
  [FUJI_ID, SEPOLIA_ID],
  [SEPOLIA_ID, FUJI_ID],
];

@Injectable()
export class SimulatorService implements OnModuleInit {
  private readonly logger = new Logger(SimulatorService.name);
  private counter = 0;

  constructor(
    private readonly clearingEngine: ClearingEngineService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const enabled = this.config.get('DEMO_MODE', 'false');
    if (enabled !== 'true' && enabled !== '1') {
      this.logger.log('Demo mode OFF — simulator idle');
      return;
    }

    this.logger.log('Demo mode ON — injecting mock intents every 4-8s');
    this.scheduleNext();
  }

  private scheduleNext() {
    const delayMs = 4000 + Math.random() * 4000;
    setTimeout(() => {
      this.injectMockIntent();
      this.scheduleNext();
    }, delayMs);
  }

  private injectMockIntent() {
    this.counter++;
    const [sourceChain, targetChainId] =
      PAIRS[this.counter % PAIRS.length];

    const salt = toHex(BigInt(Date.now() + this.counter), { size: 32 });
    const commitment = keccak256(
      encodePacked(
        ['uint256', 'bytes32'],
        [BigInt(this.counter), salt as `0x${string}`],
      ),
    );

    const token = MOCK_TOKENS[this.counter % MOCK_TOKENS.length];
    const recipientHash = keccak256(
      encodePacked(['bytes32'], [salt as `0x${string}`]),
    );

    const intent: SealedIntent = {
      id: commitment,
      commitmentHash: commitment,
      token,
      sourceChain,
      targetChainId,
      recipientHash,
      batchWindow: Math.floor(Date.now() / 25000),
      status: 'SEALED',
      receivedAt: Date.now(),
    };

    const ok = this.clearingEngine.ingestIntent(intent);
    if (ok) {
      this.logger.debug(
        `Injected mock #${this.counter}: ${sourceChain}→${targetChainId}`,
      );
    }
  }
}
