import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CancelAnnouncementDto {
  @ApiProperty({
    description: 'Mandatory reason for cancellation',
    example: 'Umuganda postponed due to scheduled national sports event.',
  })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

