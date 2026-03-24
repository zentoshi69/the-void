import { Module } from '@nestjs/common';
import { ClearingEngineService } from './clearing-engine.service';
import { NettingEngineService } from './netting-engine.service';
import { ProofService } from './proof.service';

@Module({
  providers: [ClearingEngineService, NettingEngineService, ProofService],
  exports: [ClearingEngineService],
})
export class ClearingModule {}
