import { BaseModel } from '../BaseModel';
import { Event, EventRSVP, RSVPStatus } from '../../../../shared/types/event';

export class EventModel extends BaseModel {
  static tableName = 'events';

  static async findById(id: string): Promise<Event | null> {
    const event = await this.db(this.tableName)
      .select('*')
      .where('id', id)
      .first();

    return event || null;
  }

  static async findNearbyEvents(
    userLat: number,
    userLng: number,
    radiusKm: number,
    games: string[] = [],
    startDate?: Date,
    endDate?: Date
  ): Promise<Event[]> {
    // MVP: Use simple lat/lng range checks instead of PostGIS
    // Phase 3 will implement precise geographic distance calculations
    const latDelta = radiusKm / 111; // Approx km per degree latitude
    const lngDelta = radiusKm / (111 * Math.cos(userLat * Math.PI / 180)); // Approx km per degree longitude

    let query = this.db(this.tableName)
      .select('*')
      .where('status', 'active')
      .where('location_lat', '>=', userLat - latDelta)
      .where('location_lat', '<=', userLat + latDelta)
      .where('location_lng', '>=', userLng - lngDelta)
      .where('location_lng', '<=', userLng + lngDelta);

    if (games.length > 0) {
      query.whereRaw('games && ?', [games]);
    }

    if (startDate) {
      query = query.where('start_date', '>=', startDate);
    }

    if (endDate) {
      query = query.where('end_date', '<=', endDate);
    }

    return query.orderBy('start_date', 'asc');
  }

  static async findByGameAndLocation(
    games: string[],
    userLat: number,
    userLng: number,
    radiusKm: number
  ): Promise<Event[]> {
    // MVP: Use simple lat/lng range checks instead of PostGIS
    // Phase 3 will implement precise geographic distance calculations
    const latDelta = radiusKm / 111; // Approx km per degree latitude
    const lngDelta = radiusKm / (111 * Math.cos(userLat * Math.PI / 180)); // Approx km per degree longitude

    return this.db(this.tableName)
      .select('*')
      .where('status', 'active')
      .whereRaw('games && ?', [games])
      .where('location_lat', '>=', userLat - latDelta)
      .where('location_lat', '<=', userLat + latDelta)
      .where('location_lng', '>=', userLng - lngDelta)
      .where('location_lng', '<=', userLng + lngDelta)
      .orderBy('start_date', 'asc');
  }

  static async createEvent(eventData: Partial<Event>): Promise<Event> {
    const [event] = await this.db(this.tableName)
      .insert({
        ...eventData,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    
    return event;
  }

  static async findSharedEvents(
    user1Id: string,
    user2Id: string
  ): Promise<Event[]> {
    const db = this.db;
    return db(this.tableName)
      .select('events.*')
      .join('event_rsvps as rsvp1', function() {
        this.on('events.id', '=', 'rsvp1.event_id')
          .andOn('rsvp1.user_id', '=', db.raw('?', [user1Id]))
          .andOn('rsvp1.status', '=', db.raw('?', ['going']));
      })
      .join('event_rsvps as rsvp2', function() {
        this.on('events.id', '=', 'rsvp2.event_id')
          .andOn('rsvp2.user_id', '=', db.raw('?', [user2Id]))
          .andOn('rsvp2.status', '=', db.raw('?', ['going']));
      })
      .where('events.status', 'active')
      .where('events.start_date', '>=', new Date());
  }
}

export class EventRSVPModel extends BaseModel {
  static tableName = 'event_rsvps';

  static async getUserRSVPs(userId: string): Promise<EventRSVP[]> {
    return this.db(this.tableName)
      .select('event_rsvps.*', 'events.*')
      .join('events', 'event_rsvps.event_id', 'events.id')
      .where('event_rsvps.user_id', userId)
      .orderBy('events.start_date', 'asc');
  }

  static async setRSVP(
    userId: string,
    eventId: string,
    status: RSVPStatus
  ): Promise<EventRSVP> {
    const [rsvp] = await this.db(this.tableName)
      .insert({
        user_id: userId,
        event_id: eventId,
        status,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .onConflict(['user_id', 'event_id'])
      .merge({
        status,
        updated_at: new Date(),
      })
      .returning('*');
    
    return rsvp;
  }

  static async getEventAttendees(eventId: string): Promise<EventRSVP[]> {
    return this.db(this.tableName)
      .select('event_rsvps.*', 'user_profiles.*')
      .join('user_profiles', 'event_rsvps.user_id', 'user_profiles.user_id')
      .where('event_rsvps.event_id', eventId)
      .where('event_rsvps.status', 'going');
  }
}
