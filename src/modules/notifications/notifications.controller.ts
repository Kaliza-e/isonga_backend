import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Public()
  @Post('webhooks/sms')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'SMS Delivery Receipt (DLR) Webhook',
    description:
      'Ingests delivery receipts from telcos/aggregators. Transitions notification status from SUBMITTED to DELIVERED only upon carrier confirmation.',
  })
  @ApiResponse({ status: 200, description: 'Delivery receipt processed.' })
  async handleSmsDlr(
    @Body()
    body: {
      messageId: string;
      status: string;
      error?: string;
    },
  ) {
    return this.notificationsService.handleDeliveryReceipt(
      body.messageId,
      body.status,
      body.error,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SECTOR_ADMIN,
    UserRole.CELL_ADMIN,
  )
  @ApiBearerAuth('JWT-auth')
  @Get('announcements/:id')
  @ApiOperation({
    summary: 'Get notification logs for an announcement (Admin only)',
    description: 'Retrieve real-time delivery performance and carrier status logs.',
  })
  @ApiParam({ name: 'id', description: 'Announcement UUID' })
  async getLogs(@Param('id') announcementId: string) {
    return this.notificationsService.getLogsForAnnouncement(announcementId);
  }
}

