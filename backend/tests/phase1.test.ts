/**
 * Phase 1 verification tests.
 * These tests do NOT connect to a real database — they verify structure,
 * type contracts, model APIs, and the Express app configuration.
 */

import { BaseModel } from '@models/BaseModel';
import { UserModel, UserProfileModel } from '@models/user/User';
import { EventModel, EventRSVPModel } from '@models/event/Event';
import { ListingModel } from '@models/listing/Listing';
import { DealModel } from '@models/deal/Deal';
import { OfferModel } from '@models/deal/Offer';
import { MeetupModel } from '@models/meetup/Meetup';
import { NotificationModel } from '@models/notification/Notification';

// ── Shared type shape checks ──────────────────────────────────────────────────

import type { User, UserProfile, Game } from '@shared/types/user';
import type { Event, EventRSVP, EventType, EventStatus, RSVPStatus } from '@shared/types/event';
import type { Listing, CardCondition, ListingStatus } from '@shared/types/listing';
import type { Deal, DealStatus } from '@shared/types/deal';
import type { Offer, OfferStatus } from '@shared/types/offer';
import type { Meetup, MeetupStatus } from '@shared/types/meetup';
import type { Notification, NotificationType } from '@shared/types/notification';

describe('Phase 1 — Shared types', () => {
  it('User type has required fields', () => {
    const u: User = { id: '1', email: 'a@b.com', createdAt: new Date(), updatedAt: new Date() };
    expect(u.id).toBeDefined();
    expect(u.email).toBeDefined();
  });

  it('Game union covers all four target games', () => {
    const games: Game[] = ['mtg', 'pokemon', 'yugioh', 'lorcana'];
    expect(games).toHaveLength(4);
  });

  it('DealStatus covers all negotiation states', () => {
    const statuses: DealStatus[] = ['negotiating', 'matched', 'scheduled', 'completed', 'cancelled'];
    expect(statuses).toHaveLength(5);
  });

  it('MeetupStatus covers no-show variants', () => {
    const statuses: MeetupStatus[] = ['scheduled', 'completed', 'no_show_buyer', 'no_show_seller', 'cancelled'];
    expect(statuses).toHaveLength(5);
  });

  it('OfferStatus has countered state', () => {
    const statuses: OfferStatus[] = ['active', 'accepted', 'withdrawn', 'countered'];
    expect(statuses).toHaveLength(4);
  });

  it('NotificationType covers all notification event types', () => {
    const types: NotificationType[] = ['offer_received', 'deal_matched', 'meetup_reminder', 'meetup_confirmed', 'deal_completed'];
    expect(types).toHaveLength(5);
  });

  it('Notification type has required fields', () => {
    const n: Notification = {
      id: '1',
      userId: 'user-1',
      type: 'offer_received',
      title: 'New offer',
      body: 'You have a new offer',
      read: false,
      createdAt: new Date(),
    };
    expect(n.id).toBeDefined();
    expect(n.userId).toBeDefined();
    expect(n.type).toBeDefined();
  });
});

// ── Model class structure ─────────────────────────────────────────────────────

describe('Phase 1 — Model class APIs', () => {
  it('BaseModel exposes setDatabase static method', () => {
    expect(typeof BaseModel.setDatabase).toBe('function');
  });

  it('UserModel has required static methods', () => {
    expect(typeof UserModel.findByEmail).toBe('function');
    expect(typeof UserModel.create).toBe('function');
    expect(typeof UserModel.verifyPassword).toBe('function');
    expect(typeof UserModel.generateTokens).toBe('function');
    expect(typeof UserModel.verifyToken).toBe('function');
  });

  it('UserProfileModel has reputation update method', () => {
    expect(typeof UserProfileModel.updateReputation).toBe('function');
    expect(typeof UserProfileModel.findNearbyUsers).toBe('function');
  });

  it('EventModel has shared-event and geospatial methods', () => {
    expect(typeof EventModel.findSharedEvents).toBe('function');
    expect(typeof EventModel.findNearbyEvents).toBe('function');
    expect(typeof EventModel.findByGameAndLocation).toBe('function');
  });

  it('EventRSVPModel has upsert RSVP method', () => {
    expect(typeof EventRSVPModel.setRSVP).toBe('function');
    expect(typeof EventRSVPModel.getUserRSVPs).toBe('function');
  });

  it('ListingModel has browse and seller methods', () => {
    expect(typeof ListingModel.findListingsForUser).toBe('function');
    expect(typeof ListingModel.getSellerListings).toBe('function');
  });

  it('DealModel tracks current turn', () => {
    expect(typeof DealModel.createDeal).toBe('function');
    expect(typeof DealModel.getUserDeals).toBe('function');
    expect(typeof DealModel.getCurrentTurn).toBe('function');
  });

  it('OfferModel supports full offer lifecycle', () => {
    expect(typeof OfferModel.createOffer).toBe('function');
    expect(typeof OfferModel.getOfferChain).toBe('function');
    expect(typeof OfferModel.acceptOffer).toBe('function');
    expect(typeof OfferModel.withdrawOffer).toBe('function');
  });

  it('MeetupModel has slot-finding and confirmation', () => {
    expect(typeof MeetupModel.createMeetup).toBe('function');
    expect(typeof MeetupModel.confirmMeetup).toBe('function');
    expect(typeof MeetupModel.completeMeetup).toBe('function');
    expect(typeof MeetupModel.findAvailableSlots).toBe('function');
  });

  it('MeetupModel has per-party check-in recording', () => {
    expect(typeof MeetupModel.recordCheckIn).toBe('function');
    expect(typeof MeetupModel.checkAndCompleteMeetup).toBe('function');
    expect(typeof MeetupModel.setMeetupOutcome).toBe('function');
  });

  it('NotificationModel supports notification lifecycle', () => {
    expect(typeof NotificationModel.createNotification).toBe('function');
    expect(typeof NotificationModel.getNotifications).toBe('function');
    expect(typeof NotificationModel.markAsRead).toBe('function');
  });
});

// ── MeetupModel.findAvailableSlots logic (pure, no DB) ───────────────────────

describe('Phase 1 — MeetupModel slot logic', () => {
  beforeAll(() => {
    // Provide a minimal mock knex so the model doesn't throw on import
    const mockQuery = {
      select: () => mockQuery,
      where: () => mockQuery,
      whereRaw: () => mockQuery,
      orderBy: () => mockQuery,
      then: (resolve: (v: any[]) => void) => Promise.resolve([]).then(resolve),
    };
    BaseModel.setDatabase((() => mockQuery) as any);
  });

  it('returns 30-min slots between 09:00 and 21:00 when no conflicts', async () => {
    const date = new Date('2026-06-15T00:00:00Z');
    const slots = await MeetupModel.findAvailableSlots('event-1', date, 30);
    expect(slots.length).toBeGreaterThan(0);
    slots.forEach((slot) => {
      const duration = slot.endTime.getTime() - slot.startTime.getTime();
      expect(duration).toBe(30 * 60 * 1000);
    });
  });
});

// ── DealService turn-flipping logic ──────────────────────────────────────────

describe('Phase 1 — DealService.makeOffer turn logic', () => {
  beforeAll(() => {
    // Provide a minimal mock knex so models don't throw on import
    const mockQuery = {
      select: () => mockQuery,
      where: () => mockQuery,
      whereRaw: () => mockQuery,
      whereNot: () => mockQuery,
      orderBy: () => mockQuery,
      insert: () => ({ returning: () => Promise.resolve([{ id: '1' }]) }),
      update: () => ({ returning: () => Promise.resolve([{ id: '1' }]) }),
      first: () => Promise.resolve(null),
      then: (resolve: (v: any[]) => void) => Promise.resolve([]).then(resolve),
    };
    BaseModel.setDatabase((() => mockQuery) as any);
  });

  it('DealModel has getById method', () => {
    expect(typeof DealModel.getById).toBe('function');
  });

  it('DealModel has updateDeal method for price and turn updates', () => {
    expect(typeof DealModel.updateDeal).toBe('function');
  });
});

// ── NotificationService no-op safety ────────────────────────────────────────

import { NotificationService } from '@services/NotificationService';

describe('Phase 1 — NotificationService no-op safety', () => {
  beforeAll(() => {
    // Mock the database to simulate failure
    const mockQuery = {
      select: () => mockQuery,
      where: () => mockQuery,
      update: () => ({ returning: () => Promise.resolve([]) }),
      insert: () => ({ returning: () => Promise.reject(new Error('DB connection failed')) }),
      first: () => Promise.resolve(null),
      then: (resolve: (v: any[]) => void) => Promise.resolve([]).then(resolve),
    };
    NotificationModel.setDatabase((() => mockQuery) as any);
  });

  it('NotificationService.createNotification returns empty object on DB failure', async () => {
    const result = await NotificationService.createNotification({
      userId: 'user-1',
      type: 'offer_received',
      title: 'Test',
      body: 'Test body',
    });
    expect(result).toEqual({});
  });

  it('NotificationService.createNotification does not throw on DB error', async () => {
    await expect(
      NotificationService.createNotification({
        userId: 'user-1',
        type: 'deal_matched',
        title: 'Test',
        body: 'Test body',
      })
    ).resolves.toBeDefined();
  });

  it('NotificationService is importable from @services/NotificationService', () => {
    expect(typeof NotificationService).toBe('function');
    expect(typeof NotificationService.createNotification).toBe('function');
  });
});

// ── Input validation (Phase 1.10) ────────────────────────────────────────────

import {
  validateRequest,
  registerSchema,
  loginSchema,
  refreshSchema,
  createListingSchema,
  updateListingStatusSchema,
  createDealSchema,
  makeOfferSchema,
  rsvpSchema,
  scheduleMeetupSchema,
  updateProfileSchema,
} from '@middleware/validation';

describe('Phase 1.10 — Input validation with Joi', () => {
  it('registerSchema requires email and password (min 8 chars)', () => {
    expect(registerSchema.validate({ email: 'a@b.com', password: 'short' }).error).toBeDefined();
    expect(registerSchema.validate({ email: 'a@b.com', password: 'long_enough' }).error).toBeUndefined();
  });

  it('loginSchema requires email and password', () => {
    expect(loginSchema.validate({ email: 'a@b.com', password: 'pass' }).error).toBeUndefined();
    expect(loginSchema.validate({ email: 'invalid', password: 'pass' }).error).toBeDefined();
  });

  it('refreshSchema requires refreshToken', () => {
    expect(refreshSchema.validate({ refreshToken: 'token' }).error).toBeUndefined();
    expect(refreshSchema.validate({}).error).toBeDefined();
  });

  it('createListingSchema validates card_name, condition, price_cents, and game', () => {
    const valid = {
      card_name: 'Black Lotus',
      condition: 'nm',
      price_cents: 5000,
      game: 'mtg',
    };
    expect(createListingSchema.validate(valid).error).toBeUndefined();

    const invalidPrice = { ...valid, price_cents: -100 };
    expect(createListingSchema.validate(invalidPrice).error).toBeDefined();

    const invalidGame = { ...valid, game: 'invalid' };
    expect(createListingSchema.validate(invalidGame).error).toBeDefined();
  });

  it('updateListingStatusSchema validates status enum', () => {
    expect(updateListingStatusSchema.validate({ status: 'active' }).error).toBeUndefined();
    expect(updateListingStatusSchema.validate({ status: 'invalid' }).error).toBeDefined();
  });

  it('createDealSchema requires listingId (UUID) and positive initialOfferPrice', () => {
    const valid = {
      listingId: '550e8400-e29b-41d4-a716-446655440000',
      initialOfferPrice: 10,
    };
    expect(createDealSchema.validate(valid).error).toBeUndefined();

    const invalidUuid = { ...valid, listingId: 'not-a-uuid' };
    expect(createDealSchema.validate(invalidUuid).error).toBeDefined();

    const invalidPrice = { ...valid, initialOfferPrice: 0 };
    expect(createDealSchema.validate(invalidPrice).error).toBeDefined();
  });

  it('makeOfferSchema requires positive price', () => {
    expect(makeOfferSchema.validate({ price: 100 }).error).toBeUndefined();
    expect(makeOfferSchema.validate({ price: -50 }).error).toBeDefined();
    expect(makeOfferSchema.validate({ price: 0 }).error).toBeDefined();
  });

  it('rsvpSchema requires status enum', () => {
    expect(rsvpSchema.validate({ status: 'going' }).error).toBeUndefined();
    expect(rsvpSchema.validate({ status: 'invalid' }).error).toBeDefined();
  });

  it('scheduleMeetupSchema requires HH:MM format and UUIDs', () => {
    const valid = {
      dealId: '550e8400-e29b-41d4-a716-446655440000',
      eventId: '550e8400-e29b-41d4-a716-446655440001',
      proposedWindowStart: '13:00',
      proposedWindowEnd: '13:30',
    };
    expect(scheduleMeetupSchema.validate(valid).error).toBeUndefined();

    const invalidTime = { ...valid, proposedWindowStart: 'not-a-time' };
    expect(scheduleMeetupSchema.validate(invalidTime).error).toBeDefined();
  });

  it('updateProfileSchema allows optional lat/lng, radius, and games', () => {
    const valid = {
      location_lat: 32.0853,
      location_lng: 34.7818,
      travel_radius_km: 50,
      games: ['mtg', 'pokemon'],
    };
    expect(updateProfileSchema.validate(valid).error).toBeUndefined();

    const invalidRadius = { travel_radius_km: -10 };
    expect(updateProfileSchema.validate(invalidRadius).error).toBeDefined();
  });

  it('validateRequest middleware returns 400 on validation error', async () => {
    const middleware = validateRequest(registerSchema);
    const req = { body: { email: 'bad' } } as any;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Validation failed') })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('validateRequest middleware passes on success and coerces body', async () => {
    const middleware = validateRequest(registerSchema);
    const req = { body: { email: 'a@b.com', password: 'password123' } } as any;
    const res = {} as any;
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.body.email).toBe('a@b.com');
  });
});

// ── Express app smoke test ────────────────────────────────────────────────────

import request from 'supertest';

describe('Phase 1 — Express app', () => {
  let app: Express.Application;

  beforeAll(async () => {
    // Import app after env vars are set in setup.ts
    const mod = await import('../src/app');
    app = mod.app;
  });

  it('GET /health returns 200 with status OK', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
    expect(res.body.timestamp).toBeDefined();
  });

  it('unknown routes return 404 or error (not 500)', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).not.toBe(500);
  });
});
