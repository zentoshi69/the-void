import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule } from '@nestjs-modules/ioredis';
import { ClearingModule } from './clearing/clearing.module';
import { GatewayModule } from './gateway/gateway.module';
import { ChainModule } from './chain/chain.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '../.env' }),
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'single' as const,
        url: config.get('REDIS_URL', 'redis://localhost:6379'),
      }),
    }),
    ClearingModule,
    GatewayModule,
    ChainModule,
  ],
})
export class AppModule {}
