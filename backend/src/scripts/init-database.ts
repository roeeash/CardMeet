import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Ensures the PostgreSQL database and user exist.
 * Connects to 'template1' (always exists) to run admin queries.
 * Creates the 'postgres' role if missing, then creates 'cardmeet_dev' database if missing.
 *
 * Environment variables:
 *   DB_HOST (default: localhost)
 *   DB_PORT (default: 5432)
 *   DB_USER (default: postgres)
 *   DB_PASSWORD (default: password)
 *
 * @throws on real failures (connection errors, permission issues, etc.)
 * @logs warnings for already-exists scenarios (role/database already exist)
 */
export async function ensureDatabaseExists(): Promise<void> {
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = parseInt(process.env.DB_PORT || '5432', 10);
  const dbUser = process.env.DB_USER || 'postgres';
  const dbPassword = process.env.DB_PASSWORD || 'password';
  const dbName = process.env.DB_NAME || 'cardmeet_dev';

  const adminClient = new Client({
    host: dbHost,
    port: dbPort,
    database: 'template1', // Always exists
    user: dbUser,
    password: dbPassword,
  });

  try {
    console.log(`[Database Bootstrap] Connecting to PostgreSQL on ${dbHost}:${dbPort}...`);
    await adminClient.connect();
    console.log('[Database Bootstrap] Connected successfully');

    // Check if postgres role exists; create if missing
    console.log(`[Database Bootstrap] Checking for ${dbUser} role...`);
    const roleResult = await adminClient.query(
      `SELECT 1 FROM pg_roles WHERE rolname = $1`,
      [dbUser]
    );

    if (roleResult.rows.length === 0) {
      console.log(`[Database Bootstrap] Role ${dbUser} not found, creating...`);
      await adminClient.query(
        `CREATE ROLE ${dbUser} WITH LOGIN PASSWORD $1 CREATEDB`,
        [dbPassword]
      );
      console.log(`[Database Bootstrap] Role ${dbUser} created successfully`);
    } else {
      console.log(`[Database Bootstrap] Role ${dbUser} already exists`);
    }

    // Check if cardmeet_dev database exists; create if missing
    console.log(`[Database Bootstrap] Checking for ${dbName} database...`);
    const dbResult = await adminClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName]
    );

    if (dbResult.rows.length === 0) {
      console.log(`[Database Bootstrap] Database ${dbName} not found, creating...`);
      await adminClient.query(
        `CREATE DATABASE ${dbName} OWNER ${dbUser}`
      );
      console.log(`[Database Bootstrap] Database ${dbName} created successfully`);
    } else {
      console.log(`[Database Bootstrap] Database ${dbName} already exists`);
    }

    console.log('[Database Bootstrap] Database bootstrap completed successfully');
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    // On managed Postgres (e.g. Railway), role/database may already exist with permission denied
    if (msg.includes('already exists') || msg.includes('permission denied')) {
      console.warn(`[Database Bootstrap] Warning: ${msg} (continuing anyway)`);
    } else {
      console.error(`[Database Bootstrap] Fatal error: ${msg}`);
      throw error;
    }
  } finally {
    await adminClient.end();
  }
}

// Standalone execution: if called directly, run and exit
if (require.main === module) {
  (async () => {
    try {
      await ensureDatabaseExists();
      process.exit(0);
    } catch (error) {
      console.error('Database bootstrap failed:', error);
      process.exit(1);
    }
  })();
}
