import { ApiPropertyOptional } from '@nestjs/swagger';
import { AnnouncementCategory, AnnouncementPriority } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateAnnouncementDto {
  @ApiPropertyOptional({ description: 'Updated title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Updated text content' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ enum: AnnouncementCategory })
  @IsOptional()
  @IsEnum(AnnouncementCategory)
  category?: AnnouncementCategory;

  @ApiPropertyOptional({ enum: AnnouncementPriority })
  @IsOptional()
  @IsEnum(AnnouncementPriority)
  priority?: AnnouncementPriority;

  @ApiPropertyOptional({ description: 'Updated target area UUIDs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetAreaIds?: string[];

  @ApiPropertyOptional({ description: 'Include subordinate areas' })
  @IsOptional()
  @IsBoolean()
  includeSubordinates?: boolean;

  @ApiPropertyOptional({ description: 'Scheduled publication timestamp' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

