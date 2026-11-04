import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TargetingService } from '../targeting/targeting.service';
import { SmsService } from '../sms/sms.service';
import { PushService } from '../push/push.service';

export interface DispatchSummary {
  announcementId: string;
  totalTargeted: number;
  smsSubmitted: number;
  pushSubmitted: number;
  inAppDelivered: number;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly targetingService: TargetingService,
    private readonly smsService: SmsService,
    private readonly pushService: PushService,
  ) {}

  /**
   * Orchestrate multi-channel dispatch of an announcement
   * Ensures idempotency: avoids creating duplicate logs if already dispatched
   */
  async dispatchAnnouncement(announcementId: string): Promise<DispatchSummary> {
    const announcement = await this.prisma.announcement.findUnique({
      where: { id: announcementId },
      include: {
        targets: true,
      },
    });

    if (!announcement) {
      throw new NotFoundException(`Announcement "${announcementId}" not found.`);
    }

    const targetAreaIds = announcement.targets.map((t) => t.areaId);
    const eligibleResidents = await this.targetingService.resolveEligibleResidents({
      areaIds: targetAreaIds,
      includeSubordinates: announcement.targets[0]?.includeSubordinates ?? true,
      category: announcement.category,
      priority: announcement.priority,
    });

    let smsCount = 0;
    let pushCount = 0;
    let inAppCount = 0;

    for (const resident of eligibleResidents) {
      const pref = resident.preference;
      const user = resident.user;

      // 1. In-App Notification (Always enabled for community feed)
      if (!pref || pref.inAppEnabled) {
        const existingInApp = await this.prisma.notificationLog.findFirst({
          where: {
            announcementId,
            userId: user.id,
            channel: NotificationChannel.IN_APP,
          },
        });

        if (!existingInApp) {
          await this.prisma.notificationLog.create({
            data: {
              announcementId,
              userId: user.id,
              channel: NotificationChannel.IN_APP,
              status: NotificationStatus.DELIVERED,
              recipient: user.id,
              deliveredAt: new Date(),
            },
          });
          inAppCount++;
        }
      }

      // 2. SMS Notification
      if (!pref || pref.smsEnabled) {
        const existingSms = await this.prisma.notificationLog.findFirst({
          where: {
            announcementId,
            userId: user.id,
            channel: NotificationChannel.SMS,
          },
        });

        if (!existingSms) {
          const log = await this.prisma.notificationLog.create({
            data: {
              announcementId,
              userId: user.id,
              channel: NotificationChannel.SMS,
              status: NotificationStatus.PENDING,
              recipient: user.phone,
            },
          });

          // Dispatch to SMS provider
          const smsResult = await this.smsService.send(
            user.phone,
            `${announcement.title}: ${announcement.content}`,
          );

          if (smsResult.success) {
            await this.prisma.notificationLog.update({
              where: { id: log.id },
              data: {
                status: NotificationStatus.SUBMITTED,
                providerRef: smsResult.messageId,
                providerResponse: smsResult.rawResponse,
                submittedAt: new Date(),
              },
            });
            smsCount++;
          } else {
            await this.prisma.notificationLog.update({
              where: { id: log.id },
              data: {
                status: NotificationStatus.FAILED,
                errorMessage: smsResult.error,
              },
            });
          }
        }
      }

      // 3. Push Notification (FCM)
      const pushTokens = user.subscriptions?.map((s) => s.token) || [];
      if (pref && pref.pushEnabled && pushTokens.length > 0) {
        const existingPush = await this.prisma.notificationLog.findFirst({
          where: {
            announcementId,
            userId: user.id,
            channel: NotificationChannel.PUSH,
          },
        });

        if (!existingPush) {
          const log = await this.prisma.notificationLog.create({
            data: {
              announcementId,
              userId: user.id,
              channel: NotificationChannel.PUSH,
              status: NotificationStatus.PENDING,
              recipient: pushTokens[0],
            },
          });

          const pushResult = await this.pushService.send(
            pushTokens,
            announcement.title,
            announcement.content,
            { announcementId: announcement.id },
          );

          if (pushResult.success) {
            await this.prisma.notificationLog.update({
              where: { id: log.id },
              data: {
                status: NotificationStatus.SUBMITTED,
                providerRef: pushResult.messageId,
                submittedAt: new Date(),
              },
            });
            pushCount++;
          } else {
            await this.prisma.notificationLog.update({
              where: { id: log.id },
              data: {
                status: NotificationStatus.FAILED,
                errorMessage: pushResult.error,
              },
            });
          }
        }
      }
    }

    this.logger.log(
      `Dispatched announcement "${announcement.title}" -> SMS: ${smsCount}, Push: ${pushCount}, InApp: ${inAppCount}`,
    );

    return {
      announcementId,
      totalTargeted: eligibleResidents.length,
      smsSubmitted: smsCount,
      pushSubmitted: pushCount,
      inAppDelivered: inAppCount,
    };
  }

  /**
   * Ingest delivery receipts (DLR) from carrier/aggregator webhooks
   * Transitions status from SUBMITTED to DELIVERED only upon carrier confirmation
   */
  async handleDeliveryReceipt(providerRef: string, status: string, error?: string) {
    const log = await this.prisma.notificationLog.findFirst({
      where: { providerRef },
    });

    if (!log) {
      this.logger.warn(`Received DLR for unknown provider reference: "${providerRef}"`);
      return { received: true, updated: false };
    }

    const isDelivered = status.toUpperCase() === 'DELIVERED';
    const isFailed = status.toUpperCase() === 'FAILED' || status.toUpperCase() === 'UNDELIVERED';

    await this.prisma.notificationLog.update({
      where: { id: log.id },
      data: {
        status: isDelivered
          ? NotificationStatus.DELIVERED
          : isFailed
          ? NotificationStatus.FAILED
          : log.status,
        deliveredAt: isDelivered ? new Date() : undefined,
        errorMessage: error || undefined,
      },
    });

    this.logger.log(
      `Updated delivery receipt for ref ${providerRef} -> ${status}`,
    );

    return { received: true, updated: true, newStatus: isDelivered ? 'DELIVERED' : 'FAILED' };
  }

  /**
   * Retrieve platform-wide notification logs (Admin)
   */
  async getAllLogs(take = 100, skip = 0) {
    const [total, logs] = await Promise.all([
      this.prisma.notificationLog.count(),
      this.prisma.notificationLog.findMany({
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        include: {
          announcement: {
            select: {
              id: true,
              title: true,
              category: true,
              urgency: true,
            },
          },
        },
      }),
    ]);

    return {
      total,
      data: logs,
    };
  }

  /**
   * Retrieve notification history for an announcement (Admin)
   */
  async getLogsForAnnouncement(announcementId: string) {
    return this.prisma.notificationLog.findMany({
      where: { announcementId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}

