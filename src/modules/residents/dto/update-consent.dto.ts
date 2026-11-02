import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateConsentDto {
  @ApiProperty({
    description:
      'Consent to receive community notices under Rwandan Law No 058/2021 relating to the protection of personal data and privacy',
    example: true,
  })
  @IsBoolean()
  consentGiven!: boolean;
}

