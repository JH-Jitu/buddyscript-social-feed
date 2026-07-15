import 'dotenv/config';
import { DataSource } from 'typeorm';

export default new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST ?? 'localhost',
  port: Number(process.env.POSTGRES_PORT ?? 5433),
  username: process.env.POSTGRES_USER ?? 'buddyscript',
  password: process.env.POSTGRES_PASSWORD ?? 'buddyscript',
  database: process.env.POSTGRES_DB ?? 'buddyscript',
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
});
