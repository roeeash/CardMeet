import { MeetupModel } from '../models/meetup/Meetup';
import { DealModel } from '../models/deal/Deal';
import { UserProfileModel } from '../models/user/User';
import { MeetupStatus } from '../../shared/types/meetup';

export class MeetupService {
  static async proposeMeetup(
    dealId: string, eventId: string,
    proposedWindowStart: string, proposedWindowEnd: string, locationNote?: string
  ) {
    // proposedWindowStart and proposedWindowEnd are in HH:MM format
    const meetup = await MeetupModel.createMeetup({
      dealId,
      eventId,
      proposedWindowStart,
      proposedWindowEnd,
      locationNote,
    });
    // Deal stays 'matched' until both parties confirm
    return meetup;
  }

  static async scheduleMeetup(
    dealId: string, eventId: string,
    startTime: Date, endTime: Date, locationNote?: string
  ) {
    const meetup = await MeetupModel.createMeetup({ dealId, eventId, startTime, endTime, locationNote });
    // Do NOT transition deal status to 'scheduled' here.
    // Deal stays 'matched' until both parties confirm via PUT /api/meetups/:id/confirm
    return meetup;
  }

  static async confirmMeetup(meetupId: string, userId: string, isBuyer: boolean) {
    // Mark the confirmation flag for this party
    const updated = await MeetupModel.confirmMeetup(meetupId, userId, isBuyer);

    // Check if both parties are now confirmed
    const meetup = await MeetupModel.findById(meetupId);
    if (meetup && (meetup as any).buyer_confirmed && (meetup as any).seller_confirmed) {
      // Both parties confirmed: transition meetup and deal status to 'scheduled'
      const dbMeetup = meetup as any;
      await MeetupModel.setMeetupOutcome(meetupId, 'scheduled');
      await DealModel.updateDealStatus(dbMeetup.deal_id, 'scheduled');

      // Fetch updated meetup
      const scheduledMeetup = await MeetupModel.findById(meetupId);
      return scheduledMeetup;
    }

    return updated;
  }

  static async checkIn(meetupId: string, userId: string) {
    // Get the deal associated with this meetup to determine buyer/seller
    // First fetch the meetup to get the deal_id
    const meetup = await MeetupModel.findById(meetupId);
    if (!meetup) {
      throw new Error(`Meetup ${meetupId} not found`);
    }

    // Get the deal to determine if this user is buyer or seller
    // Access raw snake_case property from Knex result
    const deal = await DealModel.getById((meetup as any).deal_id);
    if (!deal) {
      throw new Error(`Deal ${(meetup as any).deal_id} not found`);
    }

    // Access raw snake_case properties from Knex result
    const isBuyer = (deal as any).buyer_id === userId;
    if (!isBuyer && (deal as any).seller_id !== userId) {
      throw new Error(`User ${userId} is neither buyer nor seller of this deal`);
    }

    // Record the check-in for this party
    await MeetupModel.recordCheckIn(meetupId, isBuyer);

    // Check if both parties have now checked in, and auto-complete if so
    const updated = await MeetupModel.checkAndCompleteMeetup(meetupId);
    return updated;
  }

  static async completeMeetup(meetupId: string, outcome: MeetupStatus) {
    return MeetupModel.setMeetupOutcome(meetupId, outcome);
  }

  static async recordNoShow(meetupId: string, noShowParty: 'buyer' | 'seller') {
    // Get meetup and deal
    const meetup = await MeetupModel.findById(meetupId);
    if (!meetup) {
      throw new Error(`Meetup ${meetupId} not found`);
    }

    const deal = await DealModel.getById((meetup as any).deal_id);
    if (!deal) {
      throw new Error(`Deal not found for meetup ${meetupId}`);
    }

    // Determine which user is the no-show party
    const noShowUserId = noShowParty === 'buyer' ? (deal as any).buyer_id : (deal as any).seller_id;
    const _otherUserId = noShowParty === 'buyer' ? (deal as any).seller_id : (deal as any).buyer_id;

    // Get current profile for the no-show user
    const noShowProfile = await UserProfileModel.findByUserId(noShowUserId);
    if (!noShowProfile) {
      throw new Error(`Profile not found for user ${noShowUserId}`);
    }

    // Increment no_shows counter
    const updatedNoShows = ((noShowProfile as any).no_shows || 0) + 1;
    const currentCompletedDeals = (noShowProfile as any).completed_deals || 0;

    // Update reputation with new counts
    await UserProfileModel.updateReputation(noShowUserId, currentCompletedDeals, updatedNoShows);

    return meetup;
  }
}
