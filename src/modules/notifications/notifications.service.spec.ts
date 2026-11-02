import { Test, TestingModule } from '@nestjs/testing';
import {
  NotificationChannel,
  NotificationStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TargetingService } from '../targeting/targeting.service';
import { SmsService } from '../sms/sms.service';
import { PushService } from '../push/push.service';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: Partial<Record<keyof PrismaService, any>>;
  let targetingService: Partial<Record<keyof TargetingService, jest.Mock>>;
  let smsService: Partial<Record<keyof SmsService, jest.Mock>>;
  let pushService: Partial<Record<keyof PushService, jest.Mock>>;

  beforeEach(async () => {
    prisma = {
      announcement: {
        findUnique: jest.fn(),
      },
      notificationLog: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    targetingService = {
      resolveEligibleResidents: jest.fn(),
    };

    smsService = {
      send: jest.fn(),
    };

    pushService = {
      send: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: TargetingService,
          useValue: targetingService,
        },
        {
          provide: SmsService,
          useValue: smsService,
        },
        {
          provide: PushService,
          useValue: pushService,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('dispatchAnnouncement', () => {
    it('should dispatch multi-channel notifications and record SUBMITTED state', async () => {
      const mockAnnouncement = {
        id: 'ann-1',
        title: 'Umuganda Alert',
        content: 'Please arrive on time',
        category: 'UMUGANDA',
        priority: 'NORMAL',
        targets: [{ areaId: 'remera-id', includeSubordinates: true }],
      };

      (prisma.announcement.findUnique as jest.Mock).mockResolvedValueOnce(mockAnnouncement);

      const mockResident = {
        id: 'prof-1',
        preference: { smsEnabled: true, pushEnabled: true, inAppEnabled: true },
        user: {
          id: 'user-1',
          phone: '+250788111222',
          subscriptions: [{ token: 'fcm-token-1' }],
        },
      };

      (targetingService.resolveEligibleResidents as jest.Mock).mockResolvedValueOnce([mockResident]);
      (prisma.notificationLog.findFirst as jest.Mock).mockResolvedValue(null); // No previous duplicate logs
      (prisma.notificationLog.create as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({ id: `log-${data.channel}`, ...data }),
      );

      (smsService.send as jest.Mock).mockResolvedValueOnce({
        success: true,
        messageId: 'mock-sms-id',
        rawResponse: { status: 'SUBMITTED' },
      });

      (pushService.send as jest.Mock).mockResolvedValueOnce({
        success: true,
        messageId: 'mock-push-id',
      });

      const result = await service.dispatchAnnouncement('ann-1');

      expect(result.totalTargeted).toBe(1);
      expect(result.smsSubmitted).toBe(1);
      expect(result.pushSubmitted).toBe(1);
      expect(result.inAppDelivered).toBe(1);
      expect(smsService.send).toHaveBeenCalledWith('+250788111222', expect.any(String));
    });
  });

  describe('handleDeliveryReceipt (DLR)', () => {
    it('should transition status to DELIVERED when confirmed by carrier DLR', async () => {
      const mockLog = {
        id: 'log-1',
        providerRef: 'mock-sms-id',
        status: NotificationStatus.SUBMITTED,
      };

      (prisma.notificationLog.findFirst as jest.Mock).mockResolvedValueOnce(mockLog);
      (prisma.notificationLog.update as jest.Mock).mockResolvedValueOnce({
        ...mockLog,
        status: NotificationStatus.DELIVERED,
      });

      const result = await service.handleDeliveryReceipt('mock-sms-id', 'DELIVERED');
      expect(result.newStatus).toBe('DELIVERED');
      expect(prisma.notificationLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: NotificationStatus.DELIVERED,
          }),
        }),
      );
    });
  });
});

