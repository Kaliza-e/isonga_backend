import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AssignPermissionDto {
  @ApiProperty({
    description: 'Target administrative area UUID to delegate authority over',
    example: 'c1234567-89ab-cdef-0123-456789abcdef',
  })
  @IsString()
  @IsNotEmpty()
  areaId!: string;

  @ApiPropertyOptional({
    description: 'Whether the administrator can publish announcements in this area',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  canPublish?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the administrator can schedule future announcements',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  canSchedule?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the administrator can broadcast critical emergency announcements',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  canBroadcastEmergency?: boolean;
}

