import { EventModel, EventRSVPModel } from '../models/event/Event';
import { UserProfileModel } from '../models/user/User';
import { RSVPStatus } from '@shared/types/event';

export class EventService {
  static async findEventsForUser(userId: string) {
    const profile = await UserProfileModel.findByUserId(userId);
    if (!profile) {
      throw new Error('User profile not found');
    }

    // Knex returns snake_case from the database
    const dbProfile = profile as any;
    const lat = parseFloat(dbProfile.location_lat || dbProfile.locationLat);
    const lng = parseFloat(dbProfile.location_lng || dbProfile.locationLng);
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      throw new Error('User profile missing location data; please update your profile first');
    }

    const radius = dbProfile.travel_radius_km || dbProfile.travelRadiusKm || 50;
    return EventModel.findNearbyEvents(lat, lng, parseFloat(radius));
  }

  static async findSharedEvents(userId: string, otherUserId: string) {
    return EventModel.findSharedEvents(userId, otherUserId);
  }

  static async createEvent(creatorId: string, data: any) {
    return EventModel.createEvent({ ...data, creator_id: creatorId });
  }

  static async updateRSVP(userId: string, eventId: string, status: RSVPStatus) {
    return EventRSVPModel.setRSVP(userId, eventId, status);
  }

  static async getEventById(eventId: string) {
    const event = await EventModel.findById(eventId);
    if (!event) {
      throw new Error('Event not found');
    }
    return event;
  }
}
