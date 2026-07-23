import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheService } from './cache.service';
import { CircuitBreakerService } from '../common/circuit/circuit-breaker.service';

@Module({
  imports: [ConfigModule],
  providers: [CacheService, CircuitBreakerService],
  exports: [CacheService],
})
export class CacheModule {}
