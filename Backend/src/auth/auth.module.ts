import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StellarAuthGuard } from './guards/stellar-auth.guard';

@Module({
  imports: [ConfigModule],
  providers: [StellarAuthGuard],
  exports: [StellarAuthGuard],
})
export class AuthModule {}
