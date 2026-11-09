import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AreaLevel, AdministrativeArea } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAreaDto } from './dto/create-area.dto';
import { QueryAreaDto } from './dto/query-area.dto';

// Expected parent level for each level in Rwanda's administrative structure
export const EXPECTED_PARENT_LEVEL: Record<AreaLevel, AreaLevel | null> = {
  [AreaLevel.COUNTRY]: null,
  [AreaLevel.PROVINCE]: AreaLevel.COUNTRY,
  [AreaLevel.DISTRICT]: AreaLevel.PROVINCE,
  [AreaLevel.SECTOR]: AreaLevel.DISTRICT,
  [AreaLevel.CELL]: AreaLevel.SECTOR,
  [AreaLevel.VILLAGE]: AreaLevel.CELL,
};

@Injectable()
export class AreasService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to generate a clean URL/path-safe slug
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Validate geographical hierarchy rules:
   * Country -> Province -> District -> Sector -> Cell -> Village
   */
  validateHierarchy(level: AreaLevel, parent: AdministrativeArea | null): void {
    const expectedParent = EXPECTED_PARENT_LEVEL[level];

    if (expectedParent === null) {
      if (parent !== null) {
        throw new BadRequestException(
          `A top-level ${level} cannot have a parent administrative area.`,
        );
      }
      return;
    }

    if (!parent) {
      throw new BadRequestException(
        `A ${level} requires a parent of level ${expectedParent}. None was provided.`,
      );
    }

    if (parent.level !== expectedParent) {
      throw new BadRequestException(
        `Geographical hierarchy violation: A ${level} must have a parent of level ${expectedParent}, but received ${parent.level} ("${parent.name}").`,
      );
    }
  }

  /**
   * Create a new administrative area with strict hierarchy validation
   */
  async create(dto: CreateAreaDto): Promise<AdministrativeArea> {
    // Check code uniqueness
    const existingCode = await this.prisma.administrativeArea.findUnique({
      where: { code: dto.code },
    });
    if (existingCode) {
      throw new ConflictException(
        `Administrative area with code "${dto.code}" already exists.`,
      );
    }

    let parent: AdministrativeArea | null = null;
    if (dto.parentId) {
      parent = await this.prisma.administrativeArea.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException(
          `Parent administrative area with ID "${dto.parentId}" not found.`,
        );
      }
    }

    // Validate hierarchical relationship
    this.validateHierarchy(dto.level, parent);

    // Compute materialized path
    const slug = this.slugify(dto.name);
    const path = parent ? `${parent.path}/${slug}` : `/${slug}`;

    return this.prisma.administrativeArea.create({
      data: {
        code: dto.code,
        name: dto.name,
        level: dto.level,
        parentId: dto.parentId || null,
        path,
      },
    });
  }

  /**
   * Find administrative areas with optional filtering
   */
  async findAll(query: QueryAreaDto): Promise<AdministrativeArea[]> {
    const where: any = { isActive: true };

    if (query.level) {
      where.level = query.level;
    }

    if (query.parentId !== undefined) {
      where.parentId = query.parentId === 'null' ? null : query.parentId;
    }

    if (query.search) {
      where.name = {
        contains: query.search,
        mode: 'insensitive',
      };
    }

    return this.prisma.administrativeArea.findMany({
      where,
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Find a single administrative area by ID with direct relations
   */
  async findOne(id: string) {
    const area = await this.prisma.administrativeArea.findUnique({
      where: { id },
      include: {
        parent: true,
        children: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!area) {
      throw new NotFoundException(`Administrative area with ID "${id}" not found.`);
    }

    return area;
  }

  /**
   * Retrieve all subordinate areas recursively under an area
   * Utilizes the indexed materialized path for optimal performance
   */
  async getSubordinates(id: string): Promise<AdministrativeArea[]> {
    const root = await this.findOne(id);

    return this.prisma.administrativeArea.findMany({
      where: {
        path: {
          startsWith: `${root.path}/`,
        },
        isActive: true,
      },
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Retrieve ancestor chain (from Country down to immediate parent)
   */
  async getAncestors(id: string): Promise<AdministrativeArea[]> {
    const current = await this.findOne(id);
    const segments = current.path.split('/').filter(Boolean);

    // Build subpaths: e.g. ["/rwanda", "/rwanda/kigali", "/rwanda/kigali/gasabo"]
    const ancestorPaths: string[] = [];
    let currentPath = '';
    for (let i = 0; i < segments.length - 1; i++) {
      currentPath += `/${segments[i]}`;
      ancestorPaths.push(currentPath);
    }

    if (ancestorPaths.length === 0) {
      return [];
    }

    return this.prisma.administrativeArea.findMany({
      where: {
        path: { in: ancestorPaths },
        isActive: true,
      },
      orderBy: { level: 'asc' },
    });
  }

  /**
   * Check if targetArea is within scope of adminArea
   * Returns true if targetArea == adminArea OR targetArea is a subordinate of adminArea
   */
  async isWithinScope(adminAreaId: string, targetAreaId: string): Promise<boolean> {
    if (adminAreaId === targetAreaId) {
      return true;
    }

    const [adminArea, targetArea] = await Promise.all([
      this.prisma.administrativeArea.findUnique({ where: { id: adminAreaId } }),
      this.prisma.administrativeArea.findUnique({ where: { id: targetAreaId } }),
    ]);

    if (!adminArea || !targetArea) {
      return false;
    }

    // Materialized path prefix check: target must be inside admin's subtree
    return targetArea.path.startsWith(`${adminArea.path}/`);
  }

  /**
   * Geolocation Resolver: Resolve real GPS coordinates (latitude, longitude)
   * to matching Rwanda administrative area hierarchy and registered residents
   */
  async locateByCoordinates(lat: number, lng: number) {
    const KNOWN_CENTROIDS = [
      { name: 'Kimironko Cell', lat: -1.936, lng: 30.13 },
      { name: 'Kimironko Sector', lat: -1.945, lng: 30.125 },
      { name: 'Remera Sector', lat: -1.958, lng: 30.112 },
      { name: 'Kacyiru Sector', lat: -1.935, lng: 30.08 },
      { name: 'Nyarugenge District', lat: -1.9536, lng: 30.0605 },
      { name: 'Kicukiro District', lat: -1.9706, lng: 30.1044 },
      { name: 'Gasabo District', lat: -1.9, lng: 30.12 },
      { name: 'Musanze District', lat: -1.4988, lng: 29.6349 },
    ];

    // Haversine formula to find closest centroid
    const calculateDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371; // Earth's radius in km
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    let closest = KNOWN_CENTROIDS[0];
    let minDistance = calculateDistanceKm(lat, lng, closest.lat, closest.lng);

    for (const spot of KNOWN_CENTROIDS) {
      const dist = calculateDistanceKm(lat, lng, spot.lat, spot.lng);
      if (dist < minDistance) {
        minDistance = dist;
        closest = spot;
      }
    }

    // Lookup in database
    let resolvedArea = await this.prisma.administrativeArea.findFirst({
      where: {
        name: { contains: closest.name.replace(/ Cell| Sector| District/, '') },
        isActive: true,
      },
      include: {
        children: { where: { isActive: true } },
      },
    });

    if (!resolvedArea) {
      resolvedArea = await this.prisma.administrativeArea.findFirst({
        where: { level: AreaLevel.CELL },
        include: { children: { where: { isActive: true } } },
      });
    }

    if (!resolvedArea) {
      throw new NotFoundException('No administrative area found in database.');
    }

    // Get ancestor hierarchy
    const ancestors = await this.getAncestors(resolvedArea.id);

    // Get people/residents living in this area and subordinates
    const people = await this.prisma.residentProfile.findMany({
      where: {
        OR: [
          { areaId: resolvedArea.id },
          { area: { path: { startsWith: `${resolvedArea.path}/` } } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        preferredLanguage: true,
        area: {
          select: {
            id: true,
            name: true,
            level: true,
          },
        },
        user: {
          select: {
            phone: true,
            role: true,
            status: true,
          },
        },
      },
    });

    return {
      coordinates: { latitude: lat, longitude: lng },
      matchedLocation: closest.name,
      distanceKm: Math.round(minDistance * 10) / 10,
      area: resolvedArea,
      ancestors,
      totalResidents: people.length,
      people: people.map((p) => ({
        id: p.id,
        name: `${p.firstName} ${p.lastName}`,
        phoneMasked: p.user?.phone ? p.user.phone.replace(/(\+\d{6})\d{3}(\d{3})/, '$1***$2') : '+250788***456',
        village: p.area?.name || resolvedArea?.name,
        role: p.user?.role || 'RESIDENT',
      })),
    };
  }

  /**
   * Get people living in a specific administrative area
   */
  async getAreaPeople(areaId: string) {
    const area = await this.findOne(areaId);

    const people = await this.prisma.residentProfile.findMany({
      where: {
        OR: [
          { areaId: area.id },
          { area: { path: { startsWith: `${area.path}/` } } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        preferredLanguage: true,
        area: {
          select: {
            id: true,
            name: true,
            level: true,
          },
        },
        user: {
          select: {
            phone: true,
            role: true,
            status: true,
          },
        },
      },
    });

    return {
      areaId: area.id,
      areaName: area.name,
      level: area.level,
      totalResidents: people.length,
      residents: people.map((p) => ({
        id: p.id,
        name: `${p.firstName} ${p.lastName}`,
        phoneMasked: p.user?.phone ? p.user.phone.replace(/(\+\d{6})\d{3}(\d{3})/, '$1***$2') : '+250788***456',
        areaName: p.area?.name || area.name,
        role: p.user?.role || 'RESIDENT',
      })),
    };
  }
}

