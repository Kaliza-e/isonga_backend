import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Analytics')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DISTRICT_ADMIN, UserRole.SECTOR_ADMIN)
  @ApiOperation({
    summary: 'System and civic communication overview',
    description:
      'Provides high-level metrics on published announcements, verified resident coverage, and total dispatches.',
  })
  async getOverview() {
    return this.analyticsService.getOverview();
  }

  @Get('channels')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DISTRICT_ADMIN, UserRole.SECTOR_ADMIN)
  @ApiOperation({
    summary: 'Multi-channel delivery performance',
    description:
      'Analyzes submission vs carrier-confirmed delivery rates across SMS, Mobile Push, and In-App feeds.',
  })
  async getChannelPerformance() {
    return this.analyticsService.getChannelPerformance();
  }

  @Get('announcements/:id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SECTOR_ADMIN,
    UserRole.CELL_ADMIN,
  )
  @ApiOperation({
    summary: 'Announcement delivery breakdown',
    description: 'Detailed delivery and DLR confirmation statistics for a specific announcement.',
  })
  @ApiParam({ name: 'id', description: 'Announcement UUID' })
  async getAnnouncementPerformance(@Param('id') id: string) {
    return this.analyticsService.getAnnouncementPerformance(id);
  }
}
