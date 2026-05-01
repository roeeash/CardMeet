import { Knex } from 'knex';
import { BaseModel } from '../BaseModel';
import { Meetup, MeetupStatus } from '@shared/types/meetup';

export class MeetupModel extends BaseModel {
  static tableName = 'meetups';

  static async createMeetup(meetupData: {
    dealId: string;
    eventId: string;
    startTime: Date;
    endTime: Date;
    locationNote?: string;
  }): Promise<Meetup> {
    const [meetup] = await this.db(this.tableName)
      .insert({
        deal_id: meetupData.dealId,
        event_id: meetupData.eventId,
        start_time: meetupData.startTime,
        end_time: meetupData.endTime,
        location_note: meetupData.locationNote,
        status: 'scheduled',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    
    return meetup;
  }

  static async confirmMeetup(meetupId: string, userId: string, isBuyer: boolean): Promise<Meetup> {
    const updateField = isBuyer ? 'buyer_confirmed' : 'seller_confirmed';
    
    const [meetup] = await this.db(this.tableName)
      .where('id', meetupId)
      .update({
        [updateField]: true,
        updated_at: new Date(),
      })
      .returning('*');
    
    return meetup;
  }

  static async completeMeetup(meetupId: string, status: MeetupStatus): Promise<Meetup> {
    const [meetup] = await this.db(this.tableName)
      .where('id', meetupId)
      .update({
        status,
        updated_at: new Date(),
      })
      .returning('*');
    
    return meetup;
  }

  static async getUserMeetups(userId: string): Promise<Meetup[]> {
    return this.db(this.tableName)
      .select('meetups.*', 'deals.buyer_id', 'deals.seller_id', 'events.name as event_name')
      .join('deals', 'meetups.deal_id', 'deals.id')
      .join('events', 'meetups.event_id', 'events.id')
      .where(function() {
        this.where('deals.buyer_id', userId).orWhere('deals.seller_id', userId);
      })
      .where('meetups.status', 'scheduled')
      .orderBy('meetups.start_time', 'asc');
  }

  static async findAvailableSlots(
    eventId: string,
    date: Date,
    durationMinutes: number = 30
  ): Promise<{ startTime: Date; endTime: Date }[]> {
    // Get existing meetups for this event on this date
    const existingMeetups = await this.db(this.tableName)
      .select('start_time', 'end_time')
      .where('event_id', eventId)
      .where('status', 'scheduled')
      .whereRaw('DATE(start_time) = ?', [date.toISOString().split('T')[0]])
      .orderBy('start_time', 'asc');

    // Generate available slots (9:00 AM to 9:00 PM)
    const availableSlots: { startTime: Date; endTime: Date }[] = [];
    const startOfDay = new Date(date);
    startOfDay.setHours(9, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(21, 0, 0, 0);

    let currentTime = new Date(startOfDay);
    
    while (currentTime.getTime() + durationMinutes * 60 * 1000 <= endOfDay.getTime()) {
      const slotEnd = new Date(currentTime.getTime() + durationMinutes * 60 * 1000);
      
      // Check if this slot conflicts with existing meetups
      const hasConflict = existingMeetups.some(meetup => {
        const meetupStart = new Date(meetup.start_time);
        const meetupEnd = new Date(meetup.end_time);
        
        return (
          (currentTime >= meetupStart && currentTime < meetupEnd) ||
          (slotEnd > meetupStart && slotEnd <= meetupEnd) ||
          (currentTime <= meetupStart && slotEnd >= meetupEnd)
        );
      });

      if (!hasConflict) {
        availableSlots.push({
          startTime: new Date(currentTime),
          endTime: new Date(slotEnd)
        });
      }

      currentTime = new Date(currentTime.getTime() + durationMinutes * 60 * 1000);
    }

    return availableSlots;
  }
}
