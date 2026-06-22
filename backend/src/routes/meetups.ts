import { Router, Response } from 'express';
import { MeetupService } from '@services/MeetupService';
import { MeetupModel } from '@models/meetup/Meetup';
import { authenticate, AuthRequest } from '@middleware/auth';
import { getStatusCode, formatErrorResponse } from '@utils/errorHandler';
import { validateRequest, scheduleMeetupSchema } from '@middleware/validation';
import { meetupToDTO } from '@utils/dto';

const router = Router();

/**
 * GET /api/meetups/available-slots
 * Fetch available 30-minute time slots for a given event and date.
 * Query params: eventId, date (ISO string)
 */
router.get('/available-slots', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { eventId, date } = req.query;

    if (!eventId || !date) {
      return res.status(400).json({
        error: 'eventId and date query params required',
      });
    }

    const dateObj = new Date(date as string);
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({
        error: 'Invalid date format',
      });
    }

    const slots = await MeetupModel.findAvailableSlots(eventId as string, dateObj);
    res.status(200).json({
      slots: slots.map(slot => ({
        startTime: slot.startTime.toISOString(),
        endTime: slot.endTime.toISOString(),
      })),
    });
  } catch (err) {
    res.status(getStatusCode(err)).json(formatErrorResponse(err));
  }
});

router.post('/', authenticate, validateRequest(scheduleMeetupSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { dealId, eventId, proposedWindowStart, proposedWindowEnd, locationNote } = req.body;
    // proposedWindowStart and proposedWindowEnd are in HH:MM format (e.g., "13:00")
    // For now, we'll store them as-is; the full date context comes from the event
    const meetup = await MeetupService.proposeMeetup(
      dealId, eventId, proposedWindowStart, proposedWindowEnd, locationNote
    );
    res.status(201).json(meetupToDTO(meetup));
  } catch (err) {
    res.status(getStatusCode(err)).json(formatErrorResponse(err));
  }
});

router.post('/:id/confirm', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // Get the deal associated with this meetup to determine buyer/seller
    const meetup = await MeetupModel.findById(req.params.id);
    if (!meetup) {
      return res.status(404).json({ error: 'Meetup not found' });
    }
    const dbMeetup = meetup as any;

    // Get the deal to find buyer and seller IDs
    const { DealModel } = await import('../models/deal/Deal');
    const deal = await DealModel.getById(dbMeetup.deal_id);
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const dbDeal = deal as any;
    const userId = req.user!.userId;
    const isBuyer = userId === dbDeal.buyer_id;

    const confirmed = await MeetupService.confirmMeetup(req.params.id, userId, isBuyer);
    res.status(200).json(meetupToDTO(confirmed));
  } catch (err) {
    res.status(getStatusCode(err)).json(formatErrorResponse(err));
  }
});

router.post('/:id/checkin', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await MeetupService.checkIn(req.params.id, req.user!.userId);
    // Make sure to return the full meetup after check-in
    const updatedMeetup = await MeetupModel.findById(req.params.id);
    res.status(200).json(meetupToDTO(updatedMeetup));
  } catch (err) {
    res.status(getStatusCode(err)).json(formatErrorResponse(err));
  }
});

/**
 * PATCH /api/meetups/:id/mark-no-show
 * Mark a meetup as no-show for buyer or seller
 * Body: { noShowParty: 'buyer' | 'seller' }
 */
router.patch('/:id/mark-no-show', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { noShowParty } = req.body;

    if (!noShowParty || !['buyer', 'seller'].includes(noShowParty)) {
      return res.status(400).json({
        error: 'noShowParty must be "buyer" or "seller"',
      });
    }

    // Record the no-show and update reputation
    await MeetupService.recordNoShow(req.params.id, noShowParty);

    // Update the meetup status
    const status = noShowParty === 'buyer' ? 'no_show_buyer' : 'no_show_seller';
    const updatedMeetup = await MeetupModel.setMeetupOutcome(req.params.id, status);

    res.status(200).json(meetupToDTO(updatedMeetup));
  } catch (err) {
    res.status(getStatusCode(err)).json(formatErrorResponse(err));
  }
});

export default router;
