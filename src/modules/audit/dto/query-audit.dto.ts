import { ApiPropertyOptional } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class QueryAuditLogsDto {
  @ApiPropertyOptional({ enum: AuditAction, description: 'Filter by audit action type' })
  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @ApiPropertyOptional({ description: 'Filter by actor User UUID' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Filter by target resource entity (e.g. Announcement, User)' })
  @IsOptional()
  @IsString()
  resource?: string;
}
