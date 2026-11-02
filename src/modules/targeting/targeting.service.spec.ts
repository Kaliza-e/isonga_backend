import { Test, TestingModule } from '@nestjs/testing';
import { AnnouncementCategory, AnnouncementPriority } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TargetingService } from './targeting.service';

describe('TargetingService', () => {
  let service: TargetingService;
  let prisma: Partial<Record<keyof PrismaService, any>>;

  beforeEach(async () => {
    prisma = {
      administrativeArea: {
        findMany: jest.fn(),
      },
      residentProfile: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TargetingService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<TargetingService>(TargetingService);
  });

  it('should return empty summary if no areas provided', async () => {
    const result = await service.previewRecipients({
      areaIds: [],
      category: AnnouncementCategory.UMUGANDA,
      priority: AnnouncementPriority.NORMAL,
    });

    expect(result.totalEligible).toBe(0);
    expect(result.smsEligible).toBe(0);
  });

  it('should resolve eligible residents and count channel breakdown correctly', async () => {
    const mockArea = { id: 'gsb-id', name: 'Gasabo', path: '/rwanda/kigali/gasabo' };
    (prisma.administrativeArea.findMany as jest.Mock)
      .mockResolvedValueOnce([mockArea]) // target areas
      .mockResolvedValueOnce([mockArea]); // names

    const mockResident1 = {
      id: 'res-1',
      preference: { smsEnabled: true, pushEnabled: true, inAppEnabled: true },
      user: {
        id: 'u-1',
        phone: '+250788111222',
        subscriptions: [{ token: 'fcm-token-1' }],
      },
    };
    const mockResident2 = {
      id: 'res-2',
      preference: { smsEnabled: true, pushEnabled: false, inAppEnabled: true },
      user: {
        id: 'u-2',
        phone: '+250788333444',
        subscriptions: [],
      },
    };

    (prisma.residentProfile.findMany as jest.Mock).mockResolvedValueOnce([
      mockResident1,
      mockResident2,
    ]);

    const result = await service.previewRecipients({
      areaIds: ['gsb-id'],
      includeSubordinates: true,
      category: AnnouncementCategory.UMUGANDA,
      priority: AnnouncementPriority.NORMAL,
    });

    expect(result.totalEligible).toBe(2);
    expect(result.smsEligible).toBe(2);
    expect(result.pushEligible).toBe(1);
    expect(result.targetAreaNames).toEqual(['Gasabo']);
  });

  it('should bypass category opt-out filter when priority is EMERGENCY', async () => {
    const mockArea = { id: 'gsb-id', name: 'Gasabo', path: '/rwanda/kigali/gasabo' };
    (prisma.administrativeArea.findMany as jest.Mock)
      .mockResolvedValueOnce([mockArea])
      .mockResolvedValueOnce([mockArea]);

    (prisma.residentProfile.findMany as jest.Mock).mockResolvedValueOnce([]);

    await service.previewRecipients({
      areaIds: ['gsb-id'],
      category: AnnouncementCategory.EMERGENCY,
      priority: AnnouncementPriority.EMERGENCY,
    });

    // Check that preference query did not filter out residents for emergency
    const queryArg = (prisma.residentProfile.findMany as jest.Mock).mock.calls[0][0];
    expect(queryArg.where.preference).toEqual({});
  });
});

