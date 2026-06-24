import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Gist } from '../gists/entities/gist.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: config.get<string>('NODE_ENV') === 'test' ? 'sqlite' : 'postgres',
        host: config.get<string>('DATABASE_HOST', 'localhost'),
        port: config.get<number>('DATABASE_PORT', 5432),
        username: config.get<string>('DATABASE_USER', 'gist'),
        password: config.get<string>('DATABASE_PASSWORD', 'gist'),
        database: config.get<string>('DATABASE_NAME', 'gist'),
        // Use SQLite in-memory DB for tests
        ...(config.get<string>('NODE_ENV') === 'test' ? { database: ':memory:' } : {}),
        entities: [Gist],
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        migrationsRun: false,
        synchronize: config.get<string>('NODE_ENV') === 'test',
        logging: config.get<string>('NODE_ENV') !== 'production',
        extra: {
          max: config.get<number>('DB_POOL_MAX', 10),
          min: config.get<number>('DB_POOL_MIN', 2),
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        },
      }),
    }),
  ],
})
export class DatabaseModule {}
