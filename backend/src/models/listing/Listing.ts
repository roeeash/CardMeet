import { Knex } from 'knex';
import { BaseModel } from '../BaseModel';
import { Listing, Game, ListingStatus } from '@shared/types/listing';

export class ListingModel extends BaseModel {
  static tableName = 'listings';

  static async findListingsForUser(
    userId: string,
    filters: {
      games?: Game[];
      locationLat?: number;
      locationLng?: number;
      radiusKm?: number;
      sharedEventsOnly?: boolean;
      minPrice?: number;
      maxPrice?: number;
      condition?: string[];
    } = {}
  ): Promise<Listing[]> {
    let query = this.db(this.tableName)
      .select('listings.*')
      .join('user_profiles', 'listings.seller_id', 'user_profiles.user_id')
      .where('listings.status', 'active')
      .where('listings.seller_id', '!=', userId);

    // Game filter
    if (filters.games && filters.games.length > 0) {
      query = query.whereIn('listings.game', filters.games);
    }

    // Location filter
    if (filters.locationLat && filters.locationLng && filters.radiusKm) {
      query = query.whereRaw(`
        ST_DWithin(
          ST_Point(user_profiles.location_lng, user_profiles.location_lat)::geography,
          ST_Point(?, ?)::geography,
          ?
        )
      `, [filters.locationLng, filters.locationLat, filters.radiusKm * 1000]);
    }

    // Price range
    if (filters.minPrice !== undefined) {
      query = query.where('listings.price_cents', '>=', filters.minPrice * 100);
    }
    if (filters.maxPrice !== undefined) {
      query = query.where('listings.price_cents', '<=', filters.maxPrice * 100);
    }

    // Condition filter
    if (filters.condition && filters.condition.length > 0) {
      query = query.whereIn('listings.condition', filters.condition);
    }

    // Shared events filter
    if (filters.sharedEventsOnly) {
      query = query.whereExists(function() {
        this.select('*')
          .from('events')
          .join('event_rsvps', 'events.id', 'event_rsvps.event_id')
          .whereRaw(`
            ST_DWithin(
              ST_Point(events.location_lng, events.location_lat)::geography,
              ST_Point(user_profiles.location_lng, user_profiles.location_lat)::geography,
              ?
            )
          `, [filters.radiusKm! * 1000])
          .where('event_rsvps.user_id', userId)
          .where('event_rsvps.status', 'going')
          .whereRaw('events.games && ?', [filters.games || ['mtg', 'pokemon', 'yugioh', 'lorcana']])
          .where('events.status', 'active')
          .where('events.start_date', '>=', new Date());
      });
    }

    return query.orderBy('listings.created_at', 'desc');
  }

  static async createListing(listingData: Partial<Listing>): Promise<Listing> {
    const [listing] = await this.db(this.tableName)
      .insert({
        ...listingData,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    
    return listing;
  }

  static async updateListingStatus(
    listingId: string,
    status: ListingStatus
  ): Promise<Listing> {
    const [listing] = await this.db(this.tableName)
      .where('id', listingId)
      .update({
        status,
        updated_at: new Date(),
      })
      .returning('*');
    
    return listing;
  }

  static async getSellerListings(sellerId: string): Promise<Listing[]> {
    return this.db(this.tableName)
      .where('seller_id', sellerId)
      .orderBy('created_at', 'desc');
  }
}
