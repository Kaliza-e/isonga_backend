import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Rwandan mobile phone number in E.164 format',
    example: '+250788123456',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+250(78|79|72|73)\d{7}$/)
  phone!: string;

  @ApiProperty({
    description: '6-digit one-time password verification code',
    example: '654321',
  })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  otp!: string;

  @ApiProperty({
    description: 'New account password (minimum 8 characters)',
    example: 'NewSecurePassword123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}

