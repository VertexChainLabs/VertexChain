import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

const pool = connectionString
  ? new Pool({ connectionString })
  : new Pool({
      host: process.env.DATABASE_HOST ?? 'localhost',
      port: Number(process.env.DATABASE_PORT ?? 5432),
      user: process.env.DATABASE_USER ?? 'gist',
      password: process.env.DATABASE_PASSWORD ?? 'gist',
      database: process.env.DATABASE_NAME ?? 'gist',
    });

export default pool;
