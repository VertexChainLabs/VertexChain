import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IndexerService } from './indexer.service';
import { SorobanModule } from '../soroban/soroban.module';
import { Gist } from '../gists/entities/gist.entity';
import { GistRepository } from '../gists/gist.repository';
import { GeoModule } from '../geo/geo.module';

@Module({
  imports: [TypeOrmModule.forFeature([Gist]), SorobanModule, GeoModule],
  providers: [IndexerService, GistRepository],
})
export class IndexerModule {}
