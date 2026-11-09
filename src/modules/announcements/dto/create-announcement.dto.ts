import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AnnouncementCategory,
  AnnouncementPriority,
} from '@prisma/client';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateAnnouncementDto {
  @ApiProperty({
    description: 'Title of the announcement (clear, concise subject)',
    example: 'Umuganda Rusange - Ugushyingo 2026',
  })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({
    description: 'Full text content of the community announcement',
    example:
      'Turasaba abaturage bose ba Remera kuzitabira umuganda rusange uzaba kuwa gatandatu guhera saa mbiri za mugitondo.',
  })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiProperty({
    enum: AnnouncementCategory,
    description: 'Announcement category',
    example: AnnouncementCategory.UMUGANDA,
  })
  @IsEnum(AnnouncementCategory)
  category!: AnnouncementCategory;

  @ApiPropertyOptional({
    enum: AnnouncementPriority,
    description: 'Priority level (EMERGENCY requires elevated permission)',
    default: AnnouncementPriority.NORMAL,
    example: AnnouncementPriority.NORMAL,
  })
  @IsOptional()
  @IsEnum(AnnouncementPriority)
  priority?: AnnouncementPriority;

  @ApiProperty({
    description: 'Targeted administrative area UUIDs',
    example: ['c1234567-89ab-cdef-0123-456789abcdef'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  targetAreaIds!: string[];

  @ApiPropertyOptional({
    description: 'Whether to include all subordinate administrative sub-areas',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  includeSubordinates?: boolean;

  @ApiPropertyOptional({
    description: 'Channels to dispatch announcement across (SMS, PUSH, IN_APP, WHATSAPP)',
  })
  @IsOptional()
  @IsArray()
  channels?: string[];

  @ApiPropertyOptional({
    description: 'Future ISO timestamp if scheduling publication',
    example: '2026-11-05T08:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

