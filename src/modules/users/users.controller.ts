import {
  Body,
  Controller,
  Delete,
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
import { UserRole, UserStatus } from '@prisma/client';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignPermissionDto } from './dto/assign-permission.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.DISTRICT_ADMIN)
  @ApiOperation({
    summary: 'List users',
    description: 'Retrieve users filtered by role, status, or search string.',
  })
  @ApiQuery({ name: 'role', enum: UserRole, required: false })
  @ApiQuery({ name: 'status', enum: UserStatus, required: false })
  @ApiQuery({ name: 'search', type: String, required: false })
  async findAll(
    @Query('role') role?: UserRole,
    @Query('status') status?: UserStatus,
    @Query('search') search?: string,
  ) {
    return this.usersService.findAll({ role, status, search });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get user by ID',
    description: 'Retrieve full user profile and associated permissions.',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Update user account (Super Admin only)',
    description: 'Modify role, account status, or contact information.',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.usersService.update(id, dto, actorId);
  }

  @Post(':id/permissions')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DISTRICT_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Assign geographical permissions to an administrator',
    description:
      'Delegates administrative authority over a specific administrative area (District, Sector, or Cell).',
  })
  @ApiParam({ name: 'id', description: 'Administrator User UUID' })
  async assignPermission(
    @Param('id') userId: string,
    @Body() dto: AssignPermissionDto,
    @CurrentUser('id') grantedById: string,
  ) {
    return this.usersService.assignPermission(userId, dto, grantedById);
  }

  @Delete(':id/permissions/:areaId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DISTRICT_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revoke geographical permission',
    description: 'Removes administrative authority over a specific area.',
  })
  @ApiParam({ name: 'id', description: 'Administrator User UUID' })
  @ApiParam({ name: 'areaId', description: 'Administrative area UUID' })
  async revokePermission(
    @Param('id') userId: string,
    @Param('areaId') areaId: string,
    @CurrentUser('id') revokedById: string,
  ) {
    return this.usersService.revokePermission(userId, areaId, revokedById);
  }
}

