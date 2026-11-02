import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AnnouncementCategory, AnnouncementPriority } from '@prisma/client';
import { ArrayNotEmpty, IsArray, IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class PreviewRecipientsDto {
  @ApiProperty({
    description: 'Targeted administrative area UUIDs',
    example: ['c1234567-89ab-cdef-0123-456789abcdef'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  areaIds!: string[];

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

