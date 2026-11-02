import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import { ResidentsService } from './residents.service';
import { UpdateResidentProfileDto } from './dto/update-resident-profile.dto';
import { UpdateResidentLocationDto } from './dto/update-resident-location.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-preferences.dto';
import { UpdateConsentDto } from './dto/update-consent.dto';
import { QueryResidentsDto } from './dto/query-residents.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Residents')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('residents')
export class ResidentsController {
  constructor(private readonly residentsService: ResidentsService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Get current resident profile',
    description:
      'Retrieves the authenticated resident profile, assigned administrative area, and current communication preferences.',
  })
  async getMyProfile(@CurrentUser('id') userId: string) {
    return this.residentsService.getMyProfile(userId);
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Update personal resident details',
    description: 'Update first name, last name, or preferred language.',
  })
  async updateMyProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateResidentProfileDto,
  ) {
    return this.residentsService.updateMyProfile(userId, dto);
  }

  @Patch('me/location')
  @ApiOperation({
    summary: 'Update resident geographical location',
    description: 'Re-assigns the resident to a new Village or Cell location.',
  })
  async updateMyLocation(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateResidentLocationDto,
  ) {
    return this.residentsService.updateMyLocation(userId, dto);
  }

  @Get('me/preferences')
  @ApiOperation({
    summary: 'Get communication channel & category preferences',
    description: 'Returns opt-in states for SMS, Push, In-App, and announcement categories.',
  })
  async getMyPreferences(@CurrentUser('id') userId: string) {
    return this.residentsService.getMyPreferences(userId);
  }

  @Put('me/preferences')
  @ApiOperation({
    summary: 'Update communication channel & category preferences',
    description: 'Enables or disables notification channels and category subscriptions.',
  })
  async updateMyPreferences(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.residentsService.updateMyPreferences(userId, dto);
  }

  @Post('me/consent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update consent under Rwandan Data Protection Law',
    description: 'Grant or withdraw consent for community announcements.',
  })
  async updateConsent(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateConsentDto,
    @Req() req: Request,
  ) {
    return this.residentsService.updateConsent(userId, dto, req.ip);
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.DISTRICT_ADMIN,
    UserRole.SECTOR_ADMIN,
    UserRole.CELL_ADMIN,
  )
  @ApiOperation({
    summary: 'List residents in administrator scope (Admin only)',
    description:
      'Lists residents within the administrator authorized area. Phone numbers are masked for data protection.',
  })
  async getResidentsForAdmin(
    @CurrentUser() adminUser: any,
    @Query() query: QueryResidentsDto,
  ) {
    return this.residentsService.getResidentsForAdmin(adminUser, query);
  }
}
