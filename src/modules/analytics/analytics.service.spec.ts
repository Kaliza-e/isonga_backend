import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: Partial<Record<keyof PrismaService, any>>;

  beforeEach(async () => {
    prisma = {
      announcement: {
        count: jest.fn().mockResolvedValue(5),
        findUnique: jest.fn(),
      },
      residentProfile: {
        count: jest.fn().mockResolvedValue(100),
      },
      notificationLog: {
        count: jest.fn().mockResolvedValue(250),
        groupBy: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  it('should return overview metrics accurately', async () => {
    const result = await service.getOverview();
    expect(result.announcements.total).toBe(5);
    expect(result.residents.totalRegistered).toBe(100);
    expect(result.notifications.totalDispatched).toBe(250);
  });

  it('should calculate channel delivery performance', async () => {
    const result = await service.getChannelPerformance();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(3); // SMS, PUSH, IN_APP
    expect(result[0]).toHaveProperty('channel');
    expect(result[0]).toHaveProperty('deliveryRatePercentage');
  });
});
