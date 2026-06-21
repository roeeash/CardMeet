import { Router, Request, Response } from 'express';
import { EventService } from '../services/EventService';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getStatusCode, formatErrorResponse } from '../utils/errorHandler';
import { validateRequest, rsvpSchema } from '../middleware/validation';
import { eventToDTO, eventsToDTO, eventRsvpToDTO } from '../utils/dto';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const events = await EventService.findEventsForUser(req.user!.userId);
    res.status(200).json(eventsToDTO(events));
  } catch (err) {
    res.status(getStatusCode(err)).json(formatErrorResponse(err));
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const event = await EventService.getEventById(req.params.id);
    res.status(200).json(eventToDTO(event));
  } catch (err) {
    res.status(getStatusCode(err)).json(formatErrorResponse(err));
  }
});

router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const event = await EventService.createEvent(req.user!.userId, req.body);
    res.status(201).json(eventToDTO(event));
  } catch (err) {
    res.status(getStatusCode(err)).json(formatErrorResponse(err));
  }
});

router.put('/:id/rsvp', authenticate, validateRequest(rsvpSchema), async (req: AuthRequest, res: Response) => {
  try {
    const rsvp = await EventService.updateRSVP(req.user!.userId, req.params.id, req.body.status);
    res.status(200).json(eventRsvpToDTO(rsvp));
  } catch (err) {
    res.status(getStatusCode(err)).json(formatErrorResponse(err));
  }
});

export default router;
