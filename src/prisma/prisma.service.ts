import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['error', 'warn'],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Successfully established connection to PostgreSQL database.');
    } catch (error) {
      this.logger.warn(
        `Database connection could not be established at startup: ${(error as Error).message}. Will retry on demand.`,
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Disconnected from PostgreSQL database.');
  }

  /**
   * Health ping to check database connectivity
   */
  async checkHealth(): Promise<{ status: 'up' | 'down'; latencyMs?: number; error?: string }> {
    const start = Date.now();
    try {
      await this.$queryRaw`SELECT 1`;
      return {
        status: 'up',
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        status: 'down',
        error: (error as Error).message,
      };
    }
  }
}
