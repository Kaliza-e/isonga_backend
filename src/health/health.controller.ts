import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthCheckResponse, HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: 'System health check',
    description: 'Returns the health status of the application, database, and system metrics.',
  })
  @ApiResponse({
    status: 200,
    description: 'System is healthy and fully operational.',
  })
  @ApiResponse({
    status: 503,
    description: 'System is degraded (e.g. database connection down).',
  })
  async check(): Promise<HealthCheckResponse> {
    const health = await this.healthService.check();
    if (health.status === 'degraded') {
      throw new HttpException(health, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return health;
  }
}
