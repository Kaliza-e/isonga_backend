import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Login identifier: Rwandan phone number (+250...) or email address',
    example: '+250788000001',
    required: false,
  })
  @IsOptional()
  @IsString()
  identifier?: string;

  @ApiProperty({
    description: 'Alternative phone field for backward compatibility',
    example: '+250788000001',
    required: false,
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    description: 'Account password',
    example: 'Password123!',
  })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
