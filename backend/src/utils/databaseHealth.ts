import { Database } from '../config/database';

export async function checkDatabaseHealth(): Promise<{
  status: 'healthy' | 'unhealthy';
  details: Record<string, unknown>;
}> {
  try {
    const db = Database.getInstance();

    await db.raw('SELECT 1');

    const tableCounts = await db.raw(`
      SELECT
        (SELECT COUNT(*) FROM users)    AS users,
        (SELECT COUNT(*) FROM events)   AS events,
        (SELECT COUNT(*) FROM listings) AS listings,
        (SELECT COUNT(*) FROM deals)    AS deals
    `);

    return {
      status: 'healthy',
      details: {
        connection: 'ok',
        tables: tableCounts.rows[0],
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
    };
  }
}
