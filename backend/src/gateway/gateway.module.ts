import { Module } from '@nestjs/common';
import { ClearingModule } from '../clearing/clearing.module';
import { GatewayController } from './gateway.controller';
import { VoidGateway } from './gateway.gateway';

@Module({
  imports: [ClearingModule],
  controllers: [GatewayController],
  providers: [VoidGateway],
})
export class GatewayModule {}
