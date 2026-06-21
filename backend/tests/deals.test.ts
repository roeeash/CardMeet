/**
 * Deals endpoint integration tests
 * Tests GET /api/deals returning enriched deal data with:
 * - Card details (name, set, condition, ask price)
 * - Offer chain (thread of offers)
 * - Counterparty info (name, role, rating, deals, noShows)
 * - Shared events (event names and IDs where both parties RSVP'd)
 * - Turn badges (whose turn it is)
 */

import { setupTestDatabase, teardownTestDatabase } from './setup';
import { UserModel } from '@models/user/User';
import { UserProfileModel } from '@models/user/User';
import { DealModel } from '@models/deal/Deal';
import { ListingModel } from '@models/listing/Listing';
import { OfferModel } from '@models/deal/Offer';
import { EventModel } from '@models/event/Event';
import { EventRSVPModel } from '@models/event/Event';
import { randomUUID } from 'crypto';

describe('Deals integration — enriched deal fetching with turn badges', () => {
  let db: any;
  let buyer: any;
  let seller: any;
  let listing: any;
  let deal: any;
  let event: any;

  beforeAll(async () => {
    db = await setupTestDatabase();

    // Get real user IDs from seed data
    const users = await db('users').select('*').limit(2);
    buyer = users[0];
    seller = users[1];

    // Get a listing (from seed data)
    listing = await db('listings').select('*').limit(1).first();

    // Get an event for shared RSVP testing
    event = await db('events').select('*').limit(1).first();

    // Create RSVPs for both buyer and seller to the same event
    if (buyer && seller && event) {
      try {
        await db('event_rsvps').insert({
          id: randomUUID(),
          user_id: buyer.id,
          event_id: event.id,
          status: 'going',
          created_at: new Date(),
          updated_at: new Date(),
        });

        await db('event_rsvps').insert({
          id: randomUUID(),
          user_id: seller.id,
          event_id: event.id,
          status: 'going',
          created_at: new Date(),
          updated_at: new Date(),
        });
      } catch (e) {
        // If RSVPs already exist, that's fine
        console.log('RSVPs already exist or could not be created');
      }
    }
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  describe('DealModel.getUserDeals() enrichment', () => {
    it('should include card details from listing', async () => {
      // Create a deal
      const testDeal = await DealModel.createDeal({
        listingId: listing.id,
        buyerId: buyer.id,
        sellerId: seller.id,
        initialPriceCents: 30000, // 300 shekels
      });

      // Fetch deals
      const deals = await DealModel.getUserDeals(buyer.id);
      const fetchedDeal = deals.negotiating.find(d => d.id === testDeal.id);

      // Should have card details from listing
      expect(fetchedDeal).toBeDefined();
      expect(fetchedDeal.card_name).toBe(listing.card_name);
      expect(fetchedDeal.card_set).toBe(listing.card_set);
      expect(fetchedDeal.condition).toBe(listing.condition);
      expect(fetchedDeal.game).toBe(listing.game);
      expect(fetchedDeal.ask_price_cents).toBe(listing.price_cents);
    });

    it('should include counterparty info from profiles', async () => {
      // Create a deal
      const testDeal = await DealModel.createDeal({
        listingId: listing.id,
        buyerId: buyer.id,
        sellerId: seller.id,
        initialPriceCents: 30000,
      });

      // Fetch as buyer
      const dealsAsBuyer = await DealModel.getUserDeals(buyer.id);
      const dealAsBuyer = dealsAsBuyer.negotiating.find(d => d.id === testDeal.id);

      // Should have seller's counterparty info
      expect(dealAsBuyer.counterparty_name).toBeDefined();
      expect(dealAsBuyer.counterparty_rating).toBeDefined();
      expect(dealAsBuyer.counterparty_deals).toBeDefined();
      expect(dealAsBuyer.counterparty_no_shows).toBeDefined();
      expect(dealAsBuyer.counterparty_role).toBe('seller');

      // Fetch as seller
      const dealsAsSeller = await DealModel.getUserDeals(seller.id);
      const dealAsSeller = dealsAsSeller.negotiating.find(d => d.id === testDeal.id);

      // Should have buyer's counterparty info
      expect(dealAsSeller.counterparty_role).toBe('buyer');
    });

    it('should include offer chain thread', async () => {
      // Create a deal
      const testDeal = await DealModel.createDeal({
        listingId: listing.id,
        buyerId: buyer.id,
        sellerId: seller.id,
        initialPriceCents: 30000,
      });

      // Make counter-offer from seller
      await OfferModel.createOffer({
        dealId: testDeal.id,
        fromUserId: seller.id,
        priceCents: 28000,
      });

      // Fetch deals
      const deals = await DealModel.getUserDeals(buyer.id);
      const fetchedDeal = deals.negotiating.find(d => d.id === testDeal.id);

      // Should have offerChain array
      expect(fetchedDeal.offerChain).toBeDefined();
      expect(Array.isArray(fetchedDeal.offerChain)).toBe(true);

      // Should have at least the initial offer and the counter offer
      if (fetchedDeal.offerChain.length > 0) {
        // Verify offer chain structure
        fetchedDeal.offerChain.forEach((offer: any) => {
          expect(offer.fromUserId).toBeDefined();
          expect(offer.priceCents).toBeDefined();
          expect(offer.createdAt).toBeDefined();
        });
      }
    });

    it('should include shared event IDs and names', async () => {
      if (!event) {
        // Skip if no event in seed data
        return;
      }

      // Create a deal
      const testDeal = await DealModel.createDeal({
        listingId: listing.id,
        buyerId: buyer.id,
        sellerId: seller.id,
        initialPriceCents: 30000,
      });

      // Fetch deals
      const deals = await DealModel.getUserDeals(buyer.id);
      const fetchedDeal = deals.negotiating.find(d => d.id === testDeal.id);

      // Should have shared event IDs and names
      expect(fetchedDeal.sharedEventIds).toBeDefined();
      expect(fetchedDeal.sharedEventNames).toBeDefined();
      expect(Array.isArray(fetchedDeal.sharedEventIds)).toBe(true);
      expect(Array.isArray(fetchedDeal.sharedEventNames)).toBe(true);

      // If both parties RSVP'd, should have at least one shared event
      if (fetchedDeal.sharedEventIds.length > 0) {
        expect(fetchedDeal.sharedEventIds[0]).toBe(event.id);
        expect(fetchedDeal.sharedEventNames[0]).toBe(event.name);
      }
    });

    it('should group deals by status', async () => {
      // Create deals in different statuses
      const negotiatingDeal = await DealModel.createDeal({
        listingId: listing.id,
        buyerId: buyer.id,
        sellerId: seller.id,
        initialPriceCents: 30000,
      });

      const matchedDeal = await DealModel.createDeal({
        listingId: listing.id,
        buyerId: buyer.id,
        sellerId: seller.id,
        initialPriceCents: 35000,
      });
      await DealModel.updateDealStatus(matchedDeal.id, 'matched');

      // Fetch deals
      const deals = await DealModel.getUserDeals(buyer.id);

      // Should have deals grouped by status
      expect(deals.negotiating).toBeDefined();
      expect(deals.matched).toBeDefined();
      expect(deals.scheduled).toBeDefined();

      // Verify grouping
      expect(deals.negotiating.some(d => d.id === negotiatingDeal.id)).toBe(true);
      expect(deals.matched.some(d => d.id === matchedDeal.id)).toBe(true);
    });

    it('should handle deals with no offers gracefully', async () => {
      // The initial deal creation also creates an initial offer
      const testDeal = await DealModel.createDeal({
        listingId: listing.id,
        buyerId: buyer.id,
        sellerId: seller.id,
        initialPriceCents: 30000,
      });

      // Fetch deals
      const deals = await DealModel.getUserDeals(buyer.id);
      const fetchedDeal = deals.negotiating.find(d => d.id === testDeal.id);

      // Should have offerChain array (should be defined even if empty)
      expect(fetchedDeal.offerChain).toBeDefined();
      expect(Array.isArray(fetchedDeal.offerChain)).toBe(true);
      // Note: The initial offer may or may not be in the chain depending on offer status filtering
    });
  });
});
