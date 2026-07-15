import 'dotenv/config';
import { DataSource } from 'typeorm';
import { buildPostgresOptions } from './postgres-config';

// Migrations + seed share the same connection rules as the Nest app
// (DATABASE_URL on Render, POSTGRES_* locally).
export default new DataSource({
  ...buildPostgresOptions(),
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
});
