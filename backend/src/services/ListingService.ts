import { ListingModel } from '@models/listing/Listing';
import { UserProfileModel } from '@models/user/User';
import { EventService } from '@services/EventService';
import { ListingStatus } from '@shared/types/listing';
import { parseLatitude, parseLongitude, parseRadiusKm } from '@utils/validation';

export class ListingService {
  static async getListings(userId: string, filters: any = {}) {
    // Fetch user's profile to get their default location and radius
    const profile = await UserProfileModel.findByUserId(userId);
    if (!profile) {
      throw new Error('User profile not found');
    }

    // Merge user's defaults with query params, with query params taking precedence
    const mergedFilters: any = {
      games: filters.games,
      sharedEventsOnly: filters.sharedEventsOnly === 'true' || filters.sharedEventsOnly === true,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      condition: filters.condition,
    };

    // Parse location params; use profile defaults if not provided
    const dbProfile = profile as any;
    try {
      mergedFilters.locationLat = filters.locationLat
        ? parseLatitude(filters.locationLat)
        : parseFloat(dbProfile.location_lat || dbProfile.locationLat);
      mergedFilters.locationLng = filters.locationLng
        ? parseLongitude(filters.locationLng)
        : parseFloat(dbProfile.location_lng || dbProfile.locationLng);
      mergedFilters.radiusKm = filters.radiusKm
        ? parseRadiusKm(filters.radiusKm)
        : parseFloat(dbProfile.travel_radius_km || dbProfile.travelRadiusKm || 50);
    } catch (error) {
      throw new Error(`Invalid location parameters: ${(error as Error).message}`);
    }

    // Validate that we have location data
    if (!mergedFilters.locationLat || !mergedFilters.locationLng || isNaN(mergedFilters.locationLat) || isNaN(mergedFilters.locationLng)) {
      throw new Error('User profile missing location data; please update your profile first');
    }

    const listings = await ListingModel.findListingsForUser(userId, mergedFilters);

    // Enrich each listing with sharedEvents and seller profile fields
    const enrichedListings = await Promise.all(
      listings.map(async (listing: any) => {
        try {
          const sharedEvents = await EventService.findSharedEvents(userId, listing.seller_id);
          return {
            ...listing,
            sharedEvents: sharedEvents || [],
          };
        } catch (error) {
          // If shared events lookup fails, continue with empty array
          return {
            ...listing,
            sharedEvents: [],
          };
        }
      })
    );

    return enrichedListings;
  }

  static async getListingById(id: string) {
    return ListingModel.findById(id);
  }

  static async createListing(sellerId: string, data: any) {
    return ListingModel.createListing({ ...data, seller_id: sellerId, status: 'active' });
  }

  static async updateListingStatus(listingId: string, _sellerId: string, status: ListingStatus) {
    return ListingModel.updateListingStatus(listingId, status);
  }
}
