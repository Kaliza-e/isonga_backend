import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AnnouncementCategory,
  AnnouncementPriority,
  AnnouncementStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AreasService } from '../areas/areas.service';
import { TargetingService } from '../targeting/targeting.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AnnouncementsService } from './announcements.service';

describe('AnnouncementsService', () => {
  let service: AnnouncementsService;
  let prisma: Partial<Record<keyof PrismaService, any>>;
  let areasService: Partial<Record<keyof AreasService, jest.Mock>>;
  let targetingService: Partial<Record<keyof TargetingService, jest.Mock>>;

  beforeEach(async () => {
    prisma = {
      announcement: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      administrativeArea: {
        findUnique: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    areasService = {
      isWithinScope: jest.fn(),
      getAncestors: jest.fn(),
    };

    targetingService = {
      previewRecipients: jest.fn().mockResolvedValue({
        totalEligible: 50,
        smsEligible: 50,
        pushEligible: 10,
        inAppEligible: 50,
        targetAreaNames: ['Remera'],
      }),
      resolveEligibleResidents: jest.fn().mockResolvedValue([
        { id: 'res-1', user: { id: 'u-1', phone: '+250788111222' } },
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnnouncementsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: AreasService,
          useValue: areasService,
        },
        {
          provide: TargetingService,
          useValue: targetingService,
        },
        {
          provide: NotificationsService,
          useValue: {
            dispatchAnnouncement: jest.fn().mockResolvedValue({
              totalTargeted: 1,
              smsSubmitted: 1,
              pushSubmitted: 0,
              inAppDelivered: 1,
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AnnouncementsService>(AnnouncementsService);
  });

  describe('create announcement & scope verification', () => {
    it('should throw ForbiddenException if local admin targets area outside their jurisdiction', async () => {
      const sectorAdmin = {
        id: 'admin-1',
        role: UserRole.SECTOR_ADMIN,
        adminPermissions: [{ areaId: 'remera-id', canBroadcastEmergency: false }],
      };

      (areasService.isWithinScope as jest.Mock).mockResolvedValueOnce(false);
      (prisma.administrativeArea.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'musanze-id',
        name: 'Musanze',
      });

      await expect(
        service.create(sectorAdmin, {
          title: 'Unauthorized announcement',
          content: 'Notice content',
          category: AnnouncementCategory.UMUGANDA,
          targetAreaIds: ['musanze-id'],
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if admin attempts EMERGENCY priority without authorization', async () => {
      const sectorAdmin = {
        id: 'admin-1',
        role: UserRole.SECTOR_ADMIN,
        adminPermissions: [{ areaId: 'remera-id', canBroadcastEmergency: false }],
      };

      await expect(
        service.create(sectorAdmin, {
          title: 'Emergency Notice',
          content: 'Critical evacuation notice',
          category: AnnouncementCategory.EMERGENCY,
          priority: AnnouncementPriority.EMERGENCY,
          targetAreaIds: ['remera-id'],
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should successfully create DRAFT announcement when authorized', async () => {
      const sectorAdmin = {
        id: 'admin-1',
        role: UserRole.SECTOR_ADMIN,
        adminPermissions: [{ areaId: 'remera-id', canBroadcastEmergency: true }],
      };

      (areasService.isWithinScope as jest.Mock).mockResolvedValueOnce(true);
      (prisma.announcement.create as jest.Mock).mockResolvedValueOnce({
        id: 'ann-1',
        title: 'Community Notice',
        status: AnnouncementStatus.DRAFT,
        recipientCount: 50,
      });

      const result = await service.create(sectorAdmin, {
        title: 'Community Notice',
        content: 'Valid announcement content',
        category: AnnouncementCategory.COMMUNITY_MEETINGS,
        targetAreaIds: ['remera-id'],
      });

      expect(result.id).toBe('ann-1');
      expect(result.status).toBe(AnnouncementStatus.DRAFT);
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('publish announcement', () => {
    it('should throw BadRequestException if announcement is already published', async () => {
      const admin = { id: 'admin-1', role: UserRole.SUPER_ADMIN };
      (prisma.announcement.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'ann-1',
        status: AnnouncementStatus.PUBLISHED,
        targets: [{ areaId: 'remera-id' }],
      });

      await expect(service.publish('ann-1', admin)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should transition status to PUBLISHED and record recipientCount', async () => {
      const admin = { id: 'admin-1', role: UserRole.SUPER_ADMIN };
      (prisma.announcement.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'ann-1',
        title: 'Clean Up',
        category: AnnouncementCategory.UMUGANDA,
        priority: AnnouncementPriority.NORMAL,
        status: AnnouncementStatus.DRAFT,
        targets: [{ areaId: 'remera-id', includeSubordinates: true }],
      });

      (prisma.announcement.update as jest.Mock).mockResolvedValueOnce({
        id: 'ann-1',
        status: AnnouncementStatus.PUBLISHED,
        recipientCount: 1,
      });

      const result = await service.publish('ann-1', admin);
      expect(result.message).toContain('Announcement published successfully');
      expect(result.eligibleRecipients).toBe(1);
    });
  });

  describe('cancel announcement', () => {
    it('should update status to CANCELLED with reason', async () => {
      const admin = { id: 'admin-1', role: UserRole.SUPER_ADMIN };
      (prisma.announcement.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'ann-1',
        status: AnnouncementStatus.SCHEDULED,
        targets: [{ areaId: 'remera-id' }],
      });

      (prisma.announcement.update as jest.Mock).mockResolvedValueOnce({
        id: 'ann-1',
        status: AnnouncementStatus.CANCELLED,
        cancelledReason: 'Postponed',
      });

      const result = await service.cancel('ann-1', admin, { reason: 'Postponed' });
      expect(result.announcement.status).toBe(AnnouncementStatus.CANCELLED);
    });
  });
});

