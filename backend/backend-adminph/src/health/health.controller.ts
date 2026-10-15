import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Controller('health')
export class HealthController {
  constructor(private readonly db: DatabaseService) {}
  @Get()
  async health() {
    const q = await this.db.query('SELECT NOW() AS database_time');
    return { ok: true, service: 'adminph-backend', database: 'connected', databaseTime: q.rows[0].database_time };
  }
}
