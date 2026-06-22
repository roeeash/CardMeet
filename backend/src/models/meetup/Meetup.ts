import { BaseModel } from '../BaseModel';
import { Meetup, MeetupStatus } from '../../../../shared/types/meetup';

export class MeetupModel extends BaseModel {
  static tableName = 'meetups';

  static async createMeetup(meetupData: {
    dealId: string;
    eventId: string;
    startTime?: Date;
    endTime?: Date;
    proposedWindowStart?: string;
    proposedWindowEnd?: string;
    locationNote?: string;
  }): Promise<Meetup> {
    const [meetup] = await this.db(this.tableName)
      .insert({
        deal_id: meetupData.dealId,
        event_id: meetupData.eventId,
        start_time: meetupData.startTime || null,
        end_time: meetupData.endTime || null,
        proposed_window_start: meetupData.proposedWindowStart || null,
        proposed_window_end: meetupData.proposedWindowEnd || null,
        location_note: meetupData.locationNote,
        status: 'proposed',
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

  static async recordCheckIn(meetupId: string, isBuyer: boolean): Promise<Meetup> {
    const checkInField = isBuyer ? 'buyer_checked_in' : 'seller_checked_in';
    const checkInAtField = isBuyer ? 'buyer_checked_in_at' : 'seller_checked_in_at';

    const [meetup] = await this.db(this.tableName)
      .where('id', meetupId)
      .update({
        [checkInField]: true,
        [checkInAtField]: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    return meetup;
  }

  static async checkAndCompleteMeetup(meetupId: string): Promise<Meetup | null> {
    const meetup = await this.db(this.tableName)
      .where('id', meetupId)
      .first();

    if (!meetup) {
      return null;
    }

    // Auto-complete if both parties checked in AND status is 'scheduled' or 'confirmed'
    // (meetings can auto-complete from either state)
    if (meetup.buyer_checked_in && meetup.seller_checked_in &&
        (meetup.status === 'scheduled' || meetup.status === 'confirmed')) {
      const [updated] = await this.db(this.tableName)
        .where('id', meetupId)
        .update({
          status: 'completed',
          updated_at: new Date(),
        })
        .returning('*');

      return updated;
    }

    return meetup;
  }

  static async setMeetupOutcome(meetupId: string, status: MeetupStatus): Promise<Meetup> {
    // If status is transitioning to no_show, trigger reputation update
    if (status === 'no_show_buyer' || status === 'no_show_seller') {
      // Dynamically import to avoid circular dependency
      const { MeetupService } = await import('../../services/MeetupService');
      const noShowParty = status === 'no_show_buyer' ? 'buyer' : 'seller';
      try {
        await MeetupService.recordNoShow(meetupId, noShowParty);
      } catch (err) {
        console.error(`Failed to record no-show for meetup ${meetupId}:`, err);
        // Continue anyway — don't let reputation tracking block the status update
      }
    }

    const [meetup] = await this.db(this.tableName)
      .where('id', meetupId)
      .update({
        status,
        updated_at: new Date(),
      })
      .returning('*');

    return meetup;
  }

  static async completeMeetup(meetupId: string, status: MeetupStatus): Promise<Meetup> {
    // Deprecated: kept for backwards compatibility. Use setMeetupOutcome instead.
    return this.setMeetupOutcome(meetupId, status);
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

  static async findById(meetupId: string): Promise<Meetup | null> {
    const meetup = await this.db(this.tableName)
      .where('id', meetupId)
      .first();

    return meetup || null;
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
