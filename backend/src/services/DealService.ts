import { DealModel } from '../models/deal/Deal';
import { OfferModel } from '../models/deal/Offer';
import { ListingModel } from '../models/listing/Listing';
import { EventModel } from '../models/event/Event';

export class DealService {
  static async createDeal(buyerId: string, listingId: string, initialOfferCents: number) {
    // Get listing by ID
    const listing = await ListingModel.findById(listingId);

    // Validate listing exists
    if (!listing) throw new Error('Listing not found');

    // Validate listing is active
    if (listing.status !== 'active') throw new Error('Listing is not active');

    // Validate buyer and seller are different
    if (listing.seller_id === buyerId) throw new Error('Cannot create deal: buyer and seller are the same');

    // VALIDATE: Check that buyer and seller have at least one shared RSVP'd event
    const sellerId = listing.seller_id;
    const sharedEvents = await EventModel.findSharedEvents(buyerId, sellerId);

    if (sharedEvents.length === 0) {
      throw new Error('No shared events between buyer and seller');
    }

    const deal = await DealModel.createDeal({
      listingId,
      buyerId,
      sellerId: listing.seller_id,
      initialPriceCents: initialOfferCents,
    });
    await OfferModel.createOffer({ dealId: deal.id, fromUserId: buyerId, priceCents: initialOfferCents });
    return deal;
  }

  static async getUserDeals(userId: string) {
    return DealModel.getUserDeals(userId);
  }

  static async makeOffer(dealId: string, fromUserId: string, priceCents: number, note?: string) {
    // Validate price is positive
    if (priceCents <= 0) {
      throw new Error('Price must be greater than 0');
    }

    // Fetch full deal
    const deal = await DealModel.getById(dealId);

    // Validate deal exists
    if (!deal) {
      throw new Error('Deal not found');
    }

    // Validate deal status is 'negotiating'
    if ((deal as any).status !== 'negotiating') {
      throw new Error('Deal is not in negotiating status');
    }

    // Validate fromUserId is one of the parties (accessing snake_case fields from DB)
    const buyerId = (deal as any).buyer_id;
    const sellerId = (deal as any).seller_id;
    if (fromUserId !== buyerId && fromUserId !== sellerId) {
      throw new Error('User is not a party to this deal');
    }

    // Create the offer
    const offer = await OfferModel.createOffer({ dealId, fromUserId, priceCents, note });

    // Determine the other party (flip turn)
    let otherPartyId: string;
    if (fromUserId === buyerId) {
      otherPartyId = sellerId;
    } else {
      otherPartyId = buyerId;
    }

    // Update deal: set current_turn to other party AND current_price_cents to new price
    await DealModel.updateDeal(dealId, {
      currentTurn: otherPartyId,
      currentPriceCents: priceCents,
    });

    return offer;
  }

  static async acceptOffer(offerId: string, userId: string) {
    // Fetch the offer
    const offer = await OfferModel.getById(offerId);
    if (!offer) throw new Error('Offer not found');

    // Fetch the deal to validate user is a party
    const deal = await DealModel.getById((offer as any).deal_id);
    if (!deal) throw new Error('Deal not found');

    const buyerId = (deal as any).buyer_id;
    const sellerId = (deal as any).seller_id;
    if (userId !== buyerId && userId !== sellerId) {
      throw new Error('Unauthorized: user is not a party to this deal');
    }

    // Validate that the user accepting is NOT the one who made the offer
    if ((offer as any).from_user_id === userId) {
      throw new Error('Cannot accept your own offer');
    }

    // Accept the offer
    const acceptedOffer = await OfferModel.acceptOffer(offerId);
    await DealModel.updateDealStatus((offer as any).deal_id, 'matched');
    return acceptedOffer;
  }

  static async withdrawDeal(dealId: string, userId: string) {
    // Fetch the deal
    const deal = await DealModel.getById(dealId);
    if (!deal) throw new Error('Deal not found');

    // Validate user is a party to this deal
    const buyerId = (deal as any).buyer_id;
    const sellerId = (deal as any).seller_id;
    if (userId !== buyerId && userId !== sellerId) {
      throw new Error('Unauthorized: user is not a party to this deal');
    }

    return DealModel.updateDealStatus(dealId, 'cancelled');
  }

  static async getDealById(dealId: string, userId: string) {
    const deal = await DealModel.getByIdEnriched(dealId, userId);
    if (!deal) throw new Error('Deal not found or unauthorized');
    return deal;
  }
}
