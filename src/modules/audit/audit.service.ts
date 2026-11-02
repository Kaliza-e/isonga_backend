import { Injectable, Logger } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryAuditLogsDto } from './dto/query-audit.dto';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record a tamper-evident audit log
   * Strict privacy rule: Never store passwords, OTPs, or access tokens in details
   */
  async record(params: {
    userId?: string;
    action: AuditAction;
    resource: string;
    resourceId?: string;
    details?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }) {
    // Sanitize details to ensure no secrets ever leak into audit logs
    const sanitizedDetails = params.details ? { ...params.details } : undefined;
    if (sanitizedDetails) {
      delete sanitizedDetails.password;
      delete sanitizedDetails.passwordHash;
      delete sanitizedDetails.otp;
      delete sanitizedDetails.otpHash;
      delete sanitizedDetails.token;
      delete sanitizedDetails.accessToken;
    }

    return this.prisma.auditLog.create({
      data: {
        userId: params.userId || null,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId || null,
        details: sanitizedDetails ? JSON.parse(JSON.stringify(sanitizedDetails)) : undefined,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
      },
    });
  }

  /**
   * Retrieve audit logs with filtering (Super Admin only)
   */
  async getLogs(query: QueryAuditLogsDto) {
    const where: any = {};
    if (query.action) where.action = query.action;
    if (query.userId) where.userId = query.userId;
    if (query.resource) where.resource = query.resource;

    return this.prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            phone: true,
            role: true,
            residentProfile: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
