import { Router, Response } from 'express';
import { DealService } from '../services/DealService';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getStatusCode, formatErrorResponse } from '../utils/errorHandler';
import { validateRequest, createDealSchema, makeOfferSchema } from '../middleware/validation';
import { dealToDTO, dealGroupToDTO, offerToDTO } from '../utils/dto';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const deals = await DealService.getUserDeals(req.user!.userId);
    res.status(200).json(dealGroupToDTO(deals));
  } catch (err) {
    res.status(getStatusCode(err)).json(formatErrorResponse(err));
  }
});

router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const deal = await DealService.getDealById(req.params.id, req.user!.userId);
    res.status(200).json({ deal: dealToDTO(deal) });
  } catch (err) {
    res.status(getStatusCode(err)).json(formatErrorResponse(err));
  }
});

router.post('/', authenticate, validateRequest(createDealSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { listingId, initialOfferPrice } = req.body;
    // Convert sheqels to cents
    const initialOfferCents = initialOfferPrice * 100;
    const deal = await DealService.createDeal(req.user!.userId, listingId, initialOfferCents);
    res.status(201).json(dealToDTO(deal));
  } catch (err) {
    res.status(getStatusCode(err)).json(formatErrorResponse(err));
  }
});

router.post('/:id/offer', authenticate, validateRequest(makeOfferSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { price, note } = req.body;
    // Convert sheqels to cents
    const priceCents = price * 100;
    const offer = await DealService.makeOffer(req.params.id, req.user!.userId, priceCents, note);
    res.status(200).json(offerToDTO(offer));
  } catch (err) {
    res.status(getStatusCode(err)).json(formatErrorResponse(err));
  }
});

router.post('/:id/accept/:offerId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const offer = await DealService.acceptOffer(req.params.offerId, req.user!.userId);
    res.status(200).json(offerToDTO(offer));
  } catch (err) {
    res.status(getStatusCode(err)).json(formatErrorResponse(err));
  }
});

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const deal = await DealService.withdrawDeal(req.params.id, req.user!.userId);
    res.status(200).json(dealToDTO(deal));
  } catch (err) {
    res.status(getStatusCode(err)).json(formatErrorResponse(err));
  }
});

export default router;
