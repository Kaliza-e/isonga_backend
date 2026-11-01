import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, Matches } from 'class-validator';

export class RequestOtpDto {
  @ApiProperty({
    description: 'Rwandan mobile phone number in E.164 format',
    example: '+250788123456',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+250(78|79|72|73)\d{7}$/)
  phone!: string;

  @ApiProperty({
    description: 'Purpose of OTP request',
    enum: ['PHONE_VERIFICATION', 'PASSWORD_RESET'],
    example: 'PHONE_VERIFICATION',
  })
  @IsString()
  @IsIn(['PHONE_VERIFICATION', 'PASSWORD_RESET'])
  purpose!: 'PHONE_VERIFICATION' | 'PASSWORD_RESET';
}

