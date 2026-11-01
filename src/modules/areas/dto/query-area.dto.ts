import { ApiPropertyOptional } from '@nestjs/swagger';
import { AreaLevel } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class QueryAreaDto {
  @ApiPropertyOptional({
    enum: AreaLevel,
    description: 'Filter by administrative level',
  })
  @IsOptional()
  @IsEnum(AreaLevel)
  level?: AreaLevel;

  @ApiPropertyOptional({
    description: 'Filter by parent area UUID',
  })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({
    description: 'Search area by name (case-insensitive substring match)',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

