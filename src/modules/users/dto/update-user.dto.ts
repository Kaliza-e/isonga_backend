import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, UserStatus } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'Updated email address',
    example: 'new.email@example.rw',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    enum: UserStatus,
    description: 'Updated account status',
    example: UserStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({
    enum: UserRole,
    description: 'Updated user role (Super Admin only)',
    example: UserRole.SECTOR_ADMIN,
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

