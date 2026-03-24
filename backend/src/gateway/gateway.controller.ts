import { Controller, Get } from '@nestjs/common';
import { ClearingEngineService } from '../clearing/clearing-engine.service';

@Controller('api')
export class GatewayController {
  constructor(private readonly clearingEngine: ClearingEngineService) {}

  @Get('sheet')
  getSheet() {
    return this.clearingEngine.getLiveSheet();
  }

  @Get('batches')
  getBatches() {
    return this.clearingEngine.getBatchHistory();
  }

  @Get('stats')
  getStats() {
    return this.clearingEngine.getStats();
  }

  @Get('window')
  getWindow() {
    return this.clearingEngine.getWindowInfo();
  }

  @Get('health')
  getHealth() {
    return { ok: true, uptime: process.uptime() };
  }
}
