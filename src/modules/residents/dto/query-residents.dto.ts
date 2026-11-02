import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class QueryResidentsDto {
  @ApiPropertyOptional({ description: 'Filter residents by administrative area UUID' })
  @IsOptional()
  @IsString()
  areaId?: string;

  @ApiPropertyOptional({ description: 'Search resident by name' })
  @IsOptional()
  @IsString()
  search?: string;
}

