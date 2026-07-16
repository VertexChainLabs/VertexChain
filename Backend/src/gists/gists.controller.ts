import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { ApiOperation, ApiTags, ApiParam, ApiResponse } from '@nestjs/swagger';
import { GistsService } from './gists.service';
import { CreateGistDto } from './dto/create-gist.dto';
import { QueryGistsDto } from './dto/query-gists.dto';
import { UpdateGistDto } from './dto/update-gist.dto';

@ApiTags('gists')
@Controller('gists')
export class GistsController {
  constructor(private readonly gistsService: GistsService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Post a new anonymous gist at a location' })
  create(@Body() dto: CreateGistDto) {
    return this.gistsService.create(dto);
  }

  @Get()
  @SkipThrottle()
  @ApiOperation({ summary: 'Find gists near a location' })
  findNearby(@Query() query: QueryGistsDto) {
    return this.gistsService.findNearby(query);
  }

  @Get(':id')
  @SkipThrottle()
  @ApiOperation({ summary: 'Get a single gist by ID' })
  @ApiParam({ name: 'id', description: 'Gist UUID' })
  findOne(@Param('id') id: string) {
    return this.gistsService.findOne(id);
  }

  @Patch(':id')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Correct a gist within its 60s edit window (same author only)',
  })
  @ApiParam({ name: 'id', description: 'Gist UUID' })
  @ApiResponse({ status: 403, description: 'Caller is not the original author' })
  @ApiResponse({ status: 410, description: 'Edit window has closed' })
  update(@Param('id') id: string, @Body() dto: UpdateGistDto) {
    return this.gistsService.update(id, dto);
  }
}
