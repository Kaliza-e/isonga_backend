import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional({ description: 'Enable SMS notifications', example: true })
  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Enable mobile push notifications', example: true })
  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Enable in-app announcement feed', example: true })
  @IsOptional()
  @IsBoolean()
  inAppEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Opt-in to community meetings notices', example: true })
  @IsOptional()
  @IsBoolean()
  communityMeetings?: boolean;

  @ApiPropertyOptional({ description: 'Opt-in to Umuganda notices', example: true })
  @IsOptional()
  @IsBoolean()
  umuganda?: boolean;

  @ApiPropertyOptional({ description: 'Opt-in to public services information', example: true })
  @IsOptional()
  @IsBoolean()
  publicServices?: boolean;

  @ApiPropertyOptional({ description: 'Opt-in to public health information', example: true })
  @IsOptional()
  @IsBoolean()
  healthInfo?: boolean;

  @ApiPropertyOptional({ description: 'Opt-in to education notices', example: true })
  @IsOptional()
  @IsBoolean()
  education?: boolean;

  @ApiPropertyOptional({ description: 'Opt-in to administrative notices', example: true })
  @IsOptional()
  @IsBoolean()
  administrativeNotice?: boolean;

  @ApiPropertyOptional({ description: 'Opt-in to community events notices', example: true })
  @IsOptional()
  @IsBoolean()
  communityEvents?: boolean;
}
