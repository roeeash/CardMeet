/**
 * Full happy path integration test suite
 * Tests the complete user flow: register → login → listing → deal → offer chain → meetup → check-in
 * Runs against a real test database with all models and services
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { setupTestDatabase, teardownTestDatabase } from './setup';
import { Database } from '@config/database';
import { UserModel } from '@models/user/User';
import { ListingModel } from '@models/listing/Listing';
import { DealModel } from '@models/deal/Deal';
import { OfferModel } from '@models/deal/Offer';
import { EventModel } from '@models/event/Event';
import { EventRSVPModel } from '@models/event/Event';
import { MeetupModel } from '@models/meetup/Meetup';

jest.setTimeout(30000);

describe('Full happy path: register → login → listing → deal → offer chain → meetup → check-in', () => {
  let app: any;
  let db: any;

  // Test user data
  let buyerEmail = 'buyer@test.com';
  let buyerPassword = 'password123';
  let sellerEmail = 'seller@test.com';
  let sellerPassword = 'password456';

  // Response data storage
  let buyerToken: string;
  let buyerUserId: string;
  let sellerToken: string;
  let sellerUserId: string;
  let listingId: string;
  let dealId: string;
  let offerId: string;
  let meetupId: string;
  let eventId: string;

  beforeAll(async () => {
    // Set up test database
    db = await setupTestDatabase();

    // Import app after database is initialized
    const mod = await import('../src/app');
    app = mod.app;
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  // ─── Test 1: Register two test users ────────────────────────────────────────

  it('Test 1: Register buyer and seller', async () => {
    // Register buyer
    const buyerRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: buyerEmail,
        password: buyerPassword,
      });

    expect(buyerRes.status).toBe(201);
    expect(buyerRes.body).toHaveProperty('accessToken');
    expect(buyerRes.body).toHaveProperty('refreshToken');
    expect(buyerRes.body).toHaveProperty('user');

    buyerToken = buyerRes.body.accessToken;
    buyerUserId = buyerRes.body.user.id;

    // Decode token to verify userId is embedded
    const decodedBuyer: any = jwt.decode(buyerToken);
    expect(decodedBuyer.userId).toBe(buyerUserId);

    // Register seller
    const sellerRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: sellerEmail,
        password: sellerPassword,
      });

    expect(sellerRes.status).toBe(201);
    expect(sellerRes.body).toHaveProperty('accessToken');
    expect(sellerRes.body).toHaveProperty('refreshToken');
    expect(sellerRes.body).toHaveProperty('user');

    sellerToken = sellerRes.body.accessToken;
    sellerUserId = sellerRes.body.user.id;

    // Decode token to verify userId is embedded
    const decodedSeller: any = jwt.decode(sellerToken);
    expect(decodedSeller.userId).toBe(sellerUserId);

    // Verify both tokens are different
    expect(buyerToken).not.toBe(sellerToken);
    expect(buyerUserId).not.toBe(sellerUserId);
  });

  // ─── Test 2: Login with buyer credentials ──────────────────────────────────

  it('Test 2: Login buyer with credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: buyerEmail,
        password: buyerPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body).toHaveProperty('user');

    // Verify the token can be decoded and contains userId
    const decoded: any = jwt.decode(res.body.accessToken);
    expect(decoded).toHaveProperty('userId');
    expect(decoded.userId).toBe(res.body.user.id);
  });

  // ─── Test 3: Seller creates a listing ────────────────────────────────────────

  it('Test 3: Seller creates listing for Black Lotus', async () => {
    const res = await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        card_name: 'Black Lotus',
        condition: 'nm',
        price_cents: 500000, // 5000 shekels
        game: 'mtg',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.cardName).toBe('Black Lotus');
    expect(res.body.condition).toBe('nm');
    // The DTO converts price_cents to price (whole shekels)
    expect(res.body.price).toBe(5000);
    expect(res.body.game).toBe('mtg');

    // Verify response uses camelCase (not snake_case)
    expect(res.body).not.toHaveProperty('card_name');
    expect(res.body).toHaveProperty('cardName');

    listingId = res.body.id;
  });

  // ─── Test 4: Both parties RSVP to shared event ─────────────────────────────

  it('Test 4: Both buyer and seller RSVP to shared event', async () => {
    // Get an event from seed data
    const events = await db('events').select('*').limit(1);
    expect(events.length).toBeGreaterThan(0);

    eventId = events[0].id;

    // Buyer RSVPs
    const buyerRsvpRes = await request(app)
      .put(`/api/events/${eventId}/rsvp`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        status: 'going',
      });

    expect(buyerRsvpRes.status).toBe(200);
    expect(buyerRsvpRes.body).toHaveProperty('userId');

    // Seller RSVPs
    const sellerRsvpRes = await request(app)
      .put(`/api/events/${eventId}/rsvp`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        status: 'going',
      });

    expect(sellerRsvpRes.status).toBe(200);
    expect(sellerRsvpRes.body).toHaveProperty('userId');
  });

  // ─── Test 5: Buyer creates deal (initial offer) ────────────────────────────

  it('Test 5: Buyer creates deal with initial offer', async () => {
    const res = await request(app)
      .post('/api/deals')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        listingId: listingId,
        initialOfferPrice: 4000, // Buyer offers 4000 shekels (less than asking 5000)
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.status).toBe('negotiating');
    expect(res.body).toHaveProperty('currentTurn');

    // Verify currentTurn is set to seller (it's their turn to respond)
    expect(res.body.currentTurn).toBe(sellerUserId);

    // Verify response uses camelCase
    expect(res.body).toHaveProperty('currentTurn');
    expect(res.body).not.toHaveProperty('current_turn');

    dealId = res.body.id;
  });

  // ─── Test 6: Seller makes counter-offer ────────────────────────────────────

  it('Test 6: Seller makes counter-offer and turn flips to buyer', async () => {
    // Seller makes counter-offer
    const res = await request(app)
      .post(`/api/deals/${dealId}/offer`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        price: 4500,
        note: 'Can you go higher?',
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');

    offerId = res.body.id;

    // Verify offer chain contains the counter-offer
    expect(res.body).toHaveProperty('price');
    expect(res.body.price).toBe(4500);

    // Fetch deal to verify currentTurn flipped to buyer
    const dealRes = await request(app)
      .get(`/api/deals/${dealId}`)
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(dealRes.status).toBe(200);
    const deal = dealRes.body.deal;

    // currentTurn should now be buyer's ID
    expect(deal.currentTurn).toBe(buyerUserId);
    expect(deal.status).toBe('negotiating');
  });

  // ─── Test 7: Buyer accepts offer ───────────────────────────────────────────

  it('Test 7: Buyer accepts offer and deal status becomes matched', async () => {
    const res = await request(app)
      .post(`/api/deals/${dealId}/accept/${offerId}`)
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
    expect(res.body.status).toBe('accepted');

    // Fetch deal to verify status is now "matched"
    const dealRes = await request(app)
      .get(`/api/deals/${dealId}`)
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(dealRes.status).toBe(200);
    const deal = dealRes.body.deal;

    expect(deal.status).toBe('matched');
  });

  // ─── Test 8: Schedule meetup + confirm + check-in ──────────────────────────

  it('Test 8a: Fetch available slots for event', async () => {
    const now = new Date();
    const dateStr = now.toISOString();

    const res = await request(app)
      .get('/api/meetups/available-slots')
      .set('Authorization', `Bearer ${buyerToken}`)
      .query({
        eventId: eventId,
        date: dateStr,
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('slots');
    expect(Array.isArray(res.body.slots)).toBe(true);

    // Verify each slot is 30 minutes duration
    res.body.slots.forEach((slot: any) => {
      expect(slot).toHaveProperty('startTime');
      expect(slot).toHaveProperty('endTime');

      const start = new Date(slot.startTime);
      const end = new Date(slot.endTime);
      const durationMs = end.getTime() - start.getTime();
      const durationMin = durationMs / (60 * 1000);

      expect(durationMin).toBe(30);
    });
  });

  it('Test 8b: Buyer schedules meetup', async () => {
    // Get available slots
    const now = new Date();
    const dateStr = now.toISOString();

    const slotsRes = await request(app)
      .get('/api/meetups/available-slots')
      .set('Authorization', `Bearer ${buyerToken}`)
      .query({
        eventId: eventId,
        date: dateStr,
      });

    expect(slotsRes.body.slots.length).toBeGreaterThan(0);

    const slot = slotsRes.body.slots[0];
    // Convert ISO dates to HH:MM format for proposedWindowStart/End
    const startIso = new Date(slot.startTime);
    const endIso = new Date(slot.endTime);
    const proposedWindowStart = startIso.toISOString().substring(11, 16); // "HH:MM"
    const proposedWindowEnd = endIso.toISOString().substring(11, 16); // "HH:MM"

    // Buyer creates meetup
    const res = await request(app)
      .post('/api/meetups')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        dealId: dealId,
        eventId: eventId,
        proposedWindowStart: proposedWindowStart,
        proposedWindowEnd: proposedWindowEnd,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.status).toBe('proposed');

    meetupId = res.body.id;
  });

  it('Test 8c: Seller confirms meetup', async () => {
    const res = await request(app)
      .post(`/api/meetups/${meetupId}/confirm`)
      .set('Authorization', `Bearer ${sellerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
  });

  it('Test 8d: Buyer confirms meetup', async () => {
    const res = await request(app)
      .post(`/api/meetups/${meetupId}/confirm`)
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
  });

  it('Test 8e: Verify deal status is "scheduled"', async () => {
    const res = await request(app)
      .get(`/api/deals/${dealId}`)
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(res.status).toBe(200);
    const deal = res.body.deal;

    expect(deal.status).toBe('scheduled');
  });

  it('Test 8f: Buyer checks in to meetup', async () => {
    const res = await request(app)
      .post(`/api/meetups/${meetupId}/checkin`)
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(res.status).toBe(200);
  });

  it('Test 8g: Seller checks in to meetup', async () => {
    const res = await request(app)
      .post(`/api/meetups/${meetupId}/checkin`)
      .set('Authorization', `Bearer ${sellerToken}`);

    expect(res.status).toBe(200);
  });

  it('Test 8h: Verify meetup is completed after both check-ins', async () => {
    // Fetch the meetup to verify it's marked as completed
    // This requires a GET endpoint for meetups or checking through deals
    // For now, we verify through the deal status or by checking the meetup table directly
    const meetup = await db('meetups').where('id', meetupId).first();

    expect(meetup).toBeDefined();
    expect(meetup.status).toBe('completed');
  });
});
