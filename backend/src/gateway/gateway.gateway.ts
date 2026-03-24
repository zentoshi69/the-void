import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger, OnModuleInit } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Server, Socket } from 'socket.io';
import { ClearingEngineService } from '../clearing/clearing-engine.service';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/live' })
export class VoidGateway
  implements OnGatewayInit, OnGatewayConnection, OnModuleInit
{
  private readonly logger = new Logger(VoidGateway.name);
  private subscriber!: Redis;

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly clearingEngine: ClearingEngineService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  afterInit() {
    this.logger.log('WebSocket gateway /live initialised');
  }

  handleConnection(client: Socket) {
    const initPayload = {
      sheet: this.clearingEngine.getLiveSheet(),
      batches: this.clearingEngine.getBatchHistory(),
      stats: this.clearingEngine.getStats(),
      window: this.clearingEngine.getWindowInfo(),
    };
    client.emit('init', initPayload);
    this.logger.log(`Client connected: ${client.id}`);
  }

  async onModuleInit() {
    this.subscriber = this.redis.duplicate();

    await this.subscriber.subscribe('void:phase', 'void:batches', 'void:intent');

    this.subscriber.on('message', (channel: string, message: string) => {
      try {
        const data = JSON.parse(message);

        if (channel === 'void:intent') {
          this.server.emit('sheet', {
            type: 'INTENT_SEALED',
            entry: data,
          });
        } else if (channel === 'void:phase') {
          this.server.emit('sheet', data);
        } else if (channel === 'void:batches') {
          this.server.emit('batch', data);
        }
      } catch (err) {
        this.logger.error(`Failed to parse Redis message on ${channel}`, err);
      }
    });

    this.logger.log('Subscribed to Redis channels: void:phase, void:batches, void:intent');
  }
}
