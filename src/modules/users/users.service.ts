import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignPermissionDto } from './dto/assign-permission.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find user by ID with complete profile, area, and permission tree
   */
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        phone: true,
        phoneVerified: true,
        email: true,
        emailVerified: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        residentProfile: {
          include: {
            area: true,
            preference: true,
          },
        },
        adminPermissions: {
          include: {
            area: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" was not found.`);
    }

    return user;
  }

  /**
   * List users with pagination and role/status filtering
   */
  async findAll(query: { role?: UserRole; status?: UserStatus; search?: string }) {
    const where: any = {};

    if (query.role) where.role = query.role;
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { phone: { contains: query.search } },
        { email: { contains: query.search, mode: 'insensitive' } },
        {
          residentProfile: {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        phone: true,
        phoneVerified: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        residentProfile: {
          select: {
            firstName: true,
            lastName: true,
            area: {
              select: {
                id: true,
                name: true,
                level: true,
                path: true,
              },
            },
          },
        },
        adminPermissions: {
          select: {
            area: {
              select: {
                id: true,
                name: true,
                level: true,
              },
            },
            canPublish: true,
            canBroadcastEmergency: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update user details
   */
  async update(id: string, dto: UpdateUserDto, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" was not found.`);
    }

    if (dto.email && dto.email !== user.email) {
      const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (existing) {
        throw new ConflictException('This email is already in use by another account.');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        email: dto.email,
        status: dto.status,
        role: dto.role,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: AuditAction.USER_UPDATE,
        resource: 'User',
        resourceId: id,
        details: { changes: JSON.parse(JSON.stringify(dto)) },
      },
    });

    return updated;
  }

  /**
   * Assign geographical administrative permissions to a user
   */
  async assignPermission(
    userId: string,
    dto: AssignPermissionDto,
    grantedById: string,
  ) {
    const [targetUser, targetArea] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.administrativeArea.findUnique({ where: { id: dto.areaId } }),
    ]);

    if (!targetUser) {
      throw new NotFoundException(`User with ID "${userId}" not found.`);
    }

    if (!targetArea) {
      throw new NotFoundException(`Administrative area with ID "${dto.areaId}" not found.`);
    }

    // Ensure user role is an administrative role
    if (targetUser.role === UserRole.RESIDENT) {
      throw new BadRequestException(
        'Cannot assign geographical administrative permissions to a user with RESIDENT role. Upgrade role first.',
      );
    }

    const permission = await this.prisma.administratorPermission.upsert({
      where: {
        userId_areaId: {
          userId,
          areaId: dto.areaId,
        },
      },
      create: {
        userId,
        areaId: dto.areaId,
        canPublish: dto.canPublish ?? true,
        canSchedule: dto.canSchedule ?? true,
        canBroadcastEmergency: dto.canBroadcastEmergency ?? false,
        grantedById,
      },
      update: {
        canPublish: dto.canPublish ?? true,
        canSchedule: dto.canSchedule ?? true,
        canBroadcastEmergency: dto.canBroadcastEmergency ?? false,
      },
      include: {
        area: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: grantedById,
        action: AuditAction.PERMISSION_GRANT,
        resource: 'AdministratorPermission',
        resourceId: permission.id,
        details: {
          assignedToUserId: userId,
          areaId: dto.areaId,
          areaName: targetArea.name,
          permissions: {
            canPublish: permission.canPublish,
            canBroadcastEmergency: permission.canBroadcastEmergency,
          },
        },
      },
    });

    return permission;
  }

  /**
   * Revoke geographical permission
   */
  async revokePermission(userId: string, areaId: string, revokedById: string) {
    const existing = await this.prisma.administratorPermission.findUnique({
      where: {
        userId_areaId: { userId, areaId },
      },
    });

    if (!existing) {
      throw new NotFoundException('Permission record not found.');
    }

    await this.prisma.administratorPermission.delete({
      where: {
        userId_areaId: { userId, areaId },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: revokedById,
        action: AuditAction.PERMISSION_REVOKE,
        resource: 'AdministratorPermission',
        resourceId: existing.id,
        details: { revokedFromUserId: userId, areaId },
      },
    });

    return { message: 'Geographical permission revoked successfully.' };
  }
}

