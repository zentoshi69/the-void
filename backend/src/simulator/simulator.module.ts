import { Module } from '@nestjs/common';
import { ClearingModule } from '../clearing/clearing.module';
import { SimulatorService } from './simulator.service';

@Module({
  imports: [ClearingModule],
  providers: [SimulatorService],
})
export class SimulatorModule {}
