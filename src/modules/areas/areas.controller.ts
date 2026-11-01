import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AreasService } from './areas.service';
import { CreateAreaDto } from './dto/create-area.dto';
import { QueryAreaDto } from './dto/query-area.dto';

@ApiTags('Areas')
@Controller('areas')
export class AreasController {
  constructor(private readonly areasService: AreasService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create administrative area',
    description:
      'Creates a new administrative area under Rwanda hierarchy (Country -> Province -> District -> Sector -> Cell -> Village) with strict relationship validation.',
  })
  @ApiResponse({
    status: 201,
    description: 'Administrative area successfully created.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid geographical hierarchy relationship.',
  })
  @ApiResponse({
    status: 409,
    description: 'Administrative area with this code already exists.',
  })
  async create(@Body() createAreaDto: CreateAreaDto) {
    return this.areasService.create(createAreaDto);
  }

  @Get()
  @ApiOperation({
    summary: 'List administrative areas',
    description:
      'Retrieve administrative areas with optional filters by level, parentId, or name search.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of matching administrative areas.',
  })
  async findAll(@Query() query: QueryAreaDto) {
    return this.areasService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get administrative area by ID',
    description:
      'Retrieve a single administrative area including its direct parent and child areas.',
  })
  @ApiParam({ name: 'id', description: 'Administrative area UUID' })
  @ApiResponse({
    status: 200,
    description: 'Administrative area details.',
  })
  @ApiResponse({
    status: 404,
    description: 'Administrative area not found.',
  })
  async findOne(@Param('id') id: string) {
    return this.areasService.findOne(id);
  }

  @Get(':id/subordinates')
  @ApiOperation({
    summary: 'Get all subordinate areas',
    description:
      'Recursively retrieves all subordinate administrative areas under the specified area (e.g. all sectors, cells, and villages under a district).',
  })
  @ApiParam({ name: 'id', description: 'Parent administrative area UUID' })
  @ApiResponse({
    status: 200,
    description: 'List of all recursive subordinate areas.',
  })
  async getSubordinates(@Param('id') id: string) {
    return this.areasService.getSubordinates(id);
  }

  @Get(':id/ancestors')
  @ApiOperation({
    summary: 'Get ancestor area chain',
    description:
      'Retrieves the full ancestor chain from the Country down to the specified area.',
  })
  @ApiParam({ name: 'id', description: 'Administrative area UUID' })
  @ApiResponse({
    status: 200,
    description: 'Ordered list of ancestor administrative areas.',
  })
  async getAncestors(@Param('id') id: string) {
    return this.areasService.getAncestors(id);
  }
}
