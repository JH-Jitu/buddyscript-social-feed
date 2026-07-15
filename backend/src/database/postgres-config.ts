// Render Postgres requires SSL.
export interface PostgresConnectionOptions {
  type: 'postgres';
  url?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  ssl?: boolean | { rejectUnauthorized: boolean };
}

function wantsSsl(databaseUrl?: string): boolean {
  if (process.env.POSTGRES_SSL === 'true') return true;
  if (process.env.POSTGRES_SSL === 'false') return false;
  if (process.env.NODE_ENV === 'production') return true;
  if (databaseUrl && /render\.com|amazonaws\.com|neon\.tech/i.test(databaseUrl))
    return true;
  return false;
}

export function buildPostgresOptions(
  env: NodeJS.ProcessEnv = process.env,
): PostgresConnectionOptions {
  const databaseUrl = env.DATABASE_URL?.trim();
  const ssl = wantsSsl(databaseUrl) ? { rejectUnauthorized: false } : undefined;

  if (databaseUrl) {
    return { type: 'postgres', url: databaseUrl, ssl };
  }

  return {
    type: 'postgres',
    host: env.POSTGRES_HOST ?? 'localhost',
    port: Number(env.POSTGRES_PORT ?? 5433),
    username: env.POSTGRES_USER ?? 'buddyscript',
    password: env.POSTGRES_PASSWORD ?? 'buddyscript',
    database: env.POSTGRES_DB ?? 'buddyscript',
    ssl,
  };
}
