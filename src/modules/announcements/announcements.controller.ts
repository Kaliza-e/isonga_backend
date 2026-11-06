import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AnnouncementCategory, AnnouncementStatus, UserRole } from '@prisma/client';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { CancelAnnouncementDto } from './dto/cancel-announcement.dto';
import { PreviewRecipientsDto } from './dto/preview-announcement.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Announcements')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Post()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SECTOR_ADMIN,
    UserRole.CELL_ADMIN,
  )
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create announcement draft or schedule future broadcast',
    description:
      'Creates a new community announcement. Enforces server-side geographical authority and emergency broadcast permissions.',
  })
  async create(
    @CurrentUser() adminUser: any,
    @Body() dto: CreateAnnouncementDto,
  ) {
    return this.announcementsService.create(adminUser, dto);
  }

  @Post('preview')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SECTOR_ADMIN,
    UserRole.CELL_ADMIN,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Preview eligible recipient count',
    description:
      'Calculates total and per-channel eligible recipient counts according to geographical targeting, resident consent, and category opt-ins without exposing phone numbers.',
  })
  async previewRecipients(
    @CurrentUser() adminUser: any,
    @Body() dto: PreviewRecipientsDto,
  ) {
    return this.announcementsService.previewRecipients(adminUser, dto);
  }

  @Public()
  @Get('feed')
  @ApiOperation({
    summary: 'Get resident community announcement feed',
    description:
      'Retrieves verified community announcements relevant to the resident registered village, cell, sector, or district.',
  })
  async getFeedForResident(
    @CurrentUser('id') userId?: string,
    @Query('villageId') villageId?: string,
  ) {
    return this.announcementsService.getFeedForResident(userId, villageId);
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SECTOR_ADMIN,
    UserRole.CELL_ADMIN,
  )
  @ApiOperation({
    summary: 'List announcements (Admin view)',
    description: 'Retrieve administrative history of announcements with status and category filtering.',
  })
  @ApiQuery({ name: 'status', enum: AnnouncementStatus, required: false })
  @ApiQuery({ name: 'category', enum: AnnouncementCategory, required: false })
  async findAll(
    @Query('status') status?: AnnouncementStatus,
    @Query('category') category?: AnnouncementCategory,
  ) {
    return this.announcementsService.findAll({ status, category });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get announcement details by ID',
    description: 'Retrieves full announcement text, target areas, and publication metadata.',
  })
  @ApiParam({ name: 'id', description: 'Announcement UUID' })
  async findOne(@Param('id') id: string) {
    return this.announcementsService.findOne(id);
  }

  @Patch(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SECTOR_ADMIN,
    UserRole.CELL_ADMIN,
  )
  @ApiOperation({
    summary: 'Edit announcement (Draft or Scheduled only)',
    description: 'Update content, target areas, or scheduled publication time.',
  })
  @ApiParam({ name: 'id', description: 'Announcement UUID' })
  async update(
    @Param('id') id: string,
    @CurrentUser() adminUser: any,
    @Body() dto: UpdateAnnouncementDto,
  ) {
    return this.announcementsService.update(id, adminUser, dto);
  }

  @Post(':id/publish')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SECTOR_ADMIN,
    UserRole.CELL_ADMIN,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Publish announcement immediately',
    description:
      'Validates administrator geographical scope, resolves eligible recipients, transitions status to PUBLISHED, and triggers notification dispatches.',
  })
  @ApiParam({ name: 'id', description: 'Announcement UUID' })
  async publish(@Param('id') id: string, @CurrentUser() adminUser: any) {
    return this.announcementsService.publish(id, adminUser);
  }

  @Post(':id/cancel')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SECTOR_ADMIN,
    UserRole.CELL_ADMIN,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel an announcement',
    description: 'Cancels a draft or scheduled announcement with a mandatory justification reason.',
  })
  @ApiParam({ name: 'id', description: 'Announcement UUID' })
  async cancel(
    @Param('id') id: string,
    @CurrentUser() adminUser: any,
    @Body() dto: CancelAnnouncementDto,
  ) {
    return this.announcementsService.cancel(id, adminUser, dto);
  }
}

