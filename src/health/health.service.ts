import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export interface HealthCheckResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  service: string;
  version: string;
  environment: string;
  uptimeSeconds: number;
  checks: {
    database: {
      status: 'up' | 'down';
      latencyMs?: number;
      error?: string;
    };
    memory: {
      heapUsedMb: number;
      heapTotalMb: number;
      rssMb: number;
    };
  };
}

@Injectable()
export class HealthService {
  private readonly startTime = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async check(): Promise<HealthCheckResponse> {
    const dbHealth = await this.prisma.checkHealth();
    const memoryUsage = process.memoryUsage();

    const isHealthy = dbHealth.status === 'up';

    return {
      status: isHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'Isonga Connect API',
      version: '0.0.1',
      environment: this.configService.get<string>('nodeEnv', 'development'),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      checks: {
        database: dbHealth,
        memory: {
          heapUsedMb: Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100,
          heapTotalMb: Math.round((memoryUsage.heapTotal / 1024 / 1024) * 100) / 100,
          rssMb: Math.round((memoryUsage.rss / 1024 / 1024) * 100) / 100,
        },
      },
    };
  }
}
