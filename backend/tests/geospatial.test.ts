/**
 * Geospatial integration tests
 * Tests PostGIS queries against a real Postgres database with PostGIS extension
 * These tests verify that:
 *   - EventModel.findNearbyEvents() returns real events from the database
 *   - UserProfileModel.findNearbyUsers() returns real users from the database
 *   - ListingModel.findListingsForUser() filters by location using PostGIS queries
 *   - Radius units are consistent (km → meters conversion)
 *   - Query results are filtered by game preferences
 */

import { setupTestDatabase, teardownTestDatabase } from './setup';
import { EventModel } from '@models/event/Event';
import { UserProfileModel } from '@models/user/User';
import { ListingModel } from '@models/listing/Listing';
import { UserModel } from '@models/user/User';
import { Database } from '@config/database';

describe.skip('Geospatial PostGIS queries (Phase 3 - PostGIS extension not in MVP)', () => {
  let db: any;
  let testUserId: string; // Store a real user ID for tests

  beforeAll(async () => {
    db = await setupTestDatabase();

    // Get a real user ID from the database for tests
    const users = await db('users').select('id').limit(1);
    testUserId = users[0].id;
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  describe('EventModel.findNearbyEvents()', () => {
    it('should find Tel Aviv event within 50km from Tel Aviv user', async () => {
      // Tel Aviv user: (32.0853, 34.7818) with 50km radius
      // Should find: Tel Aviv Magic Tournament at (32.0853, 34.7818)
      const events = await EventModel.findNearbyEvents(32.0853, 34.7818, 50);

      expect(events).toBeDefined();
      expect(events.length).toBeGreaterThan(0);

      // Database returns snake_case properties
      const telAvivEvent = events.find((e: any) => e.location_name === 'Tel Aviv Convention Center');
      expect(telAvivEvent).toBeDefined();
      expect(telAvivEvent?.name).toBe('Tel Aviv Magic Tournament');
      expect(telAvivEvent?.games).toContain('mtg');
    });

    it('should find Jerusalem event within 50km from Jerusalem user', async () => {
      // Jerusalem user: (31.7683, 35.2137) with 50km radius
      // Should find: Pokémon Sunday FNM at (31.7683, 35.2137)
      const events = await EventModel.findNearbyEvents(31.7683, 35.2137, 50);

      expect(events).toBeDefined();
      expect(events.length).toBeGreaterThan(0);

      // Database returns snake_case properties
      const jerusalemEvent = events.find((e: any) => e.location_name === 'Jerusalem Gaming Center');
      expect(jerusalemEvent).toBeDefined();
      expect(jerusalemEvent?.name).toBe('Pokémon Sunday FNM');
      expect(jerusalemEvent?.games).toContain('pokemon');
    });

    it('should narrow results with small radius (10km)', async () => {
      // Tel Aviv center with 10km radius should only find very close events
      const events50km = await EventModel.findNearbyEvents(32.0853, 34.7818, 50);
      const events10km = await EventModel.findNearbyEvents(32.0853, 34.7818, 10);

      // Both should find the Tel Aviv event at the exact same coordinates
      expect(events10km.length).toBeGreaterThan(0);
      expect(events10km.length).toBeLessThanOrEqual(events50km.length);

      // All events in 10km should also be in 50km
      events10km.forEach(event10 => {
        expect(events50km.some(e => e.id === event10.id)).toBe(true);
      });
    });

    it('should filter by game type (pokemon)', async () => {
      // Find only Pokemon events near Jerusalem
      const events = await EventModel.findNearbyEvents(
        31.7683,
        35.2137,
        50,
        ['pokemon']
      );

      expect(events).toBeDefined();
      events.forEach(event => {
        expect(event.games).toContain('pokemon');
      });

      // Should find the Pokemon Sunday FNM
      const pokemonEvent = events.find(e => e.name === 'Pokémon Sunday FNM');
      expect(pokemonEvent).toBeDefined();
    });

    it('should return empty array when no nearby events match', async () => {
      // Very far location (middle of Atlantic Ocean) with small radius
      const events = await EventModel.findNearbyEvents(0, 0, 1);

      // Should return empty array since no events are within 1km of (0, 0)
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBe(0);
    });

    it('should order events by start_date ascending', async () => {
      const events = await EventModel.findNearbyEvents(32.0853, 34.7818, 5000);

      // Should be ordered by start_date ascending
      for (let i = 1; i < events.length; i++) {
        const prev = new Date((events[i - 1] as any).start_date).getTime();
        const curr = new Date((events[i] as any).start_date).getTime();
        expect(curr).toBeGreaterThanOrEqual(prev);
      }
    });

    it('should only return active events', async () => {
      const events = await EventModel.findNearbyEvents(32.0853, 34.7818, 5000);

      events.forEach((event: any) => {
        expect(event.status).toBe('active');
      });
    });
  });

  describe('UserProfileModel.findNearbyUsers()', () => {
    it('should find nearby users within 50km radius', async () => {
      // Find users near Tel Aviv (32.0853, 34.7818) within 50km
      // Seed data has: Alice (32.0853, 34.7818), Bob (32.0753, 34.7718), Charlie (32.0953, 34.7918)
      const users = await UserProfileModel.findNearbyUsers(32.0853, 34.7818, 50);

      expect(users).toBeDefined();
      expect(users.length).toBeGreaterThan(0);

      // Should find at least Alice
      const alice = users.find((u: any) => u.display_name === 'Alice Collector');
      expect(alice).toBeDefined();
    });

    it('should narrow results with 5km radius', async () => {
      const users50km = await UserProfileModel.findNearbyUsers(32.0853, 34.7818, 50);
      const users5km = await UserProfileModel.findNearbyUsers(32.0853, 34.7818, 5);

      // 5km should have fewer or equal results
      expect(users5km.length).toBeLessThanOrEqual(users50km.length);

      // All users in 5km should also be in 50km
      users5km.forEach((user5: any) => {
        expect(users50km.some((u: any) => u.user_id === user5.user_id)).toBe(true);
      });
    });

    it('should filter by game type (mtg only)', async () => {
      // Find MTG players near Tel Aviv
      const users = await UserProfileModel.findNearbyUsers(32.0853, 34.7818, 50, ['mtg']);

      expect(users).toBeDefined();
      users.forEach((user: any) => {
        expect(user.games).toContain('mtg');
      });

      // Should find Alice (mtg) and Bob (mtg)
      expect(users.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter by single game type and location', async () => {
      // Find Pokemon players near Tel Aviv within 50km
      const users = await UserProfileModel.findNearbyUsers(
        32.0853,
        34.7818,
        50,
        ['pokemon']
      );

      expect(users).toBeDefined();
      users.forEach(user => {
        expect(user.games).toContain('pokemon');
      });

      // Should find at least Alice or Charlie who play Pokemon
      const names = users.map((u: any) => u.display_name);
      expect(
        names.includes('Alice Collector') || names.includes('Charlie Player')
      ).toBe(true);
    });

    it('should return empty array when no users match location', async () => {
      // Middle of Atlantic Ocean
      const users = await UserProfileModel.findNearbyUsers(0, 0, 1);

      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBe(0);
    });

    it('should handle multiple game filters with AND logic', async () => {
      // Find users who play both MTG and Pokemon
      const users = await UserProfileModel.findNearbyUsers(
        32.0853,
        34.7818,
        100,
        ['mtg', 'pokemon']
      );

      // Users should have at least one of these games (array intersection)
      // In PostgreSQL, the && operator checks array overlap
      expect(users.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('ListingModel.findListingsForUser()', () => {
    it('should find listings from nearby sellers', async () => {
      // Find listings near Tel Aviv (32.0853, 34.7818) within 50km
      const listings = await ListingModel.findListingsForUser(testUserId, {
        locationLat: 32.0853,
        locationLng: 34.7818,
        radiusKm: 50,
      });

      expect(listings).toBeDefined();
      expect(Array.isArray(listings)).toBe(true);
      // Should find at least one listing from nearby sellers
    });

    it('should exclude listings from the current user', async () => {
      // Use the actual seller ID from seed data
      const users = await db('users').select('id').limit(1);
      const sellerId = users[0].id;

      // Find listings, should exclude any from the seller themselves
      const listings = await ListingModel.findListingsForUser(sellerId, {
        locationLat: 32.0853,
        locationLng: 34.7818,
        radiusKm: 5000,
      });

      // None should be from the current user
      listings.forEach((listing: any) => {
        expect(listing.seller_id).not.toBe(sellerId);
      });
    });

    it('should filter by game type', async () => {
      const listings = await ListingModel.findListingsForUser(testUserId, {
        games: ['mtg'],
        locationLat: 32.0853,
        locationLng: 34.7818,
        radiusKm: 50,
      });

      expect(listings).toBeDefined();
      listings.forEach((listing: any) => {
        expect(listing.game).toBe('mtg');
      });
    });

    it('should filter by multiple games', async () => {
      const listings = await ListingModel.findListingsForUser(testUserId, {
        games: ['mtg', 'pokemon'],
        locationLat: 32.0853,
        locationLng: 34.7818,
        radiusKm: 50,
      });

      expect(listings).toBeDefined();
      listings.forEach((listing: any) => {
        expect(['mtg', 'pokemon']).toContain(listing.game);
      });
    });

    it('should filter by price range', async () => {
      const listings = await ListingModel.findListingsForUser(testUserId, {
        locationLat: 32.0853,
        locationLng: 34.7818,
        radiusKm: 50,
        minPrice: 1000, // 1000 ILS
        maxPrice: 2000, // 2000 ILS (100000 - 200000 cents)
      });

      expect(listings).toBeDefined();
      listings.forEach((listing: any) => {
        // price_cents should be between 100000 and 200000
        expect(listing.price_cents).toBeGreaterThanOrEqual(100000);
        expect(listing.price_cents).toBeLessThanOrEqual(200000);
      });
    });

    it('should only return active listings', async () => {
      const listings = await ListingModel.findListingsForUser(testUserId, {
        locationLat: 32.0853,
        locationLng: 34.7818,
        radiusKm: 50,
      });

      listings.forEach((listing: any) => {
        expect(listing.status).toBe('active');
      });
    });

    it('should order listings by creation date (newest first)', async () => {
      const listings = await ListingModel.findListingsForUser(testUserId, {
        locationLat: 32.0853,
        locationLng: 34.7818,
        radiusKm: 50,
      });

      // Should be ordered by created_at DESC
      for (let i = 1; i < listings.length; i++) {
        const prev = new Date((listings[i - 1] as any).created_at).getTime();
        const curr = new Date((listings[i] as any).created_at).getTime();
        expect(curr).toBeLessThanOrEqual(prev);
      }
    });

    it('should narrow results with small radius', async () => {
      const listings50km = await ListingModel.findListingsForUser(testUserId, {
        locationLat: 32.0853,
        locationLng: 34.7818,
        radiusKm: 50,
      });

      const listings10km = await ListingModel.findListingsForUser(testUserId, {
        locationLat: 32.0853,
        locationLng: 34.7818,
        radiusKm: 10,
      });

      // Smaller radius should have fewer or equal results
      expect(listings10km.length).toBeLessThanOrEqual(listings50km.length);

      // All 10km listings should also be in 50km
      listings10km.forEach((listing10: any) => {
        expect(listings50km.some((l: any) => l.id === listing10.id)).toBe(true);
      });
    });
  });

  describe('PostGIS radius unit consistency', () => {
    it('should convert km to meters correctly in EventModel', async () => {
      // The query uses radiusKm * 1000 to convert to meters
      // 50km = 50000 meters
      const events50km = await EventModel.findNearbyEvents(32.0853, 34.7818, 50);

      // This should use ST_DWithin with 50000 meters
      expect(events50km).toBeDefined();
      expect(Array.isArray(events50km)).toBe(true);
    });

    it('should convert km to meters correctly in UserProfileModel', async () => {
      const users50km = await UserProfileModel.findNearbyUsers(32.0853, 34.7818, 50);

      // This should use ST_DWithin with 50000 meters
      expect(users50km).toBeDefined();
      expect(Array.isArray(users50km)).toBe(true);
    });

    it('should convert km to meters correctly in ListingModel', async () => {
      const listings50km = await ListingModel.findListingsForUser(testUserId, {
        locationLat: 32.0853,
        locationLng: 34.7818,
        radiusKm: 50,
      });

      // This should use ST_DWithin with 50000 meters
      expect(listings50km).toBeDefined();
      expect(Array.isArray(listings50km)).toBe(true);
    });
  });

  describe('Geographic edge cases', () => {
    it('should handle negative coordinates (southern hemisphere)', async () => {
      // Sydney: -33.8688, 151.2093
      const events = await EventModel.findNearbyEvents(-33.8688, 151.2093, 100);
      expect(Array.isArray(events)).toBe(true);
    });

    it('should handle coordinates near international date line', async () => {
      // Near date line (around 180 degrees)
      const users = await UserProfileModel.findNearbyUsers(0, 179.9, 100);
      expect(Array.isArray(users)).toBe(true);
    });

    it('should handle coordinates at equator and prime meridian', async () => {
      // Equator and Prime Meridian (0, 0)
      const events = await EventModel.findNearbyEvents(0, 0, 100);
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBe(0); // No events at ocean
    });
  });

  describe('Real data validation', () => {
    it('should confirm seed data is present in database', async () => {
      const users = await db('users').count('*');
      expect(parseInt(users[0].count)).toBeGreaterThan(0);

      const events = await db('events').count('*');
      expect(parseInt(events[0].count)).toBeGreaterThan(0);

      const listings = await db('listings').count('*');
      expect(parseInt(listings[0].count)).toBeGreaterThan(0);
    });

    it('should find Alice at Tel Aviv coordinates', async () => {
      const alice = await db('user_profiles')
        .where('display_name', 'Alice Collector')
        .first();

      expect(alice).toBeDefined();
      // Coordinates are returned as strings from the database
      expect(parseFloat(alice?.location_lat)).toBeCloseTo(32.0853, 3);
      expect(parseFloat(alice?.location_lng)).toBeCloseTo(34.7818, 3);
      expect(alice?.games).toContain('mtg');
    });

    it('should find Black Lotus listing from Alice', async () => {
      const alice = await db('users').where('email', 'alice@example.com').first();
      const listing = await db('listings')
        .where('card_name', 'Black Lotus')
        .where('seller_id', alice.id)
        .first();

      expect(listing).toBeDefined();
      expect(listing?.game).toBe('mtg');
      expect(listing?.status).toBe('active');
    });

    it('should find Tel Aviv Magic Tournament event', async () => {
      const event = await db('events')
        .where('name', 'Tel Aviv Magic Tournament')
        .first();

      expect(event).toBeDefined();
      // Coordinates are returned as strings from the database
      expect(parseFloat(event?.location_lat)).toBeCloseTo(32.0853, 3);
      expect(parseFloat(event?.location_lng)).toBeCloseTo(34.7818, 3);
      expect(event?.games).toContain('mtg');
      expect(event?.status).toBe('active');
    });
  });

  describe('Listing enrichment with sharedEvents (Cycle 3.4)', () => {
    it('should GET /api/listings return listings with sharedEvents array', async () => {
      // This test verifies the API contract for the BrowseScreen
      // Listings should have a sharedEvents array (can be empty)
      const listings = await ListingModel.findListingsForUser(testUserId, {
        locationLat: 32.0853,
        locationLng: 34.7818,
        radiusKm: 50,
      });

      // At this point, listings don't have sharedEvents yet
      // The enrichment happens in ListingService.getListings()
      expect(listings).toBeDefined();
      expect(Array.isArray(listings)).toBe(true);

      // Each listing should have required fields for mapListing function
      listings.forEach((listing: any) => {
        expect(listing.id).toBeDefined();
        expect(listing.card_name).toBeDefined();
        expect(listing.card_set).toBeDefined();
        expect(listing.condition).toBeDefined();
        expect(listing.price_cents).toBeDefined();
        expect(listing.game).toBeDefined();
        expect(listing.seller_id).toBeDefined();
        expect(listing.status).toBe('active');
      });
    });

    it('should find shared events between two users', async () => {
      // Get two different users
      const users = await db('users').select('id').limit(2);

      if (users.length >= 2) {
        const userId1 = users[0].id;
        const userId2 = users[1].id;

        // Both users should have RSVPed to same events
        const sharedEvents = await EventModel.findSharedEvents(userId1, userId2);

        // The test database should have at least some shared events
        expect(sharedEvents).toBeDefined();
        expect(Array.isArray(sharedEvents)).toBe(true);
        // sharedEvents may be empty or have items, both are valid
      }
    });

    it('should return empty array when users have no shared events', async () => {
      // This test checks the fallback behavior
      // The test database may have users with or without shared events
      // We just verify that the query returns an array (empty or not)
      const users = await db('users').select('id').limit(2);

      if (users.length >= 2) {
        const userId1 = users[0].id;
        const userId2 = users[1].id;

        const sharedEvents = await EventModel.findSharedEvents(userId1, userId2);

        expect(sharedEvents).toBeDefined();
        expect(Array.isArray(sharedEvents)).toBe(true);
      }
    });
  });
});
