import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import {
  SealedIntent,
  BatchResult,
  LiveSheetEntry,
  PublicStats,
  PhaseLabel,
} from './clearing.types';
import { NettingEngineService } from './netting-engine.service';
import { ProofService } from './proof.service';

const WINDOW_SECONDS = 25;
const BATCH_WINDOW_MS = WINDOW_SECONDS * 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class ClearingEngineService implements OnModuleInit {
  private readonly logger = new Logger(ClearingEngineService.name);

  private readonly clearingSheet = new Map<string, SealedIntent>();
  private readonly batchHistory: BatchResult[] = [];

  private currentWindow = Math.floor(Date.now() / BATCH_WINDOW_MS);
  private isProcessing = false;
  private phase: PhaseLabel = 'COLLECTING';

  constructor(
    private readonly nettingEngine: NettingEngineService,
    private readonly proofService: ProofService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  onModuleInit() {
    this.logger.log('Clearing engine initialised — starting batch cycle');
    this.scheduleBatchCycle();
  }

  ingestIntent(intent: SealedIntent): boolean {
    if (this.isProcessing) {
      this.logger.warn(`Rejected intent ${intent.id} — batch is processing`);
      return false;
    }

    if (this.clearingSheet.has(intent.id)) {
      this.logger.warn(`Duplicate intent ${intent.id}`);
      return false;
    }

    this.clearingSheet.set(intent.id, {
      ...intent,
      status: 'SEALED',
      receivedAt: Date.now(),
    });

    this.logger.log(`Ingested intent ${intent.id} (sheet size: ${this.clearingSheet.size})`);

    const entry: LiveSheetEntry = {
      id: intent.id,
      status: 'SEALED',
      sourceChain: intent.sourceChain,
      targetChainId: intent.targetChainId,
    };
    this.redis.publish('void:intent', JSON.stringify(entry)).catch(() => {});

    return true;
  }

  getLiveSheet(): LiveSheetEntry[] {
    return Array.from(this.clearingSheet.values()).map((i) => ({
      id: i.id,
      status: i.status,
      sourceChain: i.sourceChain,
      targetChainId: i.targetChainId,
    }));
  }

  getBatchHistory(): BatchResult[] {
    return [...this.batchHistory];
  }

  getStats(): PublicStats {
    const totalErased = this.batchHistory.reduce((a, b) => a + b.inputCount, 0);
    const compressions = this.batchHistory.map((b) => b.compressionPct);
    return {
      totalErased,
      avgCompression:
        compressions.length > 0
          ? Math.round(compressions.reduce((a, b) => a + b, 0) / compressions.length)
          : 0,
      batchCount: this.batchHistory.length,
      totalVolumeUsd: this.batchHistory.length * 850_000,
    };
  }

  getWindowInfo(): {
    current: number;
    secondsLeft: number;
    phase: PhaseLabel;
    queueSize: number;
  } {
    const msIntoWindow = Date.now() % BATCH_WINDOW_MS;
    const secondsLeft = Math.ceil((BATCH_WINDOW_MS - msIntoWindow) / 1000);
    return {
      current: this.currentWindow,
      secondsLeft,
      phase: this.phase,
      queueSize: this.clearingSheet.size,
    };
  }

  private scheduleBatchCycle() {
    const msIntoWindow = Date.now() % BATCH_WINDOW_MS;
    const msUntilNext = BATCH_WINDOW_MS - msIntoWindow;

    setTimeout(() => {
      this.runBatch();
      setInterval(() => this.runBatch(), BATCH_WINDOW_MS);
    }, msUntilNext);
  }

  private async runBatch() {
    if (this.isProcessing) return;

    const intents = Array.from(this.clearingSheet.values());
    if (intents.length === 0) {
      this.currentWindow++;
      return;
    }

    this.isProcessing = true;
    this.logger.log(`Batch ${this.currentWindow}: ${intents.length} intents`);

    try {
      await this.transition('MATCHING', intents, 'MATCHING', 1200);

      const positions = this.nettingEngine.net(intents);
      await this.transition('NETTING', intents, 'NETTED', 1000);

      const proofHash = await this.proofService.generate(intents, positions);
      await this.transition('PROVING', intents, 'PROVING', 1400);

      await this.transition('ERASING', intents, 'ERASED', 800);

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

      await this.redis.publish(
        'void:batches',
        JSON.stringify({
          type: 'BATCH_SETTLED',
          batch: result,
          stats: this.getStats(),
        }),
      );

      this.clearingSheet.clear();
      this.logger.log(
        `Batch done: ${intents.length} → ${positions.length} (${result.compressionPct}% compression)`,
      );
    } catch (err) {
      this.logger.error('Batch failed', err);
    } finally {
      this.currentWindow++;
      this.phase = 'COLLECTING';
      this.isProcessing = false;
    }
  }

  private async transition(
    phase: PhaseLabel,
    intents: SealedIntent[],
    status: SealedIntent['status'],
    delayMs: number,
  ) {
    this.phase = phase;
    for (const intent of intents) {
      intent.status = status;
      this.clearingSheet.set(intent.id, intent);
    }

    const updates = intents.map((i) => ({ id: i.id, status: i.status }));
    await this.redis.publish(
      'void:phase',
      JSON.stringify({ type: 'STATUS_UPDATE', phase, updates }),
    );
    await sleep(delayMs);
  }
}
