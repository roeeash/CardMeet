import { BaseModel } from '../BaseModel';
import { Deal, DealStatus } from '../../shared/types/deal';

export class DealModel extends BaseModel {
  static tableName = 'deals';

  static async createDeal(dealData: {
    listingId: string;
    buyerId: string;
    sellerId: string;
    initialPriceCents: number;
  }): Promise<Deal> {
    const [deal] = await this.db(this.tableName)
      .insert({
        listing_id: dealData.listingId,
        buyer_id: dealData.buyerId,
        seller_id: dealData.sellerId,
        status: 'negotiating',
        current_price_cents: dealData.initialPriceCents,
        current_turn: dealData.sellerId,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    return deal;
  }

  static async getUserDeals(userId: string): Promise<{
    negotiating: any[];
    matched: any[];
    scheduled: any[];
  }> {
    // Fetch base deal data with listing and counterparty info
    const allDeals = await this.db(this.tableName)
      .select(
        'deals.*',
        'listings.card_name',
        'listings.card_set',
        'listings.condition',
        'listings.price_cents as ask_price_cents',
        'listings.game',
        this.db.raw('CASE WHEN deals.buyer_id = ? THEN seller_profiles.display_name ELSE buyer_profiles.display_name END as counterparty_name', [userId]),
        this.db.raw('CASE WHEN deals.buyer_id = ? THEN seller_profiles.rating ELSE buyer_profiles.rating END as counterparty_rating', [userId]),
        this.db.raw('CASE WHEN deals.buyer_id = ? THEN seller_profiles.completed_deals ELSE buyer_profiles.completed_deals END as counterparty_deals', [userId]),
        this.db.raw('CASE WHEN deals.buyer_id = ? THEN seller_profiles.no_shows ELSE buyer_profiles.no_shows END as counterparty_no_shows', [userId]),
        this.db.raw('CASE WHEN deals.buyer_id = ? THEN \'seller\' ELSE \'buyer\' END as counterparty_role', [userId])
      )
      .join('listings', 'deals.listing_id', 'listings.id')
      .leftJoin('user_profiles as seller_profiles', 'deals.seller_id', 'seller_profiles.user_id')
      .leftJoin('user_profiles as buyer_profiles', 'deals.buyer_id', 'buyer_profiles.user_id')
      .where(function() {
        this.where('deals.buyer_id', userId).orWhere('deals.seller_id', userId);
      })
      .whereNot('deals.status', 'completed')
      .whereNot('deals.status', 'cancelled')
      .orderBy('deals.updated_at', 'desc');

    // For each deal, fetch the offer chain and shared events
    for (const deal of allDeals) {
      // Fetch all offers (active and accepted) for this deal, ordered by creation time
      const offers = await this.db('offers')
        .where('deal_id', deal.id)
        .whereIn('status', ['active', 'accepted', 'withdrawn'])
        .orderBy('created_at', 'asc');

      deal.offerChain = offers.map((o: any) => ({
        id: o.id,
        fromUserId: o.from_user_id,
        priceCents: o.price_cents,
        createdAt: o.created_at,
      }));

      // Fetch shared events: events where both buyer and seller have RSVP'd as 'going' or 'maybe'
      const buyerRsvps = await this.db('event_rsvps')
        .select('event_id')
        .where('user_id', deal.buyer_id)
        .whereIn('status', ['going', 'maybe']);

      const buyerEventIds = buyerRsvps.map((r: any) => r.event_id);

      let sharedEventNames: string[] = [];
      let sharedEventIds: string[] = [];

      if (buyerEventIds.length > 0) {
        // Find events where seller also has RSVP'd to same events
        const sellerRsvpsToSharedEvents = await this.db('event_rsvps')
          .select('events.id', 'events.name')
          .join('events', 'event_rsvps.event_id', 'events.id')
          .where('event_rsvps.user_id', deal.seller_id)
          .whereIn('event_rsvps.event_id', buyerEventIds)
          .whereIn('event_rsvps.status', ['going', 'maybe']);

        sharedEventNames = sellerRsvpsToSharedEvents.map((e: any) => e.name);
        sharedEventIds = sellerRsvpsToSharedEvents.map((e: any) => e.id);
      }

      deal.sharedEventIds = sharedEventIds;
      deal.sharedEventNames = sharedEventNames;
    }

    return {
      negotiating: allDeals.filter(deal => deal.status === 'negotiating'),
      matched: allDeals.filter(deal => deal.status === 'matched'),
      scheduled: allDeals.filter(deal => deal.status === 'scheduled'),
    };
  }

  static async updateDealStatus(
    dealId: string,
    status: DealStatus,
    currentTurn?: string
  ): Promise<Deal> {
    const updateData: any = {
      status,
      updated_at: new Date(),
    };

    if (currentTurn) {
      updateData.current_turn = currentTurn;
    }

    const [deal] = await this.db(this.tableName)
      .where('id', dealId)
      .update(updateData)
      .returning('*');

    return deal;
  }

  static async updateDeal(
    dealId: string,
    updates: {
      currentTurn?: string;
      currentPriceCents?: number;
      status?: DealStatus;
    }
  ): Promise<Deal> {
    const updateData: any = {
      updated_at: new Date(),
    };

    if (updates.currentTurn !== undefined) {
      updateData.current_turn = updates.currentTurn;
    }
    if (updates.currentPriceCents !== undefined) {
      updateData.current_price_cents = updates.currentPriceCents;
    }
    if (updates.status !== undefined) {
      updateData.status = updates.status;
    }

    const [deal] = await this.db(this.tableName)
      .where('id', dealId)
      .update(updateData)
      .returning('*');

    return deal;
  }

  static async getCurrentTurn(dealId: string): Promise<string | null> {
    const deal = await this.db(this.tableName)
      .select('current_turn')
      .where('id', dealId)
      .first();

    return deal?.current_turn || null;
  }

  static async getById(dealId: string): Promise<Deal | null> {
    const deal = await this.db(this.tableName)
      .where('id', dealId)
      .first();

    return deal || null;
  }

  static async getByIdEnriched(dealId: string, userId: string): Promise<any> {
    // Fetch the base deal
    const deal = await this.getById(dealId);
    if (!deal) return null;

    // Validate user is a party
    const buyerId = (deal as any).buyer_id;
    const sellerId = (deal as any).seller_id;
    if (userId !== buyerId && userId !== sellerId) {
      return null; // Unauthorized
    }

    // Fetch listing and card details
    const listing = await this.db('listings')
      .where('id', (deal as any).listing_id)
      .first();

    if (!listing) return null;

    // Fetch counterparty profile
    const counterpartyId = userId === buyerId ? sellerId : buyerId;
    const counterpartyProfile = await this.db('user_profiles')
      .where('user_id', counterpartyId)
      .first();

    // Attach enriched data
    (deal as any).card_name = listing.card_name;
    (deal as any).card_set = listing.card_set;
    (deal as any).condition = listing.condition;
    (deal as any).ask_price_cents = listing.price_cents;
    (deal as any).game = listing.game;
    (deal as any).counterparty_name = counterpartyProfile?.display_name || 'Unknown';
    (deal as any).counterparty_rating = counterpartyProfile?.rating || 0;
    (deal as any).counterparty_deals = counterpartyProfile?.completed_deals || 0;
    (deal as any).counterparty_no_shows = counterpartyProfile?.no_shows || 0;
    (deal as any).counterparty_role = userId === buyerId ? 'seller' : 'buyer';

    // Fetch offer chain
    const offers = await this.db('offers')
      .where('deal_id', dealId)
      .orderBy('created_at', 'asc');

    (deal as any).offerChain = offers.map((o: any) => ({
      id: o.id,
      fromUserId: o.from_user_id,
      priceCents: o.price_cents,
      createdAt: o.created_at,
    }));

    // Fetch shared events
    const buyerRsvps = await this.db('event_rsvps')
      .select('event_id')
      .where('user_id', buyerId)
      .whereIn('status', ['going', 'maybe']);

    const buyerEventIds = buyerRsvps.map((r: any) => r.event_id);
    let sharedEventNames: string[] = [];
    let sharedEventIds: string[] = [];

    if (buyerEventIds.length > 0) {
      const sellerRsvpsToSharedEvents = await this.db('event_rsvps')
        .select('events.id', 'events.name')
        .join('events', 'event_rsvps.event_id', 'events.id')
        .where('event_rsvps.user_id', sellerId)
        .whereIn('event_rsvps.event_id', buyerEventIds)
        .whereIn('event_rsvps.status', ['going', 'maybe']);

      sharedEventNames = sellerRsvpsToSharedEvents.map((e: any) => e.name);
      sharedEventIds = sellerRsvpsToSharedEvents.map((e: any) => e.id);
    }

    (deal as any).sharedEventIds = sharedEventIds;
    (deal as any).sharedEventNames = sharedEventNames;

    // Fetch associated meetup if deal is matched or scheduled
    let meeting = null;
    let proposed = null;
    if ((deal as any).status === 'matched' || (deal as any).status === 'scheduled') {
      const meetup = await this.db('meetups')
        .where('deal_id', dealId)
        .where('status', '!=', 'cancelled')
        .orderBy('created_at', 'desc')
        .first();

      if (meetup) {
        const meetupObj = {
          id: meetup.id,
          startTime: meetup.start_time,
          endTime: meetup.end_time,
          eventId: meetup.event_id,
          locationNote: meetup.location_note,
          buyerConfirmed: meetup.buyer_confirmed || false,
          sellerConfirmed: meetup.seller_confirmed || false,
          buyerCheckedIn: meetup.buyer_checked_in || false,
          sellerCheckedIn: meetup.seller_checked_in || false,
          buyerCheckedInAt: meetup.buyer_checked_in_at,
          sellerCheckedInAt: meetup.seller_checked_in_at,
        };

        // If both parties have confirmed, it's a confirmed meeting
        // Otherwise, it's a proposed window waiting for confirmation
        if ((meetup.buyer_confirmed && meetup.seller_confirmed) || (deal as any).status === 'scheduled') {
          meeting = meetupObj;
        } else {
          // Meetup exists but not both confirmed: populate 'proposed' instead
          proposed = {
            id: meetup.id,
            startTime: meetup.start_time,
            endTime: meetup.end_time,
            locationNote: meetup.location_note,
          };
        }
      }
    }

    (deal as any).meeting = meeting;
    (deal as any).proposed = proposed;

    return deal;
  }
}
