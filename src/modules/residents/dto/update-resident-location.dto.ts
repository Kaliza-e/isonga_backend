import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateResidentLocationDto {
  @ApiProperty({
    description: 'New administrative area UUID (Village/Umudugudu or Cell level preferred)',
    example: 'c1234567-89ab-cdef-0123-456789abcdef',
  })
  @IsString()
  @IsNotEmpty()
  areaId!: string;
}

