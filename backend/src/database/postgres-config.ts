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

function wantsSsl(env: NodeJS.ProcessEnv, databaseUrl?: string): boolean {
  if (env.POSTGRES_SSL === 'true') return true;
  if (env.POSTGRES_SSL === 'false') return false;
  if (env.NODE_ENV === 'production') return true;

  // Hosted Postgres almost always requires TLS. Match common providers and
  // Render's *internal* hostname (dpg-xxxxx-a — no ".render.com" suffix).
  if (
    databaseUrl &&
    /render\.com|amazonaws\.com|neon\.tech|supabase\.co|dpg-[a-z0-9]+-a(?:\.|\/|$)/i.test(
      databaseUrl,
    )
  ) {
    return true;
  }
  return false;
}

export function buildPostgresOptions(
  env: NodeJS.ProcessEnv = process.env,
): PostgresConnectionOptions {
  const databaseUrl = env.DATABASE_URL?.trim();
  const ssl = wantsSsl(env, databaseUrl)
    ? { rejectUnauthorized: false }
    : undefined;

  if (databaseUrl) {
    let host = '';
    try {
      host = new URL(databaseUrl).hostname;
    } catch {
      /* handled below */
    }
    if (!host) {
      throw new Error(
        'DATABASE_URL is set but is not a valid URL. Expected ' +
          'postgresql://user:password@host:port/database — check that the ' +
          '"@" before the host was not lost when copying.',
      );
    }
    console.log(
      `[db] Using DATABASE_URL (host: ${host}, ssl: ${Boolean(ssl)})`,
    );
    return { type: 'postgres', url: databaseUrl, ssl };
  }

  const host = env.POSTGRES_HOST ?? 'localhost';

  if (env.NODE_ENV === 'production' && host === 'localhost') {
    throw new Error(
      'NODE_ENV=production but no database is configured: set DATABASE_URL ' +
        '(recommended) or the POSTGRES_* environment variables.',
    );
  }

  console.log(`[db] Using POSTGRES_* variables (host: ${host})`);
  return {
    type: 'postgres',
    host,
    port: Number(env.POSTGRES_PORT ?? 5433),
    username: env.POSTGRES_USER ?? 'buddyscript',
    password: env.POSTGRES_PASSWORD ?? 'buddyscript',
    database: env.POSTGRES_DB ?? 'buddyscript',
    ssl,
  };
}
