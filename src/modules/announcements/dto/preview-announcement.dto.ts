import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AnnouncementCategory, AnnouncementPriority } from '@prisma/client';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class PreviewRecipientsDto {
  @ApiPropertyOptional({
    description: 'Targeted administrative area UUIDs (areaIds)',
    example: ['c1234567-89ab-cdef-0123-456789abcdef'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  areaIds?: string[];

  @ApiPropertyOptional({
    description: 'Alternative field name for area UUIDs (targetAreaIds)',
    example: ['c1234567-89ab-cdef-0123-456789abcdef'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetAreaIds?: string[];

  @ApiPropertyOptional({
    description: 'Channels to simulate',
  })
  @IsOptional()
  @IsArray()
  channels?: string[];

  @ApiPropertyOptional({
    description: 'Whether to include subordinate areas',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  includeSubordinates?: boolean;

  @ApiProperty({
    enum: AnnouncementCategory,
    example: AnnouncementCategory.UMUGANDA,
  })
  @IsEnum(AnnouncementCategory)
  category!: AnnouncementCategory;

  @ApiPropertyOptional({
    enum: AnnouncementPriority,
    default: AnnouncementPriority.NORMAL,
  })
  @IsOptional()
  @IsEnum(AnnouncementPriority)
  priority?: AnnouncementPriority;
}
