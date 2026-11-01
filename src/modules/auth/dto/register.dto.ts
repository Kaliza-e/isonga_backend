import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    description: 'Rwandan mobile phone number in E.164 format (+25078XXXXXXX, +25079, +25072, +25073)',
    example: '+250788123456',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+250(78|79|72|73)\d{7}$/, {
    message: 'Phone number must be a valid Rwandan mobile number in E.164 format (e.g. +250788123456).',
  })
  phone!: string;

  @ApiPropertyOptional({
    description: 'Email address (optional for residents, recommended for administrators)',
    example: 'resident@example.rw',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: 'Account password (minimum 8 characters with at least one number and one letter)',
    example: 'SecurePass123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long.' })
  password!: string;

  @ApiProperty({
    description: "Resident's given/first name",
    example: 'Patrick',
  })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({
    description: "Resident's family/last name",
    example: 'Habimana',
  })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiProperty({
    description: 'UUID of the resident administrative location (preferably Village/Umudugudu or Cell)',
    example: 'c1234567-89ab-cdef-0123-456789abcdef',
  })
  @IsString()
  @IsNotEmpty()
  areaId!: string;

  @ApiPropertyOptional({
    description: 'Preferred language for notices (rw: Kinyarwanda, en: English, fr: French)',
    default: 'rw',
    example: 'rw',
  })
  @IsOptional()
  @IsString()
  preferredLanguage?: string;

  @ApiProperty({
    description:
      'Consent to receive community announcements in accordance with Rwandan Data Protection Law No 058/2021',
    example: true,
  })
  @IsBoolean()
  consentGiven!: boolean;
}

