/**
 * DTO Mappers: Convert snake_case DB fields to camelCase API response format.
 *
 * Key transformations:
 * - snake_case → camelCase field names
 * - price_cents (integer) → price (whole shekels): divide by 100
 * - Timestamps remain as ISO 8601 Date objects (serialized to strings by JSON.stringify)
 */

import { User, UserProfile } from '@shared/types/user';
import { Deal } from '@shared/types/deal';
import { Offer } from '@shared/types/offer';
import { Event, EventRSVP } from '@shared/types/event';
import { Meetup } from '@shared/types/meetup';

/**
 * Convert a User from DB (snake_case) to API response (camelCase)
 */
export function userToDTO(user: any): Omit<User, 'password_hash'> {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

/**
 * Convert a UserProfile from DB (snake_case) to API response (camelCase)
 */
export function profileToDTO(profile: any): UserProfile {
  return {
    userId: profile.user_id,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url,
    locationLat: profile.location_lat,
    locationLng: profile.location_lng,
    travelRadiusKm: profile.travel_radius_km,
    games: profile.games || [],
    rating: profile.rating || 0,
    completedDeals: profile.completed_deals || 0,
    noShows: profile.no_shows || 0,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  };
}

/**
 * Convert a Listing from DB (snake_case + price_cents) to API response (camelCase + price)
 */
export function listingToDTO(listing: any, sharedEvents?: any[]): any {
  return {
    id: listing.id,
    sellerId: listing.seller_id,
    cardName: listing.card_name,
    cardSet: listing.card_set,
    condition: listing.condition,
    price: Math.round(listing.price_cents / 100), // Convert cents to whole shekels
    currency: listing.currency || 'ILS',
    imageUrl: listing.image_url,
    description: listing.description,
    game: listing.game,
    status: listing.status,
    sellerName: listing.seller_name,
    sellerRating: listing.seller_rating,
    sellerDeals: listing.seller_deals,
    sellerNoShows: listing.seller_no_shows,
    sharedEvents: sharedEvents ? sharedEvents.map(eventToDTO) : (listing.sharedEvents ? listing.sharedEvents.map(eventToDTO) : []),
    createdAt: listing.created_at,
    updatedAt: listing.updated_at,
  };
}

/**
 * Convert multiple listings at once
 */
export function listingsToDTO(listings: any[]): any[] {
  return listings.map(listing => listingToDTO(listing, listing.sharedEvents));
}

/**
 * Convert a Deal from DB (snake_case + price_cents) to API response (camelCase + price)
 * Includes enriched fields: card details, offer chain, counterparty info, shared events, and meeting
 */
export function dealToDTO(deal: any): any {
  return {
    id: deal.id,
    listingId: deal.listing_id,
    buyerId: deal.buyer_id,
    sellerId: deal.seller_id,
    status: deal.status,
    currentPriceCents: deal.current_price_cents,
    currentPrice: Math.round((deal.current_price_cents || 0) / 100), // in whole shekels
    currentTurn: deal.current_turn,
    // Enriched fields from join
    cardName: deal.card_name,
    cardSet: deal.card_set,
    condition: deal.condition,
    game: deal.game,
    askPriceCents: deal.ask_price_cents,
    askPrice: Math.round((deal.ask_price_cents || 0) / 100), // in whole shekels
    // Counterparty info
    counterpartyName: deal.counterparty_name || 'Unknown',
    counterpartyRating: deal.counterparty_rating || 0,
    counterpartyDeals: deal.counterparty_deals || 0,
    counterpartyNoShows: deal.counterparty_no_shows || 0,
    counterpartyRole: deal.counterparty_role || 'seller',
    // Offer chain
    offerChain: deal.offerChain || [],
    // Shared events
    sharedEventIds: deal.sharedEventIds || [],
    sharedEventNames: deal.sharedEventNames || [],
    // Proposed and meeting (Phase 3.8)
    proposed: deal.proposed ? {
      id: deal.proposed.id,
      startTime: deal.proposed.startTime,
      endTime: deal.proposed.endTime,
      locationNote: deal.proposed.locationNote,
    } : null,
    meeting: deal.meeting || null,
    createdAt: deal.created_at,
    updatedAt: deal.updated_at,
  };
}

/**
 * Convert multiple deals at once
 */
export function dealsToDTO(deals: any[]): Deal[] {
  return deals.map(dealToDTO);
}

/**
 * Convert a full deal response (with negotiating/matched/scheduled grouping)
 * Enriched with card details, offer chains, counterparty info, shared events
 */
export function dealGroupToDTO(dealGroup: { negotiating: any[]; matched: any[]; scheduled: any[] }) {
  return {
    negotiating: dealGroup.negotiating.map(dealToDTO),
    matched: dealGroup.matched.map(dealToDTO),
    scheduled: dealGroup.scheduled.map(dealToDTO),
  };
}

/**
 * Convert an Offer from DB (snake_case + price_cents) to API response (camelCase + price)
 */
export function offerToDTO(offer: any): any {
  return {
    id: offer.id,
    dealId: offer.deal_id,
    fromUserId: offer.from_user_id,
    price: Math.round(offer.price_cents / 100), // Convert cents to whole shekels
    priceCents: offer.price_cents,
    note: offer.note,
    status: offer.status,
    createdAt: offer.created_at,
    updatedAt: offer.updated_at,
  };
}

/**
 * Convert multiple offers at once
 */
export function offersToDTO(offers: any[]): Offer[] {
  return offers.map(offerToDTO);
}

/**
 * Convert an Event from DB (snake_case) to API response (camelCase)
 */
export function eventToDTO(event: any): Event {
  return {
    id: event.id,
    name: event.name,
    description: event.description,
    locationName: event.location_name,
    locationLat: event.location_lat,
    locationLng: event.location_lng,
    startDate: event.start_date,
    endDate: event.end_date,
    games: event.games || [],
    eventType: event.event_type,
    status: event.status,
    createdBy: event.created_by,
    createdAt: event.created_at,
    updatedAt: event.updated_at,
  };
}

/**
 * Convert multiple events at once
 */
export function eventsToDTO(events: any[]): Event[] {
  return events.map(eventToDTO);
}

/**
 * Convert an EventRSVP from DB (snake_case) to API response (camelCase)
 */
export function eventRsvpToDTO(rsvp: any): EventRSVP {
  return {
    id: rsvp.id,
    userId: rsvp.user_id,
    eventId: rsvp.event_id,
    status: rsvp.status,
    createdAt: rsvp.created_at,
    updatedAt: rsvp.updated_at,
  };
}

/**
 * Convert multiple EventRSVPs at once
 */
export function eventRsvpsToDTO(rsvps: any[]): EventRSVP[] {
  return rsvps.map(eventRsvpToDTO);
}

/**
 * Convert a Meetup from DB (snake_case) to API response (camelCase)
 */
export function meetupToDTO(meetup: any): Meetup {
  return {
    id: meetup.id,
    dealId: meetup.deal_id,
    eventId: meetup.event_id,
    startTime: meetup.start_time,
    endTime: meetup.end_time,
    locationNote: meetup.location_note,
    status: meetup.status,
    buyerConfirmed: meetup.buyer_confirmed || false,
    sellerConfirmed: meetup.seller_confirmed || false,
    buyerCheckedIn: meetup.buyer_checked_in || false,
    sellerCheckedIn: meetup.seller_checked_in || false,
    buyerCheckedInAt: meetup.buyer_checked_in_at || null,
    sellerCheckedInAt: meetup.seller_checked_in_at || null,
    createdAt: meetup.created_at,
    updatedAt: meetup.updated_at,
  };
}

/**
 * Convert multiple meetups at once
 */
export function meetupsToDTO(meetups: any[]): Meetup[] {
  return meetups.map(meetupToDTO);
}

/**
 * Convert an auth response (user + tokens)
 */
export function authResponseToDTO(user: any, tokens: { accessToken: string; refreshToken: string }) {
  return {
    user: userToDTO(user),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}

/**
 * Convert a profile response (user + profile)
 */
export function profileResponseToDTO(user: any, profile: any) {
  return {
    user: userToDTO(user),
    profile: profileToDTO(profile),
  };
}
