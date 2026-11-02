import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateResidentProfileDto {
  @ApiPropertyOptional({ description: 'First name', example: 'Patrick' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ description: 'Last name', example: 'Habimana' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Preferred language code (rw, en, fr)',
    example: 'rw',
  })
  @IsOptional()
  @IsString()
  preferredLanguage?: string;
}
