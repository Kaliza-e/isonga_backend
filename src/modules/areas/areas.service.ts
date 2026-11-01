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
}

