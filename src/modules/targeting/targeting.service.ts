import { Injectable, Logger } from '@nestjs/common';
import {
  AnnouncementCategory,
  AnnouncementPriority,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface TargetingCriteria {
  areaIds: string[];
  includeSubordinates?: boolean;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
}

export interface TargetingSummary {
  totalEligible: number;
  smsEligible: number;
  pushEligible: number;
  inAppEligible: number;
  targetAreaNames: string[];
}

@Injectable()
export class TargetingService {
  private readonly logger = new Logger(TargetingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to map announcement category to notification preference property
   */
  private getCategoryField(category: AnnouncementCategory): string | null {
    const map: Record<AnnouncementCategory, string> = {
      [AnnouncementCategory.COMMUNITY_MEETINGS]: 'communityMeetings',
      [AnnouncementCategory.UMUGANDA]: 'umuganda',
      [AnnouncementCategory.PUBLIC_SERVICES]: 'publicServices',
      [AnnouncementCategory.HEALTH_INFORMATION]: 'healthInfo',
      [AnnouncementCategory.EDUCATION]: 'education',
      [AnnouncementCategory.ADMINISTRATIVE_NOTICES]: 'administrativeNotice',
      [AnnouncementCategory.COMMUNITY_EVENTS]: 'communityEvents',
      [AnnouncementCategory.EMERGENCY]: '', // Emergency overrides category opt-out
    };
    return map[category] || null;
  }

  /**
   * Query all eligible resident profiles based on location, consent, and preferences
   */
  async resolveEligibleResidents(criteria: TargetingCriteria) {
    const { areaIds, includeSubordinates = true, category, priority } = criteria;

    if (!areaIds || areaIds.length === 0) {
      return [];
    }

    // 1. Fetch targeted administrative areas
    const targetAreas = await this.prisma.administrativeArea.findMany({
      where: { id: { in: areaIds }, isActive: true },
    });

    if (targetAreas.length === 0) {
      return [];
    }

    // 2. Build area path filters
    let areaCondition: any;
    if (includeSubordinates) {
      areaCondition = {
        OR: targetAreas.map((area) => ({
          path: { startsWith: area.path },
        })),
      };
    } else {
      areaCondition = {
        id: { in: targetAreas.map((a) => a.id) },
      };
    }

    // 3. Category preference condition (Emergency priority bypasses category opt-outs)
    const categoryField = this.getCategoryField(category);
    const isEmergency = priority === AnnouncementPriority.EMERGENCY;

    const preferenceCondition: any = {};
    if (!isEmergency && categoryField) {
      preferenceCondition[categoryField] = true;
    }

    // 4. Query eligible resident profiles
    return this.prisma.residentProfile.findMany({
      where: {
        consentGiven: true, // Rwandan Data Protection compliance
        area: areaCondition,
        user: {
          status: UserStatus.ACTIVE,
          phoneVerified: true,
          deletedAt: null,
        },
        preference: preferenceCondition,
      },
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
            subscriptions: {
              where: { isActive: true },
              select: { token: true },
            },
          },
        },
        preference: true,
      },
    });
  }

  /**
   * Preview total counts of eligible recipients before publication
   * Does NOT return raw phone numbers, maintaining strict data privacy
   */
  async previewRecipients(criteria: TargetingCriteria): Promise<TargetingSummary> {
    if (!criteria.areaIds || criteria.areaIds.length === 0) {
      return {
        totalEligible: 0,
        smsEligible: 0,
        pushEligible: 0,
        inAppEligible: 0,
        targetAreaNames: [],
      };
    }

    const residents = await this.resolveEligibleResidents(criteria);

    const targetAreas = await this.prisma.administrativeArea.findMany({
      where: { id: { in: criteria.areaIds } },
      select: { name: true },
    });

    let smsCount = 0;
    let pushCount = 0;
    let inAppCount = 0;

    for (const resident of residents) {
      const pref = resident.preference;
      if (!pref || pref.smsEnabled) {
        smsCount++;
      }
      if (pref && pref.pushEnabled && resident.user.subscriptions.length > 0) {
        pushCount++;
      }
      if (!pref || pref.inAppEnabled) {
        inAppCount++;
      }
    }

    return {
      totalEligible: residents.length,
      smsEligible: smsCount,
      pushEligible: pushCount,
      inAppEligible: inAppCount,
      targetAreaNames: targetAreas.map((a) => a.name),
    };
  }
}

