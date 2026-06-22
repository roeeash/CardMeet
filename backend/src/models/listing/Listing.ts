import { BaseModel } from '../BaseModel';
import { Listing, ListingStatus } from '../../../../shared/types/listing';
import { Game } from '../../../../shared/types/user';

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
      .select(
        'listings.*',
        'user_profiles.display_name as seller_name',
        'user_profiles.rating as seller_rating',
        'user_profiles.completed_deals as seller_deals',
        'user_profiles.no_shows as seller_no_shows'
      )
      .join('user_profiles', 'listings.seller_id', 'user_profiles.user_id')
      .where('listings.status', 'active')
      .where('listings.seller_id', '!=', userId);

    // Game filter
    if (filters.games && filters.games.length > 0) {
      query = query.whereIn('listings.game', filters.games);
    }

    // Location filter
    if (filters.locationLat && filters.locationLng && filters.radiusKm) {
      // MVP: Use simple lat/lng range checks instead of PostGIS
      // Phase 3 will implement precise geographic distance calculations
      const latDelta = filters.radiusKm / 111; // Approx km per degree latitude
      const lngDelta = filters.radiusKm / (111 * Math.cos(filters.locationLat * Math.PI / 180)); // Approx km per degree longitude

      query = query
        .where('user_profiles.location_lat', '>=', filters.locationLat - latDelta)
        .where('user_profiles.location_lat', '<=', filters.locationLat + latDelta)
        .where('user_profiles.location_lng', '>=', filters.locationLng - lngDelta)
        .where('user_profiles.location_lng', '<=', filters.locationLng + lngDelta);
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
        // MVP: Use simple lat/lng range checks instead of PostGIS for location matching
        // Phase 3 will implement precise geographic distance calculations
        const latDelta = filters.radiusKm! / 111; // Approx km per degree latitude
        const lngDelta = filters.radiusKm! / (111 * Math.cos(filters.locationLat! * Math.PI / 180)); // Approx km per degree longitude

        this.select('*')
          .from('events')
          .join('event_rsvps', 'events.id', 'event_rsvps.event_id')
          .where('events.location_lat', '>=', filters.locationLat! - latDelta)
          .where('events.location_lat', '<=', filters.locationLat! + latDelta)
          .where('events.location_lng', '>=', filters.locationLng! - lngDelta)
          .where('events.location_lng', '<=', filters.locationLng! + lngDelta)
          .where('event_rsvps.user_id', userId)
          .where('event_rsvps.status', 'going')
          .whereRaw('events.games && ?', [filters.games || ['mtg', 'pokemon', 'yugioh', 'lorcana']])
          .where('events.status', 'active')
          .where('events.start_date', '>=', new Date());
      });
    }

    return query.orderBy('listings.created_at', 'desc');
  }

  static async findById(id: string): Promise<Listing | null> {
    return this.db(this.tableName).where('id', id).first();
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
