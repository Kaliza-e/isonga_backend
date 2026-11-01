import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthCheckResponse, HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: Partial<Record<keyof HealthService, jest.Mock>>;

  beforeEach(async () => {
    healthService = {
      check: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: healthService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should return health payload when system is healthy (status ok)', async () => {
    const mockResponse: HealthCheckResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'Isonga Connect API',
      version: '0.0.1',
      environment: 'test',
      uptimeSeconds: 10,
      checks: {
        database: { status: 'up', latencyMs: 5 },
        memory: { heapUsedMb: 50, heapTotalMb: 100, rssMb: 120 },
      },
    };

    (healthService.check as jest.Mock).mockResolvedValue(mockResponse);

    const result = await controller.check();
    expect(result).toEqual(mockResponse);
    expect(result.status).toBe('ok');
    expect(result.checks.database.status).toBe('up');
  });

  it('should throw HttpException with 503 when system is degraded (database down)', async () => {
    const mockDegradedResponse: HealthCheckResponse = {
      status: 'degraded',
      timestamp: new Date().toISOString(),
      service: 'Isonga Connect API',
      version: '0.0.1',
      environment: 'test',
      uptimeSeconds: 10,
      checks: {
        database: { status: 'down', error: 'Connection refused' },
        memory: { heapUsedMb: 50, heapTotalMb: 100, rssMb: 120 },
      },
    };

    (healthService.check as jest.Mock).mockResolvedValue(mockDegradedResponse);

    await expect(controller.check()).rejects.toThrow(HttpException);

    try {
      await controller.check();
    } catch (error) {
      const httpError = error as HttpException;
      expect(httpError.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(httpError.getResponse()).toEqual(mockDegradedResponse);
    }
  });
});

