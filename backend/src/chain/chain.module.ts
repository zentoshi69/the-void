import { Module } from '@nestjs/common';
import { ClearingModule } from '../clearing/clearing.module';
import { ChainWatcherService } from './chain-watcher.service';

@Module({
  imports: [ClearingModule],
  providers: [ChainWatcherService],
})
export class ChainModule {}
