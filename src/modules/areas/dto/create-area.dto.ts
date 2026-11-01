import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AreaLevel } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class CreateAreaDto {
  @ApiProperty({
    description: 'Official NISR administrative code (e.g. "0101010101")',
    example: '0101010101',
  })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({
    description: 'Official name of the administrative area',
    example: 'Rebero',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    enum: AreaLevel,
    description: 'Administrative hierarchy level',
    example: AreaLevel.VILLAGE,
  })
  @IsEnum(AreaLevel)
  level!: AreaLevel;

  @ApiPropertyOptional({
    description: 'UUID of the parent administrative area (null for Country)',
    example: 'c1234567-89ab-cdef-0123-456789abcdef',
  })
  @IsOptional()
  @IsString()
  parentId?: string;
}

