// Global test setup — no real DB needed for unit tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret';

import { Database } from '@config/database';

/**
 * Set up a test database instance for integration tests
 * This function:
 *   1. Runs all pending migrations
 *   2. Clears all test data to avoid duplicate key conflicts
 *   3. Seeds initial data (by importing and calling the seed function directly)
 *   4. Returns the Knex instance
 *
 * Usage: call in beforeAll() before running geospatial/integration tests
 */
export async function setupTestDatabase() {
  try {
    // Ensure database exists before running migrations
    await Database.ensureDatabase();

    const db = Database.getInstance();

    // Run migrations
    await db.migrate.latest();
    console.log('Test database migrations completed');

    // Clear all test data (in reverse dependency order) to avoid unique constraint violations
    // when tests run multiple times
    try {
      await db('notifications').del();
      await db('meetups').del();
      await db('offers').del();
      await db('deals').del();
      await db('listings').del();
      await db('event_rsvps').del();
      await db('events').del();
      await db('user_profiles').del();
      await db('users').del();
      console.log('Test database cleared');
    } catch (clearErr) {
      // If tables don't exist yet, that's fine
      console.log('(Tables not yet created or already empty)');
    }

    // Seed test data by calling the seed function directly
    // This bypasses Knex's seed caching mechanism
    const { seed } = await import('../src/seeds/001_sample_data');
    await seed(db);
    console.log('Test database seeding completed');

    return db;
  } catch (error) {
    console.error('Failed to set up test database:', error);
    throw error;
  }
}

/**
 * Clean up test database connection
 * Usage: call in afterAll() after all integration tests complete
 */
export async function teardownTestDatabase() {
  try {
    await Database.close();
    console.log('Test database connection closed');
  } catch (error) {
    console.error('Failed to close test database:', error);
    throw error;
  }
}
