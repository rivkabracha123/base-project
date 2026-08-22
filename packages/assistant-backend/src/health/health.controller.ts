import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ready', database: 'connected' };
    } catch {
      throw new ServiceUnavailableException('Database is not ready');
    }
  }
}
