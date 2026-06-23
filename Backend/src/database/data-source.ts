/**
 * TypeORM DataSource used by the TypeORM CLI for running migrations.
 * Usage:
 *   npx typeorm -d src/database/data-source.ts migration:run
 *   npx typeorm -d src/database/data-source.ts migration:generate src/database/migrations/<Name>
 */
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Gist } from '../gists/entities/gist.entity';

// Issue #2: removed hardcoded 'gist' default for credentials.
// TypeORM CLI commands will fail loud if these env vars are missing.
const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: Number(process.env.DATABASE_PORT ?? 5432),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  entities: [Gist],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
});

export default AppDataSource;
