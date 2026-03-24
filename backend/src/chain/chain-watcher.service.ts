import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createPublicClient,
  http,
  parseAbiItem,
  type PublicClient,
  type WatchEventReturnType,
} from 'viem';
import { sepolia } from 'viem/chains';
import { keccak256, encodePacked } from 'viem';
import { ClearingEngineService } from '../clearing/clearing-engine.service';
import type { SealedIntent } from '../clearing/clearing.types';
import type { ChainConfig } from './chain.types';

const INTENT_SEALED_EVENT = parseAbiItem(
  'event IntentSealed(bytes32 indexed commitmentHash, address indexed token, uint256 indexed targetChainId, uint64 batchWindow)',
);

const FUJI_CHAIN = {
  id: 43113,
  name: 'Avalanche Fuji',
  nativeCurrency: { name: 'AVAX', symbol: 'AVAX', decimals: 18 },
  rpcUrls: { default: { http: ['https://api.avax-test.network/ext/bc/C/rpc'] } },
  testnet: true,
} as const;

@Injectable()
export class ChainWatcherService implements OnModuleInit {
  private readonly logger = new Logger(ChainWatcherService.name);
  private readonly unwatchers: WatchEventReturnType[] = [];

  constructor(
    private readonly configService: ConfigService,
    private readonly clearingEngine: ClearingEngineService,
  ) {}

  onModuleInit() {
    const chains = this.buildChainConfigs();

    for (const chain of chains) {
      if (chain.gatewayAddress === '0x0000000000000000000000000000000000000000') {
        this.logger.warn(`Skipping ${chain.name} — gateway address not configured`);
        continue;
      }
      this.watchChain(chain);
    }
  }

  private buildChainConfigs(): ChainConfig[] {
    return [
      {
        chainId: sepolia.id,
        name: 'Sepolia',
        rpc: this.configService.get<string>('SEPOLIA_RPC', 'https://rpc.sepolia.org'),
        gatewayAddress: this.configService.get<`0x${string}`>(
          'GATEWAY_SEPOLIA',
          '0x0000000000000000000000000000000000000000',
        ),
      },
      {
        chainId: FUJI_CHAIN.id,
        name: 'Fuji',
        rpc: this.configService.get<string>(
          'FUJI_RPC',
          'https://api.avax-test.network/ext/bc/C/rpc',
        ),
        gatewayAddress: this.configService.get<`0x${string}`>(
          'GATEWAY_FUJI',
          '0x0000000000000000000000000000000000000000',
        ),
      },
    ];
  }

  private watchChain(chain: ChainConfig) {
    const client: PublicClient = createPublicClient({
      chain: chain.chainId === sepolia.id ? sepolia : FUJI_CHAIN,
      transport: http(chain.rpc),
    });

    this.logger.log(`Watching ${chain.name} (${chain.chainId}) at ${chain.gatewayAddress}`);

    const unwatch = client.watchEvent({
      address: chain.gatewayAddress,
      event: INTENT_SEALED_EVENT,
      onLogs: (logs) => {
        for (const log of logs) {
          try {
            const args = log.args;
            if (!args.commitmentHash || !args.token) continue;

            const recipientHash = keccak256(
              encodePacked(['bytes32', 'uint256'], [args.commitmentHash, BigInt(Date.now())]),
            );

            const intent: SealedIntent = {
              id: `${chain.chainId}-${log.transactionHash}-${log.logIndex}`,
              commitmentHash: args.commitmentHash,
              token: args.token,
              sourceChain: chain.chainId,
              targetChainId: Number(args.targetChainId ?? 0),
              recipientHash: recipientHash as `0x${string}`,
              batchWindow: Number(args.batchWindow ?? 0),
              status: 'SEALED',
              receivedAt: Date.now(),
            };

            this.clearingEngine.ingestIntent(intent);
            this.logger.log(`IntentSealed on ${chain.name}: ${intent.id}`);
          } catch (err) {
            this.logger.error(
              `Error processing IntentSealed on ${chain.name}`,
              err instanceof Error ? err.message : err,
            );
          }
        }
      },
      onError: (err) => {
        this.logger.error(`Event watcher error on ${chain.name}: ${err.message}`);
      },
    });

    this.unwatchers.push(unwatch);
  }
}
