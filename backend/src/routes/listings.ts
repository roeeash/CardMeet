import { Router, Request, Response } from 'express';
import { ListingService } from '@services/ListingService';
import { authenticate, AuthRequest } from '@middleware/auth';
import { getStatusCode, formatErrorResponse } from '@utils/errorHandler';
import { validateRequest, createListingSchema, updateListingStatusSchema } from '@middleware/validation';
import { listingToDTO, listingsToDTO } from '@utils/dto';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const listings = await ListingService.getListings(req.user!.userId, req.query);
    res.status(200).json(listingsToDTO(listings));
  } catch (err) {
    res.status(getStatusCode(err)).json(formatErrorResponse(err));
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const listing = await ListingService.getListingById(req.params.id);
    res.status(200).json(listingToDTO(listing));
  } catch (err) {
    res.status(getStatusCode(err)).json(formatErrorResponse(err));
  }
});

router.post('/', authenticate, validateRequest(createListingSchema), async (req: AuthRequest, res: Response) => {
  try {
    const listing = await ListingService.createListing(req.user!.userId, req.body);
    res.status(201).json(listingToDTO(listing));
  } catch (err) {
    res.status(getStatusCode(err)).json(formatErrorResponse(err));
  }
});

router.patch('/:id/status', authenticate, validateRequest(updateListingStatusSchema), async (req: AuthRequest, res: Response) => {
  try {
    const listing = await ListingService.updateListingStatus(req.params.id, req.user!.userId, req.body.status);
    res.status(200).json(listingToDTO(listing));
  } catch (err) {
    res.status(getStatusCode(err)).json(formatErrorResponse(err));
  }
});

export default router;
