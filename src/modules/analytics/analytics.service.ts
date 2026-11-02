import { Injectable } from '@nestjs/common';
import {
  AnnouncementStatus,
  NotificationChannel,
  NotificationStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * System-wide or district overview analytics for administrators
   */
  async getOverview() {
    const [
      totalAnnouncements,
      publishedAnnouncements,
      scheduledAnnouncements,
      draftAnnouncements,
      cancelledAnnouncements,
      totalResidents,
      activeVerifiedResidents,
      totalNotificationLogs,
    ] = await Promise.all([
      this.prisma.announcement.count(),
      this.prisma.announcement.count({ where: { status: AnnouncementStatus.PUBLISHED } }),
      this.prisma.announcement.count({ where: { status: AnnouncementStatus.SCHEDULED } }),
      this.prisma.announcement.count({ where: { status: AnnouncementStatus.DRAFT } }),
      this.prisma.announcement.count({ where: { status: AnnouncementStatus.CANCELLED } }),
      this.prisma.residentProfile.count(),
      this.prisma.residentProfile.count({
        where: {
          user: { phoneVerified: true, status: 'ACTIVE' },
          consentGiven: true,
        },
      }),
      this.prisma.notificationLog.count(),
    ]);

    return {
      announcements: {
        total: totalAnnouncements,
        published: publishedAnnouncements,
        scheduled: scheduledAnnouncements,
        drafts: draftAnnouncements,
        cancelled: cancelledAnnouncements,
      },
      residents: {
        totalRegistered: totalResidents,
        activeAndVerified: activeVerifiedResidents,
      },
      notifications: {
        totalDispatched: totalNotificationLogs,
      },
    };
  }

  /**
   * Multi-channel delivery breakdown (SMS vs Push vs In-App)
   * Distinguishes SUBMITTED vs DELIVERED vs FAILED
   */
  async getChannelPerformance() {
    const channels = [
      NotificationChannel.SMS,
      NotificationChannel.PUSH,
      NotificationChannel.IN_APP,
    ];

    const results = await Promise.all(
      channels.map(async (channel) => {
        const [total, submitted, delivered, failed] = await Promise.all([
          this.prisma.notificationLog.count({ where: { channel } }),
          this.prisma.notificationLog.count({
            where: { channel, status: NotificationStatus.SUBMITTED },
          }),
          this.prisma.notificationLog.count({
            where: { channel, status: NotificationStatus.DELIVERED },
          }),
          this.prisma.notificationLog.count({
            where: { channel, status: NotificationStatus.FAILED },
          }),
        ]);

        const deliveryRate = total > 0 ? Math.round((delivered / total) * 10000) / 100 : 0;

        return {
          channel,
          total,
          submitted, // Awaiting carrier delivery confirmation (DLR)
          confirmedDelivered: delivered, // Confirmed delivered by carrier/device DLR
          failed,
          deliveryRatePercentage: deliveryRate,
        };
      }),
    );

    return results;
  }

  /**
   * Performance breakdown for a specific announcement
   */
  async getAnnouncementPerformance(announcementId: string) {
    const announcement = await this.prisma.announcement.findUnique({
      where: { id: announcementId },
      include: {
        targets: {
          include: { area: true },
        },
      },
    });

    if (!announcement) {
      return null;
    }

    const [smsLogs, pushLogs, inAppLogs] = await Promise.all([
      this.prisma.notificationLog.groupBy({
        by: ['status'],
        where: { announcementId, channel: NotificationChannel.SMS },
        _count: { status: true },
      }),
      this.prisma.notificationLog.groupBy({
        by: ['status'],
        where: { announcementId, channel: NotificationChannel.PUSH },
        _count: { status: true },
      }),
      this.prisma.notificationLog.groupBy({
        by: ['status'],
        where: { announcementId, channel: NotificationChannel.IN_APP },
        _count: { status: true },
      }),
    ]);

    const formatCounts = (groups: any[]) => {
      const counts: Record<string, number> = {
        PENDING: 0,
        SUBMITTED: 0,
        DELIVERED: 0,
        FAILED: 0,
      };
      groups.forEach((g) => {
        counts[g.status] = g._count.status;
      });
      return counts;
    };

    return {
      announcement: {
        id: announcement.id,
        title: announcement.title,
        status: announcement.status,
        recipientCount: announcement.recipientCount,
        publishedAt: announcement.publishedAt,
        targets: announcement.targets.map((t) => t.area.name),
      },
      channels: {
        sms: formatCounts(smsLogs),
        push: formatCounts(pushLogs),
        inApp: formatCounts(inAppLogs),
      },
    };
  }
}
