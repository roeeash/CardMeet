# Instruction 7: Meetup Scheduling

## Overview
This instruction covers the complete meetup scheduling system including commitment windows, check-in functionality, location-based meeting spots, and the reliability features that prevent no-shows and enable successful face-to-face trades at shared events.

**Note**: Frontend components already exist in `/frontend/Components/DealCards.jsx` and `/frontend/Components/DetailSheet.jsx`. These need to be migrated to React Native and integrated with the backend API.

## 7.1 Meetup Service Implementation

### Meetup Service
```typescript
// backend/src/services/MeetupService.ts
import { MeetupModel } from '@models/Meetup';
import { DealModel } from '@models/Deal';
import { EventModel } from '@models/Event';
import { NotificationService } from '@services/NotificationService';
import { UserProfileModel } from '@models/User';
import { Meetup, MeetupStatus } from '@shared/types/meetup';

export interface MeetupCreationData {
  dealId: string;
  eventId: string;
  startTime: Date;
  endTime: Date;
  locationNote?: string;
}

export interface MeetupConfirmationData {
  meetupId: string;
  userId: string;
  isBuyer: boolean;
}

export interface CheckInData {
  meetupId: string;
  userId: string;
}

export class MeetupService {
  static async createMeetup(data: MeetupCreationData): Promise<Meetup> {
    // Validate deal
    const deal = await DealModel.findById(data.dealId);
    if (!deal) {
      throw new Error('Deal not found');
    }

    if (deal.status !== 'matched') {
      throw new Error('Can only schedule meetups for matched deals');
    }

    // Validate event
    const event = await EventModel.findById(data.eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    if (event.status !== 'active') {
      throw new Error('Cannot schedule meetups for inactive events');
    }

    if (new Date(data.startTime) < new Date()) {
      throw new Error('Start time must be in the future');
    }

    if (new Date(data.endTime) <= new Date(data.startTime)) {
      throw new Error('End time must be after start time');
    }

    // Check if meetup already exists for this deal
    const existingMeetup = await MeetupModel.findByDealId(data.dealId);
    if (existingMeetup) {
      throw new Error('Meetup already exists for this deal');
    }

    // Validate time slot availability
    const availableSlots = await MeetupModel.findAvailableSlots(
      data.eventId,
      new Date(data.startTime).toDateString(),
      30 // 30-minute duration
    );

    const requestedSlot = availableSlots.find(slot => 
      new Date(slot.startTime).getTime() === new Date(data.startTime).getTime()
    );

    if (!requestedSlot) {
      throw new Error('Requested time slot is not available');
    }

    // Create meetup
    const meetup = await MeetupModel.createMeetup({
      dealId: data.dealId,
      eventId: data.eventId,
      startTime: data.startTime,
      endTime: data.endTime,
      locationNote: data.locationNote,
    });

    // Update deal status
    await DealModel.updateDealStatus(data.dealId, 'scheduled');

    // Notify both parties
    await NotificationService.createNotification({
      userId: deal.buyerId,
      type: 'meetup_scheduled',
      title: 'Meetup scheduled!',
      body: `Your meetup is scheduled for ${this.formatMeetupTime(data.startTime)} at ${event.name}`,
      data: {
        meetupId: meetup.id,
        dealId: data.dealId,
        eventId: data.eventId,
        startTime: data.startTime,
      },
    });

    await NotificationService.createNotification({
      userId: deal.sellerId,
      type: 'meetup_scheduled',
      title: 'Meetup scheduled!',
      body: `Your meetup is scheduled for ${this.formatMeetupTime(data.startTime)} at ${event.name}`,
      data: {
        meetupId: meetup.id,
        dealId: data.dealId,
        eventId: data.eventId,
        startTime: data.startTime,
      },
    });

    return meetup;
  }

  static async confirmMeetup(data: MeetupConfirmationData): Promise<Meetup> {
    const meetup = await MeetupModel.findById(data.meetupId);
    if (!meetup) {
      throw new Error('Meetup not found');
    }

    if (meetup.status !== MeetupStatus.SCHEDULED) {
      throw new Error('Cannot confirm meetup that is not scheduled');
    }

    // Confirm the appropriate party
    await MeetupModel.confirmMeetup(data.meetupId, data.userId, data.isBuyer);

    // Get updated meetup
    const updatedMeetup = await MeetupModel.findById(data.meetupId);
    if (!updatedMeetup) {
      throw new Error('Meetup not found after confirmation');
    }

    // If both parties confirmed, notify them
    if (updatedMeetup.buyerConfirmed && updatedMeetup.sellerConfirmed) {
      const deal = await DealModel.findById(updatedMeetup.dealId);
      const event = await EventModel.findById(updatedMeetup.eventId);

      await NotificationService.createNotification({
        userId: deal!.buyerId,
        type: 'meetup_confirmed',
        title: 'Meetup confirmed by both parties',
        body: `Both parties have confirmed. Meet at ${this.formatMeetupTime(updatedMeetup.startTime)} at ${event!.name}`,
        data: {
          meetupId: updatedMeetup.id,
          startTime: updatedMeetup.startTime,
        },
      });

      await NotificationService.createNotification({
        userId: deal!.sellerId,
        type: 'meetup_confirmed',
        title: 'Meetup confirmed by both parties',
        body: `Both parties have confirmed. Meet at ${this.formatMeetupTime(updatedMeetup.startTime)} at ${event!.name}`,
        data: {
          meetupId: updatedMeetup.id,
          startTime: updatedMeetup.startTime,
        },
      });
    }

    return updatedMeetup;
  }

  static async checkIn(data: CheckInData): Promise<Meetup> {
    const meetup = await MeetupModel.findById(data.meetupId);
    if (!meetup) {
      throw new Error('Meetup not found');
    }

    if (meetup.status !== MeetupStatus.SCHEDULED) {
      throw new Error('Cannot check in to meetup that is not scheduled');
    }

    const now = new Date();
    const startTime = new Date(meetup.startTime);
    const endTime = new Date(meetup.endTime);

    // Allow check-in 15 minutes before to 15 minutes after
    const checkInWindowStart = new Date(startTime.getTime() - 15 * 60 * 1000);
    const checkInWindowEnd = new Date(endTime.getTime() + 15 * 60 * 1000);

    if (now < checkInWindowStart || now > checkInWindowEnd) {
      throw new Error('Check-in is only available 15 minutes before to 15 minutes after the scheduled time');
    }

    // Get deal to determine user role
    const deal = await DealModel.findById(meetup.dealId);
    if (!deal) {
      throw new Error('Deal not found');
    }

    const isBuyer = deal.buyerId === data.userId;
    
    if (isBuyer && meetup.buyerConfirmed) {
      throw new Error('Buyer has already checked in');
    }

    if (!isBuyer && meetup.sellerConfirmed) {
      throw new Error('Seller has already checked in');
    }

    // Confirm check-in (using the same confirmation method)
    await MeetupModel.confirmMeetup(data.meetupId, data.userId, isBuyer);

    // Get updated meetup
    const updatedMeetup = await MeetupModel.findById(data.meetupId);
    if (!updatedMeetup) {
      throw new Error('Meetup not found after check-in');
    }

    // Notify the other party
    const otherPartyId = isBuyer ? deal.sellerId : deal.buyerId;
    const event = await EventModel.findById(updatedMeetup.eventId);

    await NotificationService.createNotification({
      userId: otherPartyId,
      type: 'meetup_checkin',
      title: 'Partner has checked in',
      body: `${isBuyer ? 'Buyer' : 'Seller'} has checked in. See you at ${this.formatMeetupTime(updatedMeetup.startTime)} at ${event!.name}`,
      data: {
        meetupId: updatedMeetup.id,
        startTime: updatedMeetup.startTime,
      },
    });

    return updatedMeetup;
  }

  static async completeMeetup(meetupId: string, userId: string, outcome: {
    completed: boolean;
    buyerShowed: boolean;
    sellerShowed: boolean;
    notes?: string;
  }): Promise<void> {
    const meetup = await MeetupModel.findById(meetupId);
    if (!meetup) {
      throw new Error('Meetup not found');
    }

    const deal = await DealModel.findById(meetup.dealId);
    if (!deal) {
      throw new Error('Deal not found');
    }

    // Only allow completion after the end time
    if (new Date() < new Date(meetup.endTime)) {
      throw new Error('Cannot complete meetup before scheduled end time');
    }

    // Determine who didn't show up
    let status: MeetupStatus;
    if (outcome.completed) {
      status = MeetupStatus.COMPLETED;
    } else if (!outcome.buyerShowed && !outcome.sellerShowed) {
      status = MeetupStatus.CANCELLED;
    } else if (!outcome.buyerShowed) {
      status = MeetupStatus.NO_SHOW_BUYER;
    } else if (!outcome.sellerShowed) {
      status = MeetupStatus.NO_SHOW_SELLER;
    } else {
      status = MeetupStatus.COMPLETED;
    }

    // Update meetup status
    await MeetupModel.completeMeetup(meetupId, status);

    // Update deal status
    await DealModel.updateDealStatus(deal.id, 'completed');

    // Update user reputations
    if (status === MeetupStatus.NO_SHOW_BUYER) {
      await this.updateNoShowCount(deal.buyerId);
    } else if (status === MeetupStatus.NO_SHOW_SELLER) {
      await this.updateNoShowCount(deal.sellerId);
    } else if (status === MeetupStatus.COMPLETED) {
      await this.updateCompletedDeals(deal.buyerId);
      await this.updateCompletedDeals(deal.sellerId);
    }

    // Update listing status
    await ListingModel.updateListingStatus(deal.listingId, 'sold');
  }

  static async rescheduleMeetup(meetupId: string, userId: string, newStartTime: Date, newEndTime: Date): Promise<Meetup> {
    const meetup = await MeetupModel.findById(meetupId);
    if (!meetup) {
      throw new Error('Meetup not found');
    }

    const deal = await DealModel.findById(meetup.dealId);
    if (!deal) {
      throw new Error('Deal not found');
    }

    // Only allow rescheduling if both parties haven't confirmed
    if (meetup.buyerConfirmed && meetup.sellerConfirmed) {
      throw new Error('Cannot reschedule after both parties have confirmed');
    }

    // Validate new time
    if (newStartTime <= new Date()) {
      throw new Error('New start time must be in the future');
    }

    if (newEndTime <= newStartTime) {
      throw new Error('New end time must be after start time');
    }

    // Check availability of new slot
    const availableSlots = await MeetupModel.findAvailableSlots(
      meetup.eventId,
      new Date(newStartTime).toDateString(),
      30
    );

    const requestedSlot = availableSlots.find(slot => 
      new Date(slot.startTime).getTime() === newStartTime.getTime()
    );

    if (!requestedSlot) {
      throw new Error('Requested time slot is not available');
    }

    // Update meetup
    const updatedMeetup = await MeetupModel.update(meetupId, {
      startTime: newStartTime,
      endTime: newEndTime,
      buyerConfirmed: false,
      sellerConfirmed: false,
    });

    // Notify the other party
    const otherPartyId = deal.buyerId === userId ? deal.sellerId : deal.buyerId;
    const event = await EventModel.findById(updatedMeetup.eventId);

    await NotificationService.createNotification({
      userId: otherPartyId,
      type: 'meetup_rescheduled',
      title: 'Meetup rescheduled',
      body: `Meetup rescheduled to ${this.formatMeetupTime(newStartTime)} at ${event!.name}`,
      data: {
        meetupId: updatedMeetup.id,
        startTime: newStartTime,
      },
    });

    return updatedMeetup;
  }

  static async getMeetup(meetupId: string, userId: string): Promise<any> {
    const meetup = await MeetupModel.findById(meetupId);
    if (!meetup) {
      throw new Error('Meetup not found');
    }

    const deal = await DealModel.findById(meetup.dealId);
    if (!deal) {
      throw new Error('Deal not found');
    }

    if (deal.buyerId !== userId && deal.sellerId !== userId) {
      throw new Error('You are not part of this meetup');
    }

    const event = await EventModel.findById(meetup.eventId);
    const listing = await ListingModel.findById(deal.listingId);

    return {
      meetup,
      deal,
      event,
      listing,
      isBuyer: deal.buyerId === userId,
      isSeller: deal.sellerId === userId,
    };
  }

  static async getUserMeetups(userId: string): Promise<any[]> {
    return MeetupModel.getUserMeetups(userId);
  }

  static async getAvailableSlots(eventId: string, date: Date): Promise<Array<{
    startTime: Date;
    endTime: Date;
  }>> {
    return MeetupModel.findAvailableSlots(eventId, date, 30);
  }

  static async getEventMeetups(eventId: string): Promise<any[]> {
    const meetups = await MeetupModel.findByEventId(eventId);
    
    // Enrich with deal and user information
    const enrichedMeetups = [];
    for (const meetup of meetups) {
      const deal = await DealModel.findById(meetup.dealId);
      const listing = await ListingModel.findById(deal!.listingId);
      const buyerProfile = await UserProfileModel.findByUserId(deal!.buyerId);
      const sellerProfile = await UserProfileModel.findByUserId(deal!.sellerId);

      enrichedMeetups.push({
        meetup,
        deal,
        listing,
        buyer: buyerProfile,
        seller: sellerProfile,
      });
    }

    return enrichedMeetups;
  }

  private static async updateNoShowCount(userId: string): Promise<void> {
    const profile = await UserProfileModel.findByUserId(userId);
    if (profile) {
      await UserProfileModel.updateReputation(
        userId,
        profile.completedDeals,
        profile.noShows + 1
      );
    }
  }

  private static async updateCompletedDeals(userId: string): Promise<void> {
    const profile = await UserProfileModel.findByUserId(userId);
    if (profile) {
      await UserProfileModel.updateReputation(
        userId,
        profile.completedDeals + 1,
        profile.noShows
      );
    }
  }

  private static formatMeetupTime(startTime: Date): string {
    return new Date(startTime).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: false,
    });
  }

  static getMeetupStatusText(status: MeetupStatus): string {
    switch (status) {
      case 'scheduled': return 'Scheduled';
      case 'completed': return 'Completed';
      case 'no_show_buyer': return 'Buyer no-show';
      case 'no_show_seller': return 'Seller no-show';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  }

  static isCheckInAvailable(meetup: Meetup): boolean {
    const now = new Date();
    const startTime = new Date(meetup.startTime);
    const endTime = new Date(meetup.endTime);
    
    const checkInWindowStart = new Date(startTime.getTime() - 15 * 60 * 1000);
    const checkInWindowEnd = new Date(endTime.getTime() + 15 * 60 * 1000);

    return now >= checkInWindowStart && now <= checkInWindowEnd;
  }

  static getTimeUntilMeetup(meetup: Meetup): string {
    const now = new Date();
    const startTime = new Date(meetup.startTime);
    const diffMs = startTime.getTime() - now.getTime();

    if (diffMs <= 0) {
      return 'Now';
    }

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays}d ${diffHours % 24}h`;
    } else if (diffHours > 0) {
      return `${diffHours}h ${Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))}m`;
    } else {
      return `${Math.floor(diffMs / (1000 * 60))}m`;
    }
  }
}
```

## 7.2 Meetup Controller

### Meetup Controller
```typescript
// backend/src/controllers/meetups.ts
import { Request, Response } from 'express';
import { MeetupService } from '@services/MeetupService';
import { validate, schemas } from '@utils/validation';

export class MeetupController {
  static async createMeetup(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { dealId, eventId, startTime, endTime, locationNote } = req.body;

      const meetup = await MeetupService.createMeetup({
        dealId,
        eventId,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        locationNote,
      });

      res.status(201).json({ meetup });
    } catch (error) {
      console.error('Create meetup error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('validation')) {
          res.status(400).json({ error: error.message });
        } else {
          res.status(500).json({ error: 'Failed to create meetup' });
        }
      } else {
        res.status(500).json({ error: 'Failed to create meetup' });
      }
    }
  }

  static async getMeetup(req: Request, res: Response): Promise<void> {
    try {
      const { meetupId } = req.params;
      const userId = req.user!.id;

      const meetupData = await MeetupService.getMeetup(meetupId, userId);

      res.json({ meetup: meetupData });
    } catch (error) {
      console.error('Get meetup error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('not part')) {
          res.status(404).json({ error: error.message });
        } else {
          res.status(500).json({ error: 'Failed to get meetup' });
        }
      } else {
        res.status(500).json({ error: 'Failed to get meetup' });
      }
    }
  }

  static async getUserMeetups(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      const meetups = await MeetupService.getUserMeetups(userId);

      res.json({ meetups });
    } catch (error) {
      console.error('Get user meetups error:', error);
      res.status(500).json({ error: 'Failed to get user meetups' });
    }
  }

  static async confirmMeetup(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { meetupId } = req.body;

      const meetup = await MeetupService.confirmMeetup({
        meetupId,
        userId,
        isBuyer: req.body.isBuyer,
      });

      res.json({ meetup });
    } catch (error) {
      console.error('Confirm meetup error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('cannot confirm')) {
          res.status(400).json({ error: error.message });
        } else {
          res.status(500).json({ error: 'Failed to confirm meetup' });
        }
      } else {
        res.status(500).json({ error: 'Failed to confirm meetup' });
      }
    }
  }

  static async checkIn(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { meetupId } = req.body;

      const meetup = await MeetupService.checkIn({
        meetupId,
        userId,
      });

      res.json({ meetup });
    } catch (error) {
      console.error('Check in error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('cannot check')) {
          res.status(400).json({ error: error.message });
        } else {
          res.status(500).json({ error: 'Failed to check in' });
        }
      } else {
        res.status(500).json({ error: 'Failed to check in' });
      }
    }
  }

  static async completeMeetup(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { meetupId, completed, buyerShowed, sellerShowed, notes } = req.body;

      await MeetupService.completeMeetup(meetupId, userId, {
        completed,
        buyerShowed,
        sellerShowed,
        notes,
      });

      res.json({ message: 'Meetup completed successfully' });
    } catch (error) {
      console.error('Complete meetup error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('cannot complete')) {
          res.status(400).json({ error: error.message });
        } else {
          res.status(500).json({ error: 'Failed to complete meetup' });
        }
      } else {
        res.status(500).json({ error: 'Failed to complete meetup' });
      }
    }
  }

  static async rescheduleMeetup(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { meetupId, startTime, endTime } = req.body;

      const meetup = await MeetupService.rescheduleMeetup(
        meetupId,
        userId,
        new Date(startTime),
        new Date(endTime)
      );

      res.json({ meetup });
    } catch (error) {
      console.error('Reschedule meetup error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('cannot reschedule')) {
          res.status(400).json({ error: error.message });
        } else {
          res.status(500).json({ error: 'Failed to reschedule meetup' });
        }
      } else {
        res.status(500).json({ error: 'Failed to reschedule meetup' });
      }
    }
  }

  static async getAvailableSlots(req: Request, res: Response): Promise<void> {
    try {
      const { eventId, date } = req.query;

      if (!eventId || !date) {
        res.status(400).json({ error: 'Event ID and date are required' });
        return;
      }

      const slots = await MeetupService.getAvailableSlots(
        eventId as string,
        new Date(date as string)
      );

      res.json({ slots });
    } catch (error) {
      console.error('Get available slots error:', error);
      res.status(500).json({ error: 'Failed to get available slots' });
    }
  }

  static async getEventMeetups(req: Request, res: Response): Promise<void> {
    try {
      const { eventId } = req.params;

      const meetups = await MeetupService.getEventMeetups(eventId);

      res.json({ meetups });
    } catch (error) {
      console.error('Get event meetups error:', error);
      res.status(500).json({ error: 'Failed to get event meetups' });
    }
  }
}
```

### Meetup Validation Schemas
```typescript
// backend/src/utils/validation.ts (add to existing file)
export const schemas = {
  // ... existing schemas ...

  // Meetup creation validation
  createMeetup: Joi.object({
    dealId: Joi.string()
      .uuid()
      .required()
      .messages({
        'string.uuid': 'Invalid deal ID',
        'any.required': 'Deal ID is required',
      }),
    eventId: Joi.string()
      .uuid()
      .required()
      .messages({
        'string.uuid': 'Invalid event ID',
        'any.required': 'Event ID is required',
      }),
    startTime: Joi.date()
      .iso()
      .min('now')
      .required()
      .messages({
        'date.min': 'Start time must be in the future',
        'any.required': 'Start time is required',
      }),
    endTime: Joi.date()
      .iso()
      .min(Joi.ref('startTime'))
      .required()
      .messages({
        'date.min': 'End time must be after start time',
        'any.required': 'End time is required',
      }),
    locationNote: Joi.string()
      .max(200)
      .optional()
      .messages({
        'string.max': 'Location note must be less than 200 characters',
      }),
  }),

  // Meetup confirmation validation
  confirmMeetup: Joi.object({
    meetupId: Joi.string()
      .uuid()
      .required()
      .messages({
        'string.uuid': 'Invalid meetup ID',
        'any.required': 'Meetup ID is required',
      }),
    isBuyer: Joi.boolean()
      .required()
      .messages({
        'any.required': 'User role is required',
      }),
  }),

  // Check-in validation
  checkIn: Joi.object({
    meetupId: Joi.string()
      .uuid()
      .required()
      .messages({
        'string.uuid': 'Invalid meetup ID',
        'any.required': 'Meetup ID is required',
      }),
  }),

  // Meetup completion validation
  completeMeetup: Joi.object({
    meetupId: Joi.string()
      .uuid()
      .required()
      .messages({
        'string.uuid': 'Invalid meetup ID',
        'any.required': 'Meetup ID is required',
      }),
    completed: Joi.boolean()
      .required()
      .messages({
        'any.required': 'Completion status is required',
      }),
    buyerShowed: Joi.boolean()
      .required()
      .messages({
        'any.required': 'Buyer attendance is required',
      }),
    sellerShowed: Joi.boolean()
      .required()
      .messages({
        'any.required': 'Seller attendance is required',
      }),
    notes: Joi.string()
      .max(500)
      .optional()
      .messages({
        'string.max': 'Notes must be less than 500 characters',
      }),
  }),

  // Reschedule validation
  rescheduleMeetup: Joi.object({
    meetupId: Joi.string()
      .uuid()
      .required()
      .messages({
        'string.uuid': 'Invalid meetup ID',
        'any.required': 'Meetup ID is required',
      }),
    startTime: Joi.date()
      .iso()
      .min('now')
      .required()
      .messages({
        'date.min': 'New start time must be in the future',
        'any.required': 'New start time is required',
      }),
    endTime: Joi.date()
      .iso()
      .min(Joi.ref('startTime'))
      .required()
      .messages({
        'date.min': 'New end time must be after start time',
        'any.required': 'New end time is required',
      }),
  }),
};
```

## 7.3 Meetup Routes

### Meetup Routes
```typescript
// backend/src/routes/meetups.ts
import { Router } from 'express';
import { MeetupController } from '@controllers/meetups';
import { authenticate } from '@middleware/auth';
import { validate, schemas } from '@utils/validation';

const router = Router();

// All meetup routes require authentication
router.use(authenticate);

// Create meetup
router.post(
  '/',
  validate(schemas.createMeetup),
  MeetupController.createMeetup
);

// Get user's meetups
router.get('/', MeetupController.getUserMeetups);

// Get specific meetup
router.get('/:meetupId', MeetupController.getMeetup);

// Confirm meetup
router.post(
  '/confirm',
  validate(schemas.confirmMeetup),
  MeetupController.confirmMeetup
);

// Check in to meetup
router.post(
  '/checkin',
  validate(schemas.checkIn),
  MeetupController.checkIn
);

// Complete meetup
router.post(
  '/complete',
  validate(schemas.completeMeetup),
  MeetupController.completeMeetup
);

// Reschedule meetup
router.put(
  '/reschedule',
  validate(schemas.rescheduleMeetup),
  MeetupController.rescheduleMeetup
);

// Get available slots for event
router.get('/slots/available', MeetupController.getAvailableSlots);

// Get event meetups
router.get('/event/:eventId', MeetupController.getEventMeetups);

export default router;
```

## 7.4 Frontend Meetup Service (React Native)

### Meetup Service (Frontend)
```typescript
// frontend/src/services/meetups/MeetupService.ts
import { ApiClient } from '@services/api/ApiClient';

export interface MeetupData {
  id: string;
  dealId: string;
  eventId: string;
  startTime: string;
  endTime: string;
  locationNote?: string;
  status: 'scheduled' | 'completed' | 'no_show_buyer' | 'no_show_seller' | 'cancelled';
  buyerConfirmed: boolean;
  sellerConfirmed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MeetupDetail {
  meetup: MeetupData;
  deal: {
    id: string;
    listingId: string;
    buyerId: string;
    sellerId: string;
    status: string;
    agreedPriceCents?: number;
  };
  event: {
    id: string;
    name: string;
    locationName: string;
    startDate: string;
    endDate: string;
  };
  listing: {
    id: string;
    cardName: string;
    cardSet?: string;
    condition: string;
    game: string;
  };
  isBuyer: boolean;
  isSeller: boolean;
}

export interface TimeSlot {
  startTime: Date;
  endTime: Date;
}

export class MeetupService {
  static async createMeetup(data: {
    dealId: string;
    eventId: string;
    startTime: string;
    endTime: string;
    locationNote?: string;
  }): Promise<MeetupData> {
    const response = await ApiClient.post<{ meetup: MeetupData }>('/meetups', data);
    return response.meetup;
  }

  static async getMeetup(meetupId: string): Promise<MeetupDetail> {
    const response = await ApiClient.get<{ meetup: MeetupDetail }>(`/meetups/${meetupId}`);
    return response.meetup;
  }

  static async getUserMeetups(): Promise<MeetupDetail[]> {
    const response = await ApiClient.get<{ meetups: MeetupDetail[] }>('/meetups');
    return response.meetups;
  }

  static async confirmMeetup(meetupId: string, isBuyer: boolean): Promise<MeetupData> {
    const response = await ApiClient.post<{ meetup: MeetupData }>('/meetups/confirm', {
      meetupId,
      isBuyer,
    });
    return response.meetup;
  }

  static async checkIn(meetupId: string): Promise<MeetupData> {
    const response = await ApiClient.post<{ meetup: MeetupData }>('/meetups/checkin', {
      meetupId,
    });
    return response.meetup;
  }

  static async completeMeetup(meetupId: string, outcome: {
    completed: boolean;
    buyerShowed: boolean;
    sellerShowed: boolean;
    notes?: string;
  }): Promise<void> {
    await ApiClient.post('/meetups/complete', {
      meetupId,
      ...outcome,
    });
  }

  static async rescheduleMeetup(meetupId: string, startTime: string, endTime: string): Promise<MeetupData> {
    const response = await ApiClient.put<{ meetup: MeetupData }>('/meetups/reschedule', {
      meetupId,
      startTime,
      endTime,
    });
    return response.meetup;
  }

  static async getAvailableSlots(eventId: string, date: Date): Promise<TimeSlot[]> {
    const response = await ApiClient.get<{ slots: TimeSlot[] }>(
      `/meetups/slots/available?eventId=${eventId}&date=${date.toISOString()}`
    );
    return response.slots;
  }

  static async getEventMeetups(eventId: string): Promise<any[]> {
    const response = await ApiClient.get<{ meetups: any[] }>(`/meetups/event/${eventId}`);
    return response.meetups;
  }

  // Utility functions
  static formatMeetupTime(startTime: string): string {
    return new Date(startTime).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: false,
    });
  }

  static formatMeetupDate(startTime: string): string {
    return new Date(startTime).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  static formatMeetupWindow(startTime: string, endTime: string): string {
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    return `${start.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: false,
    })} – ${end.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: false,
    })}`;
  }

  static getTimeUntilMeetup(startTime: string): string {
    const now = new Date();
    const start = new Date(startTime);
    const diffMs = start.getTime() - now.getTime();

    if (diffMs <= 0) {
      return 'Now';
    }

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays}d ${diffHours % 24}h`;
    } else if (diffHours > 0) {
      return `${diffHours}h ${Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))}m`;
    } else {
      return `${Math.floor(diffMs / (1000 * 60))}m`;
    }
  }

  static isCheckInAvailable(meetup: MeetupData): boolean {
    const now = new Date();
    const startTime = new Date(meetup.startTime);
    const endTime = new Date(meetup.endTime);
    
    const checkInWindowStart = new Date(startTime.getTime() - 15 * 60 * 1000);
    const checkInWindowEnd = new Date(endTime.getTime() + 15 * 60 * 1000);

    return now >= checkInWindowStart && now <= checkInWindowEnd;
  }

  static getMeetupStatusText(status: string): string {
    switch (status) {
      case 'scheduled': return 'Scheduled';
      case 'completed': return 'Completed';
      case 'no_show_buyer': return 'Buyer no-show';
      case 'no_show_seller': return 'Seller no-show';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  }

  static hasUserConfirmed(meetup: MeetupData, isBuyer: boolean): boolean {
    return isBuyer ? meetup.buyerConfirmed : meetup.sellerConfirmed;
  }

  static canUserConfirm(meetup: MeetupData, isBuyer: boolean): boolean {
    return !this.hasUserConfirmed(meetup, isBuyer);
  }

  static areBothConfirmed(meetup: MeetupData): boolean {
    return meetup.buyerConfirmed && meetup.sellerConfirmed;
  }
}
```

## 7.5 Meetup Scheduling Screen (React Native)

### Meetup Scheduling Screen
```typescript
// frontend/src/screens/meetups/MeetupSchedulingScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { createMeetup } from '@store/slices/meetupSlice';
import { RootState } from '@store';
import { MeetupService } from '@services/meetups/MeetupService';
import { Button } from '@components/common/Button/Button';
import { Card } from '@components/common/Card/Card';
import { Text } from '@components/common/Text/Text';
import { colors, spacing, typography } from '@utils/designSystem/tokens';

interface MeetupSchedulingScreenProps {
  dealId: string;
  eventId: string;
  onScheduled: () => void;
  onCancel: () => void;
}

export const MeetupSchedulingScreen: React.FC<MeetupSchedulingScreenProps> = ({
  dealId,
  eventId,
  onScheduled,
  onCancel,
}) => {
  const dispatch = useDispatch();
  const { loading } = useSelector((state: RootState) => state.meetups);
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [availableSlots, setAvailableSlots] = useState<Array<{
    startTime: Date;
    endTime: Date;
  }>>([]);
  const [selectedSlot, setSelectedSlot] = useState<{
    startTime: Date;
    endTime: Date;
  } | null>(null);
  const [locationNote, setLocationNote] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(true);

  useEffect(() => {
    loadAvailableSlots();
  }, [selectedDate]);

  const loadAvailableSlots = async () => {
    try {
      setLoadingSlots(true);
      const slots = await MeetupService.getAvailableSlots(eventId, selectedDate);
      setAvailableSlots(slots);
    } catch (error) {
      console.error('Failed to load available slots:', error);
      Alert.alert('Error', 'Failed to load available time slots');
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleScheduleMeetup = async () => {
    if (!selectedSlot) {
      Alert.alert('Error', 'Please select a time slot');
      return;
    }

    try {
      await dispatch(createMeetup({
        dealId,
        eventId,
        startTime: selectedSlot.startTime.toISOString(),
        endTime: selectedSlot.endTime.toISOString(),
        locationNote,
      })).unwrap();

      onScheduled();
    } catch (error) {
      console.error('Failed to schedule meetup:', error);
      Alert.alert('Error', 'Failed to schedule meetup');
    }
  };

  const formatTimeSlot = (slot: { startTime: Date; endTime: Date }) => {
    return `${slot.startTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: false,
    })} – ${slot.endTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: false,
    })}`;
  };

  const renderTimeSlot = (slot: { startTime: Date; endTime: Date }, index: number) => {
    const isSelected = selectedSlot?.startTime.getTime() === slot.startTime.getTime();
    
    return (
      <Button
        key={index}
        title={formatTimeSlot(slot)}
        onPress={() => setSelectedSlot(slot)}
        variant={isSelected ? 'primary' : 'secondary'}
        style={styles.timeSlotButton}
      />
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Schedule Meetup</Text>
        <Text style={styles.subtitle}>
          Choose a 30-minute time slot for your trade
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.dateCard}>
          <Text style={styles.sectionTitle}>Select Date</Text>
          <Button
            title={selectedDate.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
            onPress={() => {/* Show date picker */}}
            variant="secondary"
            style={styles.dateButton}
          />
        </Card>

        <Card style={styles.slotsCard}>
          <Text style={styles.sectionTitle}>Available Time Slots</Text>
          {loadingSlots ? (
            <Text style={styles.loadingText}>Loading available slots...</Text>
          ) : availableSlots.length === 0 ? (
            <Text style={styles.noSlotsText}>No available slots for this date</Text>
          ) : (
            <View style={styles.slotsGrid}>
              {availableSlots.map(renderTimeSlot)}
            </View>
          )}
        </Card>

        <Card style={styles.locationCard}>
          <Text style={styles.sectionTitle}>Location Note (Optional)</Text>
          <Text style={styles.locationSubtext}>
            Add details about where to meet at the venue
          </Text>
          <View style={styles.locationInput}>
            {/* Replace with actual Input component */}
            <Text style={styles.locationPlaceholder}>
              e.g., "Near the entrance, by the registration desk"
            </Text>
          </View>
        </Card>

        {selectedSlot && (
          <Card style={styles.summaryCard}>
            <Text style={styles.sectionTitle}>Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Date:</Text>
              <Text style={styles.summaryValue}>
                {selectedSlot.startTime.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Time:</Text>
              <Text style={styles.summaryValue}>
                {formatTimeSlot(selectedSlot)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Duration:</Text>
              <Text style={styles.summaryValue}>30 minutes</Text>
            </View>
            {locationNote && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Location:</Text>
                <Text style={styles.summaryValue}>{locationNote}</Text>
              </View>
            )}
          </Card>
        )}
      </ScrollView>

      <View style={styles.actions}>
        <Button
          title="Cancel"
          onPress={onCancel}
          variant="secondary"
          style={styles.cancelButton}
        />
        <Button
          title="Schedule Meetup"
          onPress={handleScheduleMeetup}
          loading={loading}
          disabled={!selectedSlot}
          style={styles.scheduleButton}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  header: {
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    fontFamily: typography.fonts.serif,
    fontSize: typography.sizes.h2.fontSize,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: typography.fonts.sans,
    fontSize: typography.sizes.body.fontSize,
    color: colors.ink2,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  dateCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontFamily: typography.fonts.serif,
    fontSize: typography.sizes.h4.fontSize,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.md,
  },
  dateButton: {
    alignSelf: 'flex-start',
  },
  slotsCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  loadingText: {
    fontFamily: typography.fonts.sans,
    fontSize: typography.sizes.body.fontSize,
    color: colors.ink2,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  noSlotsText: {
    fontFamily: typography.fonts.sans,
    fontSize: typography.sizes.body.fontSize,
    color: colors.ink2,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  timeSlotButton: {
    minWidth: 120,
  },
  locationCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  locationSubtext: {
    fontFamily: typography.fonts.sans,
    fontSize: typography.sizes.small.fontSize,
    color: colors.ink2,
    marginBottom: spacing.md,
  },
  locationInput: {
    backgroundColor: colors.paper2,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minHeight: 60,
  },
  locationPlaceholder: {
    fontFamily: typography.fonts.sans,
    fontSize: typography.sizes.body.fontSize,
    color: colors.muted,
    fontStyle: 'italic',
  },
  summaryCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  summaryLabel: {
    fontFamily: typography.fonts.sans,
    fontSize: typography.sizes.body.fontSize,
    color: colors.ink2,
  },
  summaryValue: {
    fontFamily: typography.fonts.sans,
    fontSize: typography.sizes.body.fontSize,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  actions: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
  },
  scheduleButton: {
    flex: 2,
  },
});
```

## 7.6 Meetup Store (Redux)

### Meetup Store Slice
```typescript
// frontend/src/store/slices/meetupSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { MeetupService, MeetupDetail } from '@services/meetups/MeetupService';

interface MeetupState {
  meetups: MeetupDetail[];
  selectedMeetup: MeetupDetail | null;
  loading: boolean;
  error: string | null;
  availableSlots: Array<{
    startTime: Date;
    endTime: Date;
  }>;
}

const initialState: MeetupState = {
  meetups: [],
  selectedMeetup: null,
  loading: false,
  error: null,
  availableSlots: [],
};

// Async thunks
export const fetchUserMeetups = createAsyncThunk(
  'meetups/fetchUserMeetups',
  async () => {
    return await MeetupService.getUserMeetups();
  }
);

export const fetchMeetup = createAsyncThunk(
  'meetups/fetchMeetup',
  async (meetupId: string) => {
    return await MeetupService.getMeetup(meetupId);
  }
);

export const createMeetup = createAsyncThunk(
  'meetups/createMeetup',
  async (data: {
    dealId: string;
    eventId: string;
    startTime: string;
    endTime: string;
    locationNote?: string;
  }) => {
    return await MeetupService.createMeetup(data);
  }
);

export const confirmMeetup = createAsyncThunk(
  'meetups/confirmMeetup',
  async (data: { meetupId: string; isBuyer: boolean }) => {
    return await MeetupService.confirmMeetup(data.meetupId, data.isBuyer);
  }
);

export const checkIn = createAsyncThunk(
  'meetups/checkIn',
  async (meetupId: string) => {
    return await MeetupService.checkIn(meetupId);
  }
);

export const completeMeetup = createAsyncThunk(
  'meetups/completeMeetup',
  async (data: {
    meetupId: string;
    completed: boolean;
    buyerShowed: boolean;
    sellerShowed: boolean;
    notes?: string;
  }) => {
    await MeetupService.completeMeetup(data.meetupId, data);
    return data.meetupId;
  }
);

export const rescheduleMeetup = createAsyncThunk(
  'meetups/rescheduleMeetup',
  async (data: {
    meetupId: string;
    startTime: string;
    endTime: string;
  }) => {
    return await MeetupService.rescheduleMeetup(data.meetupId, data.startTime, data.endTime);
  }
);

export const fetchAvailableSlots = createAsyncThunk(
  'meetups/fetchAvailableSlots',
  async (data: { eventId: string; date: Date }) => {
    return await MeetupService.getAvailableSlots(data.eventId, data.date);
  }
);

const meetupSlice = createSlice({
  name: 'meetups',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setSelectedMeetup: (state, action: PayloadAction<MeetupDetail | null>) => {
      state.selectedMeetup = action.payload;
    },
    clearAvailableSlots: (state) => {
      state.availableSlots = [];
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch user meetups
      .addCase(fetchUserMeetups.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserMeetups.fulfilled, (state, action) => {
        state.loading = false;
        state.meetups = action.payload;
      })
      .addCase(fetchUserMeetups.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch meetups';
      })
      // Fetch meetup
      .addCase(fetchMeetup.fulfilled, (state, action) => {
        state.selectedMeetup = action.payload;
      })
      // Create meetup
      .addCase(createMeetup.fulfilled, (state, action) => {
        state.meetups.unshift(action.payload);
      })
      // Confirm meetup
      .addCase(confirmMeetup.fulfilled, (state, action) => {
        const index = state.meetups.findIndex(m => m.meetup.id === action.payload.id);
        if (index !== -1) {
          state.meetups[index] = action.payload;
        }
        if (state.selectedMeetup?.meetup.id === action.payload.id) {
          state.selectedMeetup = action.payload;
        }
      })
      // Check in
      .addCase(checkIn.fulfilled, (state, action) => {
        const index = state.meetups.findIndex(m => m.meetup.id === action.payload.id);
        if (index !== -1) {
          state.meetups[index] = action.payload;
        }
        if (state.selectedMeetup?.meetup.id === action.payload.id) {
          state.selectedMeetup = action.payload;
        }
      })
      // Complete meetup
      .addCase(completeMeetup.fulfilled, (state, action) => {
        // Remove from active meetups
        state.meetups = state.meetups.filter(m => m.meetup.id !== action.payload);
        if (state.selectedMeetup?.meetup.id === action.payload) {
          state.selectedMeetup = null;
        }
      })
      // Reschedule meetup
      .addCase(rescheduleMeetup.fulfilled, (state, action) => {
        const index = state.meetups.findIndex(m => m.meetup.id === action.payload.id);
        if (index !== -1) {
          state.meetups[index] = action.payload;
        }
        if (state.selectedMeetup?.meetup.id === action.payload.id) {
          state.selectedMeetup = action.payload;
        }
      })
      // Fetch available slots
      .addCase(fetchAvailableSlots.fulfilled, (state, action) => {
        state.availableSlots = action.payload;
      });
  },
});

export const { clearError, setSelectedMeetup, clearAvailableSlots } = meetupSlice.actions;
export default meetupSlice.reducer;
```

## 7.7 Testing Meetup System

### Meetup Service Tests
```typescript
// backend/tests/services/MeetupService.test.ts
import { MeetupService } from '../../src/services/MeetupService';
import { Database } from '../../src/config/database';

describe('MeetupService', () => {
  let buyer: any;
  let seller: any;
  let event: any;
  let deal: any;
  let meetup: any;

  beforeAll(async () => {
    await Database.migrate();
    
    // Create test users
    buyer = await UserModel.create({
      email: 'buyer@example.com',
      password: 'password123',
    });

    seller = await UserModel.create({
      email: 'seller@example.com',
      password: 'password123',
    });

    // Create user profiles
    await UserProfileModel.createProfile({
      userId: buyer.id,
      displayName: 'Buyer User',
      locationLat: 32.0853,
      locationLng: 34.7818,
      travelRadiusKm: 50,
      games: ['mtg'],
    });

    await UserProfileModel.createProfile({
      userId: seller.id,
      displayName: 'Seller User',
      locationLat: 32.0853,
      locationLng: 34.7818,
      travelRadiusKm: 50,
      games: ['mtg'],
    });

    // Create test event
    event = await EventModel.createEvent({
      name: 'Test Event',
      locationName: 'Test Venue',
      locationLat: 32.0853,
      locationLng: 34.7818,
      startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000),
      games: ['mtg'],
      eventType: 'convention',
      status: 'active',
    });

    // Create test listing
    const listing = await ListingModel.createListing({
      sellerId: seller.id,
      cardName: 'Test Card',
      condition: 'nm',
      priceCents: 10000,
      game: 'mtg',
    });

    // Create test deal
    deal = await DealModel.createDeal({
      listingId: listing.id,
      buyerId: buyer.id,
      sellerId: seller.id,
      initialPriceCents: 8000,
    });

    // Update deal to matched status
    await DealModel.updateDealStatus(deal.id, 'matched');
  });

  afterAll(async () => {
    await Database.close();
  });

  describe('createMeetup', () => {
    it('should create a meetup successfully', async () => {
      const startTime = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

      const meetupData = {
        dealId: deal.id,
        eventId: event.id,
        startTime,
        endTime,
        locationNote: 'Near the entrance',
      };

      meetup = await MeetupService.createMeetup(meetupData);

      expect(meetup.dealId).toBe(deal.id);
      expect(meetup.eventId).toBe(event.id);
      expect(meetup.status).toBe('scheduled');
      expect(meetup.buyerConfirmed).toBe(false);
      expect(meetup.sellerConfirmed).toBe(false);
    });

    it('should reject meetup for unmatched deal', async () => {
      // Create a new deal that is not matched
      const listing = await ListingModel.createListing({
        sellerId: seller.id,
        cardName: 'Another Card',
        condition: 'nm',
        priceCents: 5000,
        game: 'mtg',
      });

      const newDeal = await DealModel.createDeal({
        listingId: listing.id,
        buyerId: buyer.id,
        sellerId: seller.id,
        initialPriceCents: 4000,
      });

      const meetupData = {
        dealId: newDeal.id,
        eventId: event.id,
        startTime: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
      };

      await expect(MeetupService.createMeetup(meetupData))
        .rejects.toThrow('Can only schedule meetups for matched deals');
    });

    it('should reject past start time', async () => {
      const meetupData = {
        dealId: deal.id,
        eventId: event.id,
        startTime: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        endTime: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      };

      await expect(MeetupService.createMeetup(meetupData))
        .rejects.toThrow('Start time must be in the future');
    });
  });

  describe('confirmMeetup', () => {
    it('should confirm meetup successfully', async () => {
      const confirmedMeetup = await MeetupService.confirmMeetup({
        meetupId: meetup.id,
        userId: buyer.id,
        isBuyer: true,
      });

      expect(confirmedMeetup.buyerConfirmed).toBe(true);
      expect(confirmedMeetup.sellerConfirmed).toBe(false);
    });

    it('should reject confirmation for non-participant', async () => {
      const otherUser = await UserModel.create({
        email: 'other@example.com',
        password: 'password123',
      });

      await expect(MeetupService.confirmMeetup({
        meetupId: meetup.id,
        userId: otherUser.id,
        isBuyer: false,
      })).rejects.toThrow('You are not part of this meetup');
    });
  });

  describe('checkIn', () => {
    it('should allow check-in during valid window', async () => {
      // Create a meetup that starts now
      const now = new Date();
      const startTime = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes from now
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

      const testMeetup = await MeetupService.createMeetup({
        dealId: deal.id,
        eventId: event.id,
        startTime,
        endTime,
      });

      // Mock the current time to be within check-in window
      const originalDateNow = Date.now;
      Date.now = () => startTime.getTime();

      const checkedInMeetup = await MeetupService.checkIn({
        meetupId: testMeetup.id,
        userId: buyer.id,
      });

      expect(checkedInMeetup.buyerConfirmed).toBe(true);

      // Restore original Date.now
      Date.now = originalDateNow;
    });

    it('should reject check-in outside valid window', async () => {
      // Create a meetup that starts in 2 hours
      const startTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

      const testMeetup = await MeetupService.createMeetup({
        dealId: deal.id,
        eventId: event.id,
        startTime,
        endTime,
      });

      await expect(MeetupService.checkIn({
        meetupId: testMeetup.id,
        userId: buyer.id,
      })).rejects.toThrow('Check-in is only available 15 minutes before to 15 minutes after the scheduled time');
    });
  });

  describe('getAvailableSlots', () => {
    it('should return available slots for event', async () => {
      const date = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
      const slots = await MeetupService.getAvailableSlots(event.id, date);

      expect(Array.isArray(slots)).toBe(true);
      expect(slots.length).toBeGreaterThan(0);
      
      // Each slot should be 30 minutes
      slots.forEach(slot => {
        const duration = slot.endTime.getTime() - slot.startTime.getTime();
        expect(duration).toBe(30 * 60 * 1000); // 30 minutes in milliseconds
      });
    });
  });

  describe('completeMeetup', () => {
    it('should complete meetup successfully', async () => {
      // Complete the original meetup
      await MeetupService.completeMeetup(meetup.id, buyer.id, {
        completed: true,
        buyerShowed: true,
        sellerShowed: true,
      });

      // Verify meetup status
      const completedMeetup = await MeetupModel.findById(meetup.id);
      expect(completedMeetup?.status).toBe('completed');

      // Verify deal status
      const updatedDeal = await DealModel.findById(deal.id);
      expect(updatedDeal?.status).toBe('completed');
    });

    it('should handle buyer no-show', async () => {
      // Create a new meetup for this test
      const startTime = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

      const testMeetup = await MeetupService.createMeetup({
        dealId: deal.id,
        eventId: event.id,
        startTime,
        endTime,
      });

      await MeetupService.completeMeetup(testMeetup.id, seller.id, {
        completed: false,
        buyerShowed: false,
        sellerShowed: true,
      });

      const completedMeetup = await MeetupModel.findById(testMeetup.id);
      expect(completedMeetup?.status).toBe('no_show_buyer');

      // Verify buyer's no-show count increased
      const buyerProfile = await UserProfileModel.findByUserId(buyer.id);
      expect(buyerProfile?.no_shows).toBe(1);
    });
  });
});
```

## Verification Checklist

- [ ] Meetup service with complete scheduling flow
- [ ] Time slot availability management
- [ ] Check-in functionality with time windows
- [ ] Meetup confirmation system
- [ ] Rescheduling capabilities
- [ ] Meetup completion with outcome tracking
- [ ] No-show tracking and reputation updates
- [ ] Meetup controller with comprehensive endpoints
- [ ] Frontend meetup service with API integration
- [ ] Meetup scheduling screen with slot selection
- [ ] Redux store for meetup state management
- [ ] Integration with deal and event systems
- [ ] Comprehensive test coverage
- [ ] Real-time notifications for meetup updates

## Next Steps

Proceed to **Instruction 8: Profile & Reputation** to implement the user profile system, reputation scoring, no-show tracking, and the social features that build trust in the CardMeet community.
