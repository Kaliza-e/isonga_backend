import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AreasService } from '../areas/areas.service';
import { UpdateResidentProfileDto } from './dto/update-resident-profile.dto';
import { UpdateResidentLocationDto } from './dto/update-resident-location.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-preferences.dto';
import { UpdateConsentDto } from './dto/update-consent.dto';
import { QueryResidentsDto } from './dto/query-residents.dto';

@Injectable()
export class ResidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly areasService: AreasService,
  ) {}

  /**
   * Helper to mask phone numbers for privacy in administrative listings
   * e.g. +250788111222 -> +250788***222
   */
  private maskPhone(phone: string): string {
    if (phone.length < 10) return '***';
    return `${phone.slice(0, 7)}***${phone.slice(-3)}`;
  }

  /**
   * Get current resident's own full profile
   */
  async getMyProfile(userId: string) {
    const profile = await this.prisma.residentProfile.findUnique({
      where: { userId },
      include: {
        area: true,
        preference: true,
        user: {
          select: {
            id: true,
            phone: true,
            phoneVerified: true,
            email: true,
            role: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Resident profile not found.');
    }

    return profile;
  }

  /**
   * Update personal profile information
   */
  async updateMyProfile(userId: string, dto: UpdateResidentProfileDto) {
    const profile = await this.prisma.residentProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Resident profile not found.');
    }

    const updated = await this.prisma.residentProfile.update({
      where: { userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        preferredLanguage: dto.preferredLanguage,
      },
      include: {
        area: true,
      },
    });

    return updated;
  }

  /**
   * Update resident location (e.g. resident relocated to another village/cell)
   */
  async updateMyLocation(userId: string, dto: UpdateResidentLocationDto) {
    const area = await this.prisma.administrativeArea.findUnique({
      where: { id: dto.areaId },
    });

    if (!area) {
      throw new NotFoundException(
        `Target administrative area with ID "${dto.areaId}" does not exist.`,
      );
    }

    const updated = await this.prisma.residentProfile.update({
      where: { userId },
      data: {
        areaId: dto.areaId,
      },
      include: {
        area: true,
      },
    });

    return {
      message: `Location successfully updated to ${area.name} (${area.level}).`,
      profile: updated,
    };
  }

  /**
   * Get communication preferences
   */
  async getMyPreferences(userId: string) {
    const profile = await this.prisma.residentProfile.findUnique({
      where: { userId },
      include: { preference: true },
    });

    if (!profile || !profile.preference) {
      throw new NotFoundException('Notification preferences not found.');
    }

    return profile.preference;
  }

  /**
   * Update communication preferences
   */
  async updateMyPreferences(
    userId: string,
    dto: UpdateNotificationPreferencesDto,
  ) {
    const profile = await this.prisma.residentProfile.findUnique({
      where: { userId },
      include: { preference: true },
    });

    if (!profile) {
      throw new NotFoundException('Resident profile not found.');
    }

    const preference = await this.prisma.notificationPreference.upsert({
      where: { profileId: profile.id },
      create: {
        profileId: profile.id,
        smsEnabled: dto.smsEnabled ?? true,
        pushEnabled: dto.pushEnabled ?? true,
        inAppEnabled: dto.inAppEnabled ?? true,
        communityMeetings: dto.communityMeetings ?? true,
        umuganda: dto.umuganda ?? true,
        publicServices: dto.publicServices ?? true,
        healthInfo: dto.healthInfo ?? true,
        education: dto.education ?? true,
        administrativeNotice: dto.administrativeNotice ?? true,
        communityEvents: dto.communityEvents ?? true,
      },
      update: {
        smsEnabled: dto.smsEnabled,
        pushEnabled: dto.pushEnabled,
        inAppEnabled: dto.inAppEnabled,
        communityMeetings: dto.communityMeetings,
        umuganda: dto.umuganda,
        publicServices: dto.publicServices,
        healthInfo: dto.healthInfo,
        education: dto.education,
        administrativeNotice: dto.administrativeNotice,
        communityEvents: dto.communityEvents,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: AuditAction.PREFERENCE_UPDATE,
        resource: 'NotificationPreference',
        resourceId: preference.id,
        details: { preferences: JSON.parse(JSON.stringify(dto)) },
      },
    });

    return preference;
  }

  /**
   * Update consent status (Rwandan Data Protection Law No 058/2021)
   */
  async updateConsent(userId: string, dto: UpdateConsentDto, ipAddress?: string) {
    const updated = await this.prisma.residentProfile.update({
      where: { userId },
      data: {
        consentGiven: dto.consentGiven,
        consentTimestamp: new Date(),
        consentVersion: 'v1.0',
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: AuditAction.CONSENT_UPDATE,
        resource: 'ResidentProfile',
        resourceId: updated.id,
        ipAddress,
        details: { consentGiven: dto.consentGiven, version: 'v1.0' },
      },
    });

    return {
      message: dto.consentGiven
        ? 'Consent granted for community announcements.'
        : 'Consent withdrawn. You will not receive optional community announcements.',
      consentGiven: updated.consentGiven,
      consentTimestamp: updated.consentTimestamp,
    };
  }

  /**
   * Admin view: List residents within authorized geographical scope
   * Applies privacy mask to phone numbers
   */
  async getResidentsForAdmin(adminUser: any, query: QueryResidentsDto) {
    const isSuperAdmin = adminUser.role === UserRole.SUPER_ADMIN;

    // Check scope for local administrators
    if (!isSuperAdmin) {
      if (query.areaId) {
        let authorized = false;
        for (const perm of adminUser.adminPermissions || []) {
          if (await this.areasService.isWithinScope(perm.areaId, query.areaId)) {
            authorized = true;
            break;
          }
        }
        if (!authorized) {
          throw new ForbiddenException(
            'Geographical scope violation: You are not authorized to view residents in this area.',
          );
        }
      }
    }

    const where: any = {};

    if (query.areaId) {
      // Find area and all subordinates
      const targetArea = await this.prisma.administrativeArea.findUnique({
        where: { id: query.areaId },
      });
      if (targetArea) {
        where.area = {
          path: { startsWith: targetArea.path },
        };
      }
    }

    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const residents = await this.prisma.residentProfile.findMany({
      where,
      include: {
        area: {
          select: {
            id: true,
            name: true,
            level: true,
            path: true,
          },
        },
        user: {
          select: {
            id: true,
            phone: true,
            phoneVerified: true,
            status: true,
            createdAt: true,
          },
        },
        preference: {
          select: {
            smsEnabled: true,
            pushEnabled: true,
            inAppEnabled: true,
          },
        },
      },
      take: 100,
    });

    // Mask phone numbers to adhere to Rwandan privacy principles
    return residents.map((r) => ({
      id: r.id,
      firstName: r.firstName,
      lastName: r.lastName,
      preferredLanguage: r.preferredLanguage,
      consentGiven: r.consentGiven,
      area: r.area,
      user: {
        id: r.user.id,
        phone: this.maskPhone(r.user.phone), // Masked for privacy
        phoneVerified: r.user.phoneVerified,
        status: r.user.status,
        createdAt: r.user.createdAt,
      },
      preference: r.preference,
    }));
  }
}
