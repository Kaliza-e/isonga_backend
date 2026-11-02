import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AreasService } from '../areas/areas.service';
import { ResidentsService } from './residents.service';

describe('ResidentsService', () => {
  let service: ResidentsService;
  let prisma: Partial<Record<keyof PrismaService, any>>;
  let areasService: Partial<Record<keyof AreasService, jest.Mock>>;

  beforeEach(async () => {
    prisma = {
      residentProfile: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      administrativeArea: {
        findUnique: jest.fn(),
      },
      notificationPreference: {
        upsert: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    areasService = {
      isWithinScope: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResidentsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: AreasService,
          useValue: areasService,
        },
      ],
    }).compile();

    service = module.get<ResidentsService>(ResidentsService);
  });

  describe('getMyProfile', () => {
    it('should return profile if found', async () => {
      const mockProfile = { id: 'prof-1', userId: 'user-1', firstName: 'Patrick' };
      (prisma.residentProfile.findUnique as jest.Mock).mockResolvedValueOnce(mockProfile);

      const result = await service.getMyProfile('user-1');
      expect(result).toEqual(mockProfile);
    });

    it('should throw NotFoundException if profile does not exist', async () => {
      (prisma.residentProfile.findUnique as jest.Mock).mockResolvedValueOnce(null);

      await expect(service.getMyProfile('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateMyLocation', () => {
    it('should throw NotFoundException if target area does not exist', async () => {
      (prisma.administrativeArea.findUnique as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        service.updateMyLocation('user-1', { areaId: 'invalid-area' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update resident location to valid area', async () => {
      (prisma.administrativeArea.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'new-area-id',
        name: 'Izuba',
        level: 'VILLAGE',
      });

      (prisma.residentProfile.update as jest.Mock).mockResolvedValueOnce({
        id: 'prof-1',
        areaId: 'new-area-id',
        area: { name: 'Izuba', level: 'VILLAGE' },
      });

      const result = await service.updateMyLocation('user-1', {
        areaId: 'new-area-id',
      });

      expect(result.message).toContain('Location successfully updated to Izuba');
      expect(prisma.residentProfile.update).toHaveBeenCalled();
    });
  });

  describe('Admin Privacy & Scope Checks (getResidentsForAdmin)', () => {
    it('should mask phone numbers in admin view for privacy', async () => {
      const adminUser = { role: UserRole.SUPER_ADMIN };
      const rawResidents = [
        {
          id: 'prof-1',
          firstName: 'Patrick',
          lastName: 'Habimana',
          preferredLanguage: 'rw',
          consentGiven: true,
          area: { id: 'a1', name: 'Rebero', level: 'VILLAGE' },
          user: {
            id: 'u1',
            phone: '+250788111222',
            phoneVerified: true,
            status: 'ACTIVE',
            createdAt: new Date(),
          },
          preference: null,
        },
      ];

      (prisma.residentProfile.findMany as jest.Mock).mockResolvedValueOnce(rawResidents);

      const result = await service.getResidentsForAdmin(adminUser, {});
      expect(result[0].user.phone).toBe('+250788***222');
      expect(result[0].user.phone).not.toBe('+250788111222');
    });

    it('should throw ForbiddenException if local admin views area outside their scope', async () => {
      const sectorAdmin = {
        role: UserRole.SECTOR_ADMIN,
        adminPermissions: [{ areaId: 'remera-sector-id' }],
      };

      (areasService.isWithinScope as jest.Mock).mockResolvedValueOnce(false);

      await expect(
        service.getResidentsForAdmin(sectorAdmin, { areaId: 'musanze-district-id' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});

