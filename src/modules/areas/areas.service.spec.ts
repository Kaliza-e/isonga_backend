import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AreaLevel, AdministrativeArea} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AreasService } from './areas.service';

describe('AreasService', () => {
  let service: AreasService;
  let prisma: Partial<Record<keyof PrismaService, any>>;

  const mockRwanda: AdministrativeArea = {
    id: 'rw-id',
    code: 'RW',
    name: 'Rwanda',
    level: AreaLevel.COUNTRY,
    parentId: null,
    path: '/rwanda',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockKigali: AdministrativeArea = {
    id: 'kgl-id',
    code: '01',
    name: 'City of Kigali',
    level: AreaLevel.PROVINCE,
    parentId: 'rw-id',
    path: '/rwanda/kigali',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockGasabo: AdministrativeArea = {
    id: 'gsb-id',
    code: '0101',
    name: 'Gasabo',
    level: AreaLevel.DISTRICT,
    parentId: 'kgl-id',
    path: '/rwanda/kigali/gasabo',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRemera: AdministrativeArea = {
    id: 'rmr-id',
    code: '010101',
    name: 'Remera',
    level: AreaLevel.SECTOR,
    parentId: 'gsb-id',
    path: '/rwanda/kigali/gasabo/remera',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRukiri1: AdministrativeArea = {
    id: 'rkr-id',
    code: '01010101',
    name: 'Rukiri I',
    level: AreaLevel.CELL,
    parentId: 'rmr-id',
    path: '/rwanda/kigali/gasabo/remera/rukiri-1',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRebero: AdministrativeArea = {
    id: 'rbr-id',
    code: '0101010101',
    name: 'Rebero',
    level: AreaLevel.VILLAGE,
    parentId: 'rkr-id',
    path: '/rwanda/kigali/gasabo/remera/rukiri-1/rebero',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockNyarugenge: AdministrativeArea = {
    id: 'nyr-id',
    code: '0102',
    name: 'Nyarugenge',
    level: AreaLevel.DISTRICT,
    parentId: 'kgl-id',
    path: '/rwanda/kigali/nyarugenge',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      administrativeArea: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AreasService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<AreasService>(AreasService);
  });

  describe('Geographical Hierarchy Validation', () => {
    it('should validate COUNTRY level has no parent', () => {
      expect(() => service.validateHierarchy(AreaLevel.COUNTRY, null)).not.toThrow();
      expect(() => service.validateHierarchy(AreaLevel.COUNTRY, mockRwanda)).toThrow(
        BadRequestException,
      );
    });

    it('should validate PROVINCE level parent must be COUNTRY', () => {
      expect(() => service.validateHierarchy(AreaLevel.PROVINCE, mockRwanda)).not.toThrow();
      expect(() => service.validateHierarchy(AreaLevel.PROVINCE, mockGasabo)).toThrow(
        BadRequestException,
      );
    });

    it('should validate DISTRICT level parent must be PROVINCE', () => {
      expect(() => service.validateHierarchy(AreaLevel.DISTRICT, mockKigali)).not.toThrow();
      expect(() => service.validateHierarchy(AreaLevel.DISTRICT, mockRwanda)).toThrow(
        BadRequestException,
      );
    });

    it('should validate SECTOR level parent must be DISTRICT', () => {
      expect(() => service.validateHierarchy(AreaLevel.SECTOR, mockGasabo)).not.toThrow();
      expect(() => service.validateHierarchy(AreaLevel.SECTOR, mockKigali)).toThrow(
        BadRequestException,
      );
    });

    it('should validate CELL level parent must be SECTOR', () => {
      expect(() => service.validateHierarchy(AreaLevel.CELL, mockRemera)).not.toThrow();
      expect(() => service.validateHierarchy(AreaLevel.CELL, mockGasabo)).toThrow(
        BadRequestException,
      );
    });

    it('should validate VILLAGE level parent must be CELL', () => {
      expect(() => service.validateHierarchy(AreaLevel.VILLAGE, mockRukiri1)).not.toThrow();
      expect(() => service.validateHierarchy(AreaLevel.VILLAGE, mockRemera)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('Scope Validation (isWithinScope)', () => {
    it('should return true for identical area IDs', async () => {
      const result = await service.isWithinScope('gsb-id', 'gsb-id');
      expect(result).toBe(true);
    });

    it('should return true when target is a subordinate of admin area', async () => {
      (prisma.administrativeArea.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockGasabo)
        .mockResolvedValueOnce(mockRemera);

      const result = await service.isWithinScope(mockGasabo.id, mockRemera.id);
      expect(result).toBe(true);
    });

    it('should return false when target is outside admin area hierarchy', async () => {
      (prisma.administrativeArea.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockGasabo)
        .mockResolvedValueOnce(mockNyarugenge);

      const result = await service.isWithinScope(mockGasabo.id, mockNyarugenge.id);
      expect(result).toBe(false);
    });
  });

  describe('create Area', () => {
    it('should reject creation if code already exists', async () => {
      (prisma.administrativeArea.findUnique as jest.Mock).mockResolvedValueOnce(mockGasabo);

      await expect(
        service.create({
          code: '0101',
          name: 'Gasabo Duplicate',
          level: AreaLevel.DISTRICT,
          parentId: 'kgl-id',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should compute materialized path and create area', async () => {
      (prisma.administrativeArea.findUnique as jest.Mock)
        .mockResolvedValueOnce(null) // code check
        .mockResolvedValueOnce(mockRukiri1); // parent check

      (prisma.administrativeArea.create as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({ id: 'new-vlg-id', ...data }),
      );

      const result = await service.create({
        code: '0101010103',
        name: 'Amahoro',
        level: AreaLevel.VILLAGE,
        parentId: mockRukiri1.id,
      });

      expect(result.path).toBe('/rwanda/kigali/gasabo/remera/rukiri-1/amahoro');
      expect(prisma.administrativeArea.create).toHaveBeenCalledWith({
        data: {
          code: '0101010103',
          name: 'Amahoro',
          level: AreaLevel.VILLAGE,
          parentId: mockRukiri1.id,
          path: '/rwanda/kigali/gasabo/remera/rukiri-1/amahoro',
        },
      });
    });
  });
});

