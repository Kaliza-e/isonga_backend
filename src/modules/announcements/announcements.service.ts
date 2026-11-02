import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AnnouncementPriority,
  AnnouncementStatus,
  AuditAction,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AreasService } from '../areas/areas.service';
import { TargetingService } from '../targeting/targeting.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { CancelAnnouncementDto } from './dto/cancel-announcement.dto';
import { PreviewRecipientsDto } from './dto/preview-announcement.dto';

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly areasService: AreasService,
    private readonly targetingService: TargetingService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Enforce server-side geographical authority and emergency permissions
   */
  private async validateAdminScope(
    adminUser: any,
    targetAreaIds: string[],
    priority: AnnouncementPriority = AnnouncementPriority.NORMAL,
  ) {
    if (adminUser.role === UserRole.SUPER_ADMIN) {
      return; // Super Admin has unrestricted scope
    }

    const permissions = adminUser.adminPermissions || [];
    if (permissions.length === 0) {
      throw new ForbiddenException(
        'You do not have any assigned administrative areas to publish announcements.',
      );
    }

    // Emergency announcements require explicit authority
    if (priority === AnnouncementPriority.EMERGENCY) {
      const hasEmergencyPermission = permissions.some((p: any) => p.canBroadcastEmergency);
      if (!hasEmergencyPermission) {
        throw new ForbiddenException(
          'Emergency announcement authorization denied: You do not possess emergency broadcast privileges.',
        );
      }
    }

    // Every targeted area must fall within at least one assigned admin area
    for (const targetId of targetAreaIds) {
      let authorized = false;
      for (const perm of permissions) {
        if (await this.areasService.isWithinScope(perm.areaId, targetId)) {
          authorized = true;
          break;
        }
      }

      if (!authorized) {
        const area = await this.prisma.administrativeArea.findUnique({
          where: { id: targetId },
        });
        throw new ForbiddenException(
          `Geographical scope violation: You are not authorized to target "${area?.name || targetId}".`,
        );
      }
    }
  }

  /**
   * Preview eligible recipient count before publishing
   */
  async previewRecipients(adminUser: any, dto: PreviewRecipientsDto) {
    await this.validateAdminScope(adminUser, dto.areaIds, dto.priority);

    return this.targetingService.previewRecipients({
      areaIds: dto.areaIds,
      includeSubordinates: dto.includeSubordinates ?? true,
      category: dto.category,
      priority: dto.priority || AnnouncementPriority.NORMAL,
    });
  }

  /**
   * Create an announcement (Draft or Scheduled)
   */
  async create(adminUser: any, dto: CreateAnnouncementDto) {
    await this.validateAdminScope(adminUser, dto.targetAreaIds, dto.priority);

    const isScheduled = !!dto.scheduledAt;
    const scheduledDate = dto.scheduledAt ? new Date(dto.scheduledAt) : null;

    if (scheduledDate && scheduledDate <= new Date()) {
      throw new BadRequestException('Scheduled time must be in the future.');
    }

    const priority = dto.priority || AnnouncementPriority.NORMAL;
    const status = isScheduled ? AnnouncementStatus.SCHEDULED : AnnouncementStatus.DRAFT;

    // Calculate recipient estimate for preview
    const preview = await this.targetingService.previewRecipients({
      areaIds: dto.targetAreaIds,
      includeSubordinates: dto.includeSubordinates ?? true,
      category: dto.category,
      priority,
    });

    const announcement = await this.prisma.announcement.create({
      data: {
        title: dto.title,
        content: dto.content,
        category: dto.category,
        priority,
        status,
        authorId: adminUser.id,
        scheduledAt: scheduledDate,
        recipientCount: preview.totalEligible,
        targets: {
          create: dto.targetAreaIds.map((areaId) => ({
            areaId,
            includeSubordinates: dto.includeSubordinates ?? true,
          })),
        },
      },
      include: {
        targets: {
          include: {
            area: true,
          },
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminUser.id,
        action: isScheduled
          ? AuditAction.ANNOUNCEMENT_SCHEDULE
          : AuditAction.ANNOUNCEMENT_CREATE,
        resource: 'Announcement',
        resourceId: announcement.id,
        details: {
          title: announcement.title,
          category: announcement.category,
          priority: announcement.priority,
          status: announcement.status,
          targetAreas: dto.targetAreaIds,
          estimatedRecipients: preview.totalEligible,
        },
      },
    });

    return announcement;
  }

  /**
   * Update an existing announcement (Draft or Scheduled only)
   */
  async update(id: string, adminUser: any, dto: UpdateAnnouncementDto) {
    const existing = await this.prisma.announcement.findUnique({
      where: { id },
      include: { targets: true },
    });

    if (!existing) {
      throw new NotFoundException(`Announcement with ID "${id}" was not found.`);
    }

    if (
      existing.status !== AnnouncementStatus.DRAFT &&
      existing.status !== AnnouncementStatus.SCHEDULED
    ) {
      throw new BadRequestException(
        `Cannot edit announcement in "${existing.status}" status. Only DRAFT or SCHEDULED announcements can be modified.`,
      );
    }

    if (dto.targetAreaIds) {
      await this.validateAdminScope(adminUser, dto.targetAreaIds, dto.priority);
    }

    const scheduledDate = dto.scheduledAt ? new Date(dto.scheduledAt) : existing.scheduledAt;

    const updated = await this.prisma.announcement.update({
      where: { id },
      data: {
        title: dto.title,
        content: dto.content,
        category: dto.category,
        priority: dto.priority,
        scheduledAt: scheduledDate,
        ...(dto.targetAreaIds && {
          targets: {
            deleteMany: {},
            create: dto.targetAreaIds.map((areaId) => ({
              areaId,
              includeSubordinates: dto.includeSubordinates ?? true,
            })),
          },
        }),
      },
      include: {
        targets: {
          include: { area: true },
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminUser.id,
        action: AuditAction.ANNOUNCEMENT_UPDATE,
        resource: 'Announcement',
        resourceId: updated.id,
        details: { changes: JSON.parse(JSON.stringify(dto)) },
      },
    });

    return updated;
  }

  /**
   * Publish an announcement immediately
   */
  async publish(id: string, adminUser: any) {
    const announcement = await this.prisma.announcement.findUnique({
      where: { id },
      include: { targets: true },
    });

    if (!announcement) {
      throw new NotFoundException(`Announcement with ID "${id}" was not found.`);
    }

    if (announcement.status === AnnouncementStatus.PUBLISHED) {
      throw new BadRequestException('Announcement has already been published.');
    }

    if (announcement.status === AnnouncementStatus.CANCELLED) {
      throw new BadRequestException('Cancelled announcements cannot be published.');
    }

    const targetAreaIds = announcement.targets.map((t) => t.areaId);
    await this.validateAdminScope(adminUser, targetAreaIds, announcement.priority);

    // Resolve eligible residents
    const eligibleResidents = await this.targetingService.resolveEligibleResidents({
      areaIds: targetAreaIds,
      includeSubordinates: announcement.targets[0]?.includeSubordinates ?? true,
      category: announcement.category,
      priority: announcement.priority,
    });

    // Mark as published
    const published = await this.prisma.announcement.update({
      where: { id },
      data: {
        status: AnnouncementStatus.PUBLISHED,
        publishedAt: new Date(),
        recipientCount: eligibleResidents.length,
      },
      include: {
        targets: { include: { area: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminUser.id,
        action: AuditAction.ANNOUNCEMENT_PUBLISH,
        resource: 'Announcement',
        resourceId: published.id,
        details: {
          title: published.title,
          category: published.category,
          eligibleRecipients: eligibleResidents.length,
        },
      },
    });

    // Trigger multi-channel notifications (SMS, Push, In-App)
    const dispatchResult = await this.notificationsService.dispatchAnnouncement(published.id);

    return {
      message: 'Announcement published successfully.',
      announcement: published,
      eligibleRecipients: eligibleResidents.length,
      dispatch: dispatchResult,
    };
  }

  /**
   * Cancel an announcement (Scheduled or Draft)
   */
  async cancel(id: string, adminUser: any, dto: CancelAnnouncementDto) {
    const announcement = await this.prisma.announcement.findUnique({
      where: { id },
      include: { targets: true },
    });

    if (!announcement) {
      throw new NotFoundException(`Announcement with ID "${id}" was not found.`);
    }

    if (announcement.status === AnnouncementStatus.CANCELLED) {
      throw new BadRequestException('Announcement is already cancelled.');
    }

    const targetAreaIds = announcement.targets.map((t) => t.areaId);
    await this.validateAdminScope(adminUser, targetAreaIds, announcement.priority);

    const cancelled = await this.prisma.announcement.update({
      where: { id },
      data: {
        status: AnnouncementStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledReason: dto.reason,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminUser.id,
        action: AuditAction.ANNOUNCEMENT_CANCEL,
        resource: 'Announcement',
        resourceId: cancelled.id,
        details: { reason: dto.reason },
      },
    });

    return {
      message: 'Announcement has been cancelled.',
      announcement: cancelled,
    };
  }

  /**
   * Find announcement by ID with targets and author details
   */
  async findOne(id: string) {
    const announcement = await this.prisma.announcement.findUnique({
      where: { id },
      include: {
        targets: {
          include: { area: true },
        },
        author: {
          select: {
            id: true,
            role: true,
            residentProfile: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
    });

    if (!announcement) {
      throw new NotFoundException(`Announcement with ID "${id}" was not found.`);
    }

    return announcement;
  }

  /**
   * List announcements for administrators (with status/category filters)
   */
  async findAll(query: { status?: AnnouncementStatus; category?: any }) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.category) where.category = query.category;

    return this.prisma.announcement.findMany({
      where,
      include: {
        targets: {
          include: {
            area: {
              select: { id: true, name: true, level: true },
            },
          },
        },
        author: {
          select: {
            id: true,
            role: true,
            residentProfile: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Resident Announcement Feed:
   * Returns published announcements targeted to the resident's village or any of its ancestor areas
   */
  async getFeedForResident(userId: string) {
    const profile = await this.prisma.residentProfile.findUnique({
      where: { userId },
      include: {
        area: true,
        preference: true,
      },
    });

    if (!profile) {
      throw new NotFoundException('Resident profile not found.');
    }

    // Get ancestor areas for the resident's location
    const ancestors = await this.areasService.getAncestors(profile.areaId);
    const relevantAreaIds = [profile.areaId, ...ancestors.map((a) => a.id)];

    const announcements = await this.prisma.announcement.findMany({
      where: {
        status: AnnouncementStatus.PUBLISHED,
        targets: {
          some: {
            areaId: { in: relevantAreaIds },
          },
        },
      },
      include: {
        targets: {
          include: {
            area: {
              select: { id: true, name: true, level: true },
            },
          },
        },
      },
      orderBy: [{ priority: 'desc' }, { publishedAt: 'desc' }],
    });

    // Filter out categories resident opted out from (except emergencies)
    const pref = profile.preference;
    if (!pref) {
      return announcements;
    }

    return announcements.filter((ann) => {
      if (ann.priority === AnnouncementPriority.EMERGENCY) {
        return true; // Emergencies cannot be suppressed
      }
      return true; // Return all or filter according to preference
    });
  }
}
