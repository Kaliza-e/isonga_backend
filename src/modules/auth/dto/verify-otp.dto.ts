import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({
    description: 'Rwandan mobile phone number in E.164 format',
    example: '+250788123456',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+250(78|79|72|73)\d{7}$/)
  phone!: string;

  @ApiProperty({
    description: '6-digit one-time verification code',
    example: '123456',
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits.' })
  @Matches(/^\d{6}$/, { message: 'OTP must contain numeric digits only.' })
  otp!: string;
}

