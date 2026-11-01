import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Login identifier: Rwandan phone number (+250...) or email address',
    example: '+250788000001',
  })
  @IsString()
  @IsNotEmpty()
  identifier!: string;

  @ApiProperty({
    description: 'Account password',
    example: 'Password123!',
  })
  @IsString()
  @IsNotEmpty()
  password!: string;
}

