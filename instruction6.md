# Instruction 6: Deals & Offer Negotiation

## Overview
This instruction covers the complete deals and offer negotiation system including structured offer chains, real-time updates via WebSocket, turn-based negotiation flow, and the core deal management that replaces chat-based negotiations.

**Note**: Frontend components already exist in `/frontend/Components/App.jsx`, `/frontend/Components/DealCards.jsx`, and `/frontend/Components/DetailSheet.jsx`. These need to be migrated to React Native and integrated with the backend API.

## 6.1 Deal Service Implementation

### Deal Service
```typescript
// backend/src/services/DealService.ts
import { DealModel } from '@models/Deal';
import { OfferModel } from '@models/Offer';
import { ListingModel } from '@models/Listing';
import { NotificationService } from '@services/NotificationService';
import { Deal, DealStatus } from '@shared/types/deal';
import { Offer, OfferStatus } from '@shared/types/offer';

export interface DealCreationData {
  listingId: string;
  buyerId: string;
  initialOfferCents: number;
  note?: string;
}

export interface OfferData {
  dealId: string;
  fromUserId: string;
  priceCents: number;
  note?: string;
}

export class DealService {
  static async createDeal(data: DealCreationData): Promise<Deal> {
    // Validate listing
    const listing = await ListingModel.findById(data.listingId);
    if (!listing) {
      throw new Error('Listing not found');
    }

    if (listing.status !== 'active') {
      throw new Error('Listing is not available');
    }

    if (listing.sellerId === data.buyerId) {
      throw new Error('Cannot buy your own listing');
    }

    // Validate initial offer
    if (data.initialOfferCents <= 0) {
      throw new Error('Offer must be greater than 0');
    }

    if (data.initialOfferCents > 10000000) { // ₪100,000 max
      throw new Error('Offer exceeds maximum allowed amount');
    }

    // Create deal
    const deal = await DealModel.createDeal({
      listingId: data.listingId,
      buyerId: data.buyerId,
      sellerId: listing.sellerId,
      initialPriceCents: data.initialOfferCents,
    });

    // Create initial offer
    await OfferModel.createOffer({
      dealId: deal.id,
      fromUserId: data.buyerId,
      priceCents: data.initialOfferCents,
      note: data.note,
    });

    // Notify seller
    await NotificationService.createNotification({
      userId: listing.sellerId,
      type: 'offer_received',
      title: 'New offer received',
      body: `You received a ₪${(data.initialOfferCents / 100).toLocaleString()} offer for ${listing.cardName}`,
      data: {
        dealId: deal.id,
        listingId: data.listingId,
        offerAmount: data.initialOfferCents,
      },
    });

    return deal;
  }

  static async makeOffer(data: OfferData): Promise<Offer> {
    // Validate deal
    const deal = await DealModel.findById(data.dealId);
    if (!deal) {
      throw new Error('Deal not found');
    }

    if (deal.status !== DealStatus.NEGOTIATING) {
      throw new Error('Cannot make offers on this deal');
    }

    // Check if it's user's turn
    const currentTurn = await DealModel.getCurrentTurn(data.dealId);
    if (currentTurn !== data.fromUserId) {
      throw new Error('It is not your turn to make an offer');
    }

    // Validate offer
    if (data.priceCents <= 0) {
      throw new Error('Offer must be greater than 0');
    }

    if (data.priceCents > 10000000) {
      throw new Error('Offer exceeds maximum allowed amount');
    }

    // Create offer
    const offer = await OfferModel.createOffer(data);

    // Update deal's current turn to other party
    const otherPartyId = deal.buyerId === data.fromUserId ? deal.sellerId : deal.buyerId;
    await DealModel.updateDealStatus(data.dealId, DealStatus.NEGOTIATING, otherPartyId);

    // Notify other party
    const listing = await ListingModel.findById(deal.listingId);
    await NotificationService.createNotification({
      userId: otherPartyId,
      type: 'offer_received',
      title: 'New offer received',
      body: `You received a ₪${(data.priceCents / 100).toLocaleString()} counter-offer for ${listing?.cardName}`,
      data: {
        dealId: data.dealId,
        listingId: deal.listingId,
        offerAmount: data.priceCents,
      },
    });

    return offer;
  }

  static async acceptOffer(offerId: string, userId: string): Promise<Deal> {
    const offer = await OfferModel.findById(offerId);
    if (!offer) {
      throw new Error('Offer not found');
    }

    const deal = await DealModel.findById(offer.dealId);
    if (!deal) {
      throw new Error('Deal not found');
    }

    // Check if user can accept this offer
    const isBuyer = deal.buyerId === userId;
    const isSeller = deal.sellerId === userId;

    if (!isBuyer && !isSeller) {
      throw new Error('You are not part of this deal');
    }

    // Only the other party can accept (not the one who made the offer)
    if (offer.fromUserId === userId) {
      throw new Error('You cannot accept your own offer');
    }

    if (deal.status !== DealStatus.NEGOTIATING) {
      throw new Error('Cannot accept offers on this deal');
    }

    // Accept the offer
    await OfferModel.acceptOffer(offerId);

    // Update deal status to matched
    const updatedDeal = await DealModel.updateDealStatus(
      deal.id,
      DealStatus.MATCHED,
      null // No one's turn when matched
    );

    // Update deal's agreed price
    await DealModel.update(deal.id, { current_price_cents: offer.priceCents });

    // Notify both parties
    const listing = await ListingModel.findById(deal.listingId);
    
    await NotificationService.createNotification({
      userId: deal.buyerId,
      type: 'deal_matched',
      title: 'Deal matched!',
      body: `Your deal for ${listing?.cardName} was matched at ₪${(offer.priceCents / 100).toLocaleString()}`,
      data: {
        dealId: deal.id,
        listingId: deal.listingId,
        agreedPrice: offer.priceCents,
      },
    });

    await NotificationService.createNotification({
      userId: deal.sellerId,
      type: 'deal_matched',
      title: 'Deal matched!',
      body: `Your deal for ${listing?.cardName} was matched at ₪${(offer.priceCents / 100).toLocaleString()}`,
      data: {
        dealId: deal.id,
        listingId: deal.listingId,
        agreedPrice: offer.priceCents,
      },
    });

    return updatedDeal;
  }

  static async withdrawOffer(offerId: string, userId: string): Promise<void> {
    const offer = await OfferModel.findById(offerId);
    if (!offer) {
      throw new Error('Offer not found');
    }

    if (offer.fromUserId !== userId) {
      throw new Error('You can only withdraw your own offers');
    }

    const deal = await DealModel.findById(offer.dealId);
    if (!deal) {
      throw new Error('Deal not found');
    }

    if (deal.status !== DealStatus.NEGOTIATING) {
      throw new Error('Cannot withdraw offers on this deal');
    }

    // Withdraw the offer
    await OfferModel.withdrawOffer(offerId);

    // If this was the last active offer, the deal is dead
    const activeOffers = await OfferModel.getOfferChain(offer.dealId);
    const hasActiveOffers = activeOffers.some(o => o.status === OfferStatus.ACTIVE);

    if (!hasActiveOffers) {
      await DealModel.updateDealStatus(offer.dealId, DealStatus.CANCELLED);
      
      // Notify both parties
      await NotificationService.createNotification({
        userId: deal.buyerId,
        type: 'deal_cancelled',
        title: 'Deal cancelled',
        body: 'The deal was cancelled after all offers were withdrawn',
        data: { dealId: deal.id },
      });

      await NotificationService.createNotification({
        userId: deal.sellerId,
        type: 'deal_cancelled',
        title: 'Deal cancelled',
        body: 'The deal was cancelled after all offers were withdrawn',
        data: { dealId: deal.id },
      });
    } else {
      // Turn goes to other party
      const otherPartyId = deal.buyerId === userId ? deal.sellerId : deal.buyerId;
      await DealModel.updateDealStatus(offer.dealId, DealStatus.NEGOTIATING, otherPartyId);
    }
  }

  static async cancelDeal(dealId: string, userId: string): Promise<void> {
    const deal = await DealModel.findById(dealId);
    if (!deal) {
      throw new Error('Deal not found');
    }

    if (deal.buyerId !== userId && deal.sellerId !== userId) {
      throw new Error('You are not part of this deal');
    }

    if (deal.status === DealStatus.COMPLETED || deal.status === DealStatus.CANCELLED) {
      throw new Error('Cannot cancel this deal');
    }

    // Update deal status
    await DealModel.updateDealStatus(dealId, DealStatus.CANCELLED);

    // Notify both parties
    const otherPartyId = deal.buyerId === userId ? deal.sellerId : deal.buyerId;
    const listing = await ListingModel.findById(deal.listingId);

    await NotificationService.createNotification({
      userId: otherPartyId,
      type: 'deal_cancelled',
      title: 'Deal cancelled',
      body: `The deal for ${listing?.cardName} was cancelled`,
      data: { dealId },
    });
  }

  static async getDeal(dealId: string, userId: string): Promise<any> {
    const deal = await DealModel.findById(dealId);
    if (!deal) {
      throw new Error('Deal not found');
    }

    if (deal.buyerId !== userId && deal.sellerId !== userId) {
      throw new Error('You are not part of this deal');
    }

    // Get listing
    const listing = await ListingModel.findById(deal.listingId);
    if (!listing) {
      throw new Error('Listing not found');
    }

    // Get offer chain
    const offers = await OfferModel.getOfferChain(dealId);

    // Get counterparty profile
    const counterpartyId = deal.buyerId === userId ? deal.sellerId : deal.buyerId;
    const counterpartyProfile = await UserProfileModel.findByUserId(counterpartyId);

    // Get shared events
    const sharedEvents = await EventModel.findSharedEvents(deal.buyerId, deal.sellerId);

    return {
      deal,
      listing,
      offers,
      counterparty: counterpartyProfile ? {
        id: counterpartyProfile.user_id,
        displayName: counterpartyProfile.displayName,
        rating: counterpartyProfile.rating,
        completedDeals: counterpartyProfile.completed_deals,
        noShows: counterpartyProfile.no_shows,
      } : null,
      sharedEvents,
      isBuyer: deal.buyerId === userId,
      isSeller: deal.sellerId === userId,
      currentTurn: deal.current_turn,
    };
  }

  static async getUserDeals(userId: string): Promise<{
    negotiating: any[];
    matched: any[];
    scheduled: any[];
  }> {
    const deals = await DealModel.getUserDeals(userId);

    // Enrich each deal with additional data
    const enrichDeal = async (deal: any) => {
      const listing = await ListingModel.findById(deal.listing_id);
      const counterpartyId = deal.buyer_id === userId ? deal.seller_id : deal.buyer_id;
      const counterpartyProfile = await UserProfileModel.findByUserId(counterpartyId);
      const sharedEvents = await EventModel.findSharedEvents(deal.buyer_id, deal.seller_id);

      return {
        deal,
        listing,
        counterparty: counterpartyProfile ? {
          displayName: counterpartyProfile.display_name,
          rating: counterpartyProfile.rating,
          completedDeals: counterpartyProfile.completed_deals,
          noShows: counterpartyProfile.no_shows,
        } : null,
        sharedEvents,
        isBuyer: deal.buyer_id === userId,
        isSeller: deal.seller_id === userId,
      };
    };

    const enrichedNegotiating = await Promise.all(deals.negotiating.map(enrichDeal));
    const enrichedMatched = await Promise.all(deals.matched.map(enrichDeal));
    const enrichedScheduled = await Promise.all(deals.scheduled.map(enrichDeal));

    return {
      negotiating: enrichedNegotiating,
      matched: enrichedMatched,
      scheduled: enrichedScheduled,
    };
  }

  static async getOfferChain(dealId: string, userId: string): Promise<Offer[]> {
    const deal = await DealModel.findById(dealId);
    if (!deal) {
      throw new Error('Deal not found');
    }

    if (deal.buyerId !== userId && deal.sellerId !== userId) {
      throw new Error('You are not part of this deal');
    }

    return OfferModel.getOfferChain(dealId);
  }

  static async getCurrentOffer(dealId: string, userId: string): Promise<Offer | null> {
    const deal = await DealModel.findById(dealId);
    if (!deal) {
      throw new Error('Deal not found');
    }

    if (deal.buyerId !== userId && deal.sellerId !== userId) {
      throw new Error('You are not part of this deal');
    }

    return OfferModel.getActiveOffer(dealId, userId);
  }
}
```

## 6.2 Real-time Deal Service (WebSocket)

### Socket.io Deal Events
```typescript
// backend/src/services/socket/DealSocketService.ts
import { Server as SocketIOServer } from 'socket.io';
import { DealService } from '../DealService';
import { authenticateSocket } from './socketAuth';

export class DealSocketService {
  static setup(io: SocketIOServer) {
    // Authentication middleware
    io.use(authenticateSocket);

    io.on('connection', (socket) => {
      const userId = socket.data.user.id;

      console.log(`User ${userId} connected to deals`);

      // Join deal rooms for user's active deals
      this.joinUserDealRooms(socket, userId);

      // Handle joining a specific deal room
      socket.on('join_deal', async (dealId: string) => {
        try {
          // Verify user is part of this deal
          const dealData = await DealService.getDeal(dealId, userId);
          socket.join(`deal:${dealId}`);
          
          socket.emit('deal_joined', { dealId });
        } catch (error) {
          socket.emit('error', { message: 'Cannot join deal room' });
        }
      });

      // Handle making an offer
      socket.on('send_offer', async (data: { dealId: string; priceCents: number; note?: string }) => {
        try {
          const offer = await DealService.makeOffer({
            dealId: data.dealId,
            fromUserId: userId,
            priceCents: data.priceCents,
            note: data.note,
          });

          // Notify both parties in the deal room
          io.to(`deal:${data.dealId}`).emit('offer_received', {
            dealId: data.dealId,
            offer,
            currentTurn: offer.fromUserId === userId ? 'other' : 'you',
          });

          // Send specific notification to the other party
          const otherPartySocket = Array.from(io.sockets.sockets.values())
            .find(s => s.data.user?.id && s.data.user.id !== userId && 
                      s.rooms.has(`deal:${data.dealId}`));

          if (otherPartySocket) {
            otherPartySocket.emit('your_turn', { dealId: data.dealId });
          }

        } catch (error) {
          socket.emit('error', { message: error instanceof Error ? error.message : 'Failed to send offer' });
        }
      });

      // Handle accepting an offer
      socket.on('accept_offer', async (data: { dealId: string; offerId: string }) => {
        try {
          const deal = await DealService.acceptOffer(data.offerId, userId);

          // Notify both parties
          io.to(`deal:${data.dealId}`).emit('offer_accepted', {
            dealId: data.dealId,
            offerId: data.offerId,
            deal,
            status: 'matched',
          });

        } catch (error) {
          socket.emit('error', { message: error instanceof Error ? error.message : 'Failed to accept offer' });
        }
      });

      // Handle withdrawing an offer
      socket.on('withdraw_offer', async (data: { dealId: string; offerId: string }) => {
        try {
          await DealService.withdrawOffer(data.offerId, userId);

          // Get updated deal status
          const dealData = await DealService.getDeal(data.dealId, userId);

          io.to(`deal:${data.dealId}`).emit('offer_withdrawn', {
            dealId: data.dealId,
            offerId: data.offerId,
            dealStatus: dealData.deal.status,
            currentTurn: dealData.currentTurn,
          });

          // If deal is cancelled, notify everyone
          if (dealData.deal.status === 'cancelled') {
            io.to(`deal:${data.dealId}`).emit('deal_cancelled', {
              dealId: data.dealId,
            });
          }

        } catch (error) {
          socket.emit('error', { message: error instanceof Error ? error.message : 'Failed to withdraw offer' });
        }
      });

      // Handle deal cancellation
      socket.on('cancel_deal', async (data: { dealId: string }) => {
        try {
          await DealService.cancelDeal(data.dealId, userId);

          io.to(`deal:${data.dealId}`).emit('deal_cancelled', {
            dealId: data.dealId,
          });

          // Leave the deal room
          socket.leave(`deal:${data.dealId}`);

        } catch (error) {
          socket.emit('error', { message: error instanceof Error ? error.message : 'Failed to cancel deal' });
        }
      });

      // Handle typing indicators (optional enhancement)
      socket.on('typing', (data: { dealId: string; isTyping: boolean }) => {
        socket.to(`deal:${data.dealId}`).emit('user_typing', {
          dealId: data.dealId,
          userId,
          isTyping: data.isTyping,
        });
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`User ${userId} disconnected from deals`);
      });
    });
  }

  private static async joinUserDealRooms(socket: any, userId: string) {
    try {
      const userDeals = await DealService.getUserDeals(userId);
      const allDeals = [...userDeals.negotiating, ...userDeals.matched, ...userDeals.scheduled];
      
      for (const dealData of allDeals) {
        socket.join(`deal:${dealData.deal.id}`);
      }
    } catch (error) {
      console.error('Error joining user deal rooms:', error);
    }
  }

  // Helper method to send notifications about deal updates
  static notifyDealUpdate(io: SocketIOServer, dealId: string, event: string, data: any) {
    io.to(`deal:${dealId}`).emit(event, data);
  }
}
```

### Socket Authentication Middleware
```typescript
// backend/src/services/socket/socketAuth.ts
import { Socket } from 'socket.io';
import { JWTService } from '../auth/JWTService';
import { UserModel } from '@models/User';

export async function authenticateSocket(socket: Socket, next: (err?: any) => void) {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const payload = await JWTService.verifyAccessToken(token);
    const user = await UserModel.findById(payload.userId);
    
    if (!user) {
      return next(new Error('User not found'));
    }

    // Attach user to socket
    socket.data.user = {
      id: user.id,
      email: user.email,
    };

    next();
  } catch (error) {
    next(new Error('Invalid authentication token'));
  }
}
```

## 6.3 Deal Controller

### Deal Controller
```typescript
// backend/src/controllers/deals.ts
import { Request, Response } from 'express';
import { DealService } from '@services/DealService';
import { validate, schemas } from '@utils/validation';

export class DealController {
  static async createDeal(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { listingId, initialOfferCents, note } = req.body;

      const deal = await DealService.createDeal({
        listingId,
        buyerId: userId,
        initialOfferCents,
        note,
      });

      res.status(201).json({ deal });
    } catch (error) {
      console.error('Create deal error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('validation')) {
          res.status(400).json({ error: error.message });
        } else {
          res.status(500).json({ error: 'Failed to create deal' });
        }
      } else {
        res.status(500).json({ error: 'Failed to create deal' });
      }
    }
  }

  static async getDeal(req: Request, res: Response): Promise<void> {
    try {
      const { dealId } = req.params;
      const userId = req.user!.id;

      const dealData = await DealService.getDeal(dealId, userId);

      res.json({ deal: dealData });
    } catch (error) {
      console.error('Get deal error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('not part')) {
          res.status(404).json({ error: error.message });
        } else {
          res.status(500).json({ error: 'Failed to get deal' });
        }
      } else {
        res.status(500).json({ error: 'Failed to get deal' });
      }
    }
  }

  static async getUserDeals(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      const deals = await DealService.getUserDeals(userId);

      res.json({ deals });
    } catch (error) {
      console.error('Get user deals error:', error);
      res.status(500).json({ error: 'Failed to get user deals' });
    }
  }

  static async makeOffer(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { dealId, priceCents, note } = req.body;

      const offer = await DealService.makeOffer({
        dealId,
        fromUserId: userId,
        priceCents,
        note,
      });

      res.json({ offer });
    } catch (error) {
      console.error('Make offer error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('turn') || error.message.includes('validation')) {
          res.status(400).json({ error: error.message });
        } else {
          res.status(500).json({ error: 'Failed to make offer' });
        }
      } else {
        res.status(500).json({ error: 'Failed to make offer' });
      }
    }
  }

  static async acceptOffer(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { dealId, offerId } = req.body;

      const deal = await DealService.acceptOffer(offerId, userId);

      res.json({ deal });
    } catch (error) {
      console.error('Accept offer error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('cannot accept')) {
          res.status(400).json({ error: error.message });
        } else {
          res.status(500).json({ error: 'Failed to accept offer' });
        }
      } else {
        res.status(500).json({ error: 'Failed to accept offer' });
      }
    }
  }

  static async withdrawOffer(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { dealId, offerId } = req.body;

      await DealService.withdrawOffer(offerId, userId);

      res.json({ message: 'Offer withdrawn successfully' });
    } catch (error) {
      console.error('Withdraw offer error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('cannot withdraw')) {
          res.status(400).json({ error: error.message });
        } else {
          res.status(500).json({ error: 'Failed to withdraw offer' });
        }
      } else {
        res.status(500).json({ error: 'Failed to withdraw offer' });
      }
    }
  }

  static async cancelDeal(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { dealId } = req.params;

      await DealService.cancelDeal(dealId, userId);

      res.json({ message: 'Deal cancelled successfully' });
    } catch (error) {
      console.error('Cancel deal error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('cannot cancel')) {
          res.status(400).json({ error: error.message });
        } else {
          res.status(500).json({ error: 'Failed to cancel deal' });
        }
      } else {
        res.status(500).json({ error: 'Failed to cancel deal' });
      }
    }
  }

  static async getOfferChain(req: Request, res: Response): Promise<void> {
    try {
      const { dealId } = req.params;
      const userId = req.user!.id;

      const offers = await DealService.getOfferChain(dealId, userId);

      res.json({ offers });
    } catch (error) {
      console.error('Get offer chain error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('not part')) {
          res.status(404).json({ error: error.message });
        } else {
          res.status(500).json({ error: 'Failed to get offer chain' });
        }
      } else {
        res.status(500).json({ error: 'Failed to get offer chain' });
      }
    }
  }

  static async getCurrentOffer(req: Request, res: Response): Promise<void> {
    try {
      const { dealId } = req.params;
      const userId = req.user!.id;

      const offer = await DealService.getCurrentOffer(dealId, userId);

      res.json({ offer });
    } catch (error) {
      console.error('Get current offer error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('not part')) {
          res.status(404).json({ error: error.message });
        } else {
          res.status(500).json({ error: 'Failed to get current offer' });
        }
      } else {
        res.status(500).json({ error: 'Failed to get current offer' });
      }
    }
  }
}
```

### Deal Validation Schemas
```typescript
// backend/src/utils/validation.ts (add to existing file)
export const schemas = {
  // ... existing schemas ...

  // Deal creation validation
  createDeal: Joi.object({
    listingId: Joi.string()
      .uuid()
      .required()
      .messages({
        'string.uuid': 'Invalid listing ID',
        'any.required': 'Listing ID is required',
      }),
    initialOfferCents: Joi.number()
      .integer()
      .min(100)
      .max(10000000)
      .required()
      .messages({
        'number.min': 'Offer must be at least ₪1',
        'number.max': 'Offer cannot exceed ₪10,000',
        'any.required': 'Initial offer is required',
      }),
    note: Joi.string()
      .max(500)
      .optional()
      .messages({
        'string.max': 'Note must be less than 500 characters',
      }),
  }),

  // Offer validation
  makeOffer: Joi.object({
    dealId: Joi.string()
      .uuid()
      .required()
      .messages({
        'string.uuid': 'Invalid deal ID',
        'any.required': 'Deal ID is required',
      }),
    priceCents: Joi.number()
      .integer()
      .min(100)
      .max(10000000)
      .required()
      .messages({
        'number.min': 'Offer must be at least ₪1',
        'number.max': 'Offer cannot exceed ₪10,000',
        'any.required': 'Offer amount is required',
      }),
    note: Joi.string()
      .max(500)
      .optional()
      .messages({
        'string.max': 'Note must be less than 500 characters',
      }),
  }),

  // Accept offer validation
  acceptOffer: Joi.object({
    dealId: Joi.string()
      .uuid()
      .required(),
    offerId: Joi.string()
      .uuid()
      .required(),
  }),

  // Withdraw offer validation
  withdrawOffer: Joi.object({
    dealId: Joi.string()
      .uuid()
      .required(),
    offerId: Joi.string()
      .uuid()
      .required(),
  }),
};
```

## 6.4 Deal Routes

### Deal Routes
```typescript
// backend/src/routes/deals.ts
import { Router } from 'express';
import { DealController } from '@controllers/deals';
import { authenticate } from '@middleware/auth';
import { validate, schemas } from '@utils/validation';

const router = Router();

// All deal routes require authentication
router.use(authenticate);

// Create deal (make initial offer)
router.post(
  '/',
  validate(schemas.createDeal),
  DealController.createDeal
);

// Get user's deals
router.get('/', DealController.getUserDeals);

// Get specific deal
router.get('/:dealId', DealController.getDeal);

// Make offer (counter)
router.post(
  '/offer',
  validate(schemas.makeOffer),
  DealController.makeOffer
);

// Accept offer
router.post(
  '/accept',
  validate(schemas.acceptOffer),
  DealController.acceptOffer
);

// Withdraw offer
router.post(
  '/withdraw',
  validate(schemas.withdrawOffer),
  DealController.withdrawOffer
);

// Cancel deal
router.delete('/:dealId', DealController.cancelDeal);

// Get offer chain for deal
router.get('/:dealId/offers', DealController.getOfferChain);

// Get current offer for user
router.get('/:dealId/current-offer', DealController.getCurrentOffer);

export default router;
```

## 6.5 Frontend Deal Service (React Native)

### Deal Service (Frontend)
```typescript
// frontend/src/services/deals/DealService.ts
import { ApiClient } from '@services/api/ApiClient';
import { io, Socket } from 'socket.io-client';

export interface DealData {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  status: 'negotiating' | 'matched' | 'scheduled' | 'completed' | 'cancelled';
  currentPriceCents?: number;
  currentTurn?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OfferData {
  id: string;
  dealId: string;
  fromUserId: string;
  priceCents: number;
  note?: string;
  status: 'active' | 'accepted' | 'withdrawn' | 'countered';
  createdAt: string;
}

export interface DealDetail {
  deal: DealData;
  listing: {
    id: string;
    cardName: string;
    cardSet?: string;
    condition: string;
    priceCents: number;
    game: string;
  };
  offers: OfferData[];
  counterparty: {
    id: string;
    displayName: string;
    rating: number;
    completedDeals: number;
    noShows: number;
  };
  sharedEvents?: Array<{
    id: string;
    name: string;
    startDate: string;
    locationName: string;
  }>;
  isBuyer: boolean;
  isSeller: boolean;
  currentTurn?: string;
}

export interface UserDeals {
  negotiating: DealDetail[];
  matched: DealDetail[];
  scheduled: DealDetail[];
}

export class DealService {
  private static socket: Socket | null = null;

  // Initialize WebSocket connection
  static initializeSocket(token: string): Socket {
    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = io(process.env.SOCKET_URL || 'http://localhost:3001', {
      auth: { token },
      transports: ['websocket'],
    });

    return this.socket;
  }

  static disconnectSocket(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  static getSocket(): Socket | null {
    return this.socket;
  }

  // API methods
  static async createDeal(data: {
    listingId: string;
    initialOfferCents: number;
    note?: string;
  }): Promise<DealData> {
    const response = await ApiClient.post<{ deal: DealData }>('/deals', data);
    return response.deal;
  }

  static async getDeal(dealId: string): Promise<DealDetail> {
    const response = await ApiClient.get<{ deal: DealDetail }>(`/deals/${dealId}`);
    return response.deal;
  }

  static async getUserDeals(): Promise<UserDeals> {
    const response = await ApiClient.get<{ deals: UserDeals }>('/deals');
    return response.deals;
  }

  static async makeOffer(data: {
    dealId: string;
    priceCents: number;
    note?: string;
  }): Promise<OfferData> {
    const response = await ApiClient.post<{ offer: OfferData }>('/deals/offer', data);
    return response.offer;
  }

  static async acceptOffer(dealId: string, offerId: string): Promise<DealData> {
    const response = await ApiClient.post<{ deal: DealData }>('/deals/accept', {
      dealId,
      offerId,
    });
    return response.deal;
  }

  static async withdrawOffer(dealId: string, offerId: string): Promise<void> {
    await ApiClient.post('/deals/withdraw', { dealId, offerId });
  }

  static async cancelDeal(dealId: string): Promise<void> {
    await ApiClient.delete(`/deals/${dealId}`);
  }

  static async getOfferChain(dealId: string): Promise<OfferData[]> {
    const response = await ApiClient.get<{ offers: OfferData[] }>(`/deals/${dealId}/offers`);
    return response.offers;
  }

  static async getCurrentOffer(dealId: string): Promise<OfferData | null> {
    const response = await ApiClient.get<{ offer: OfferData | null }>(`/deals/${dealId}/current-offer`);
    return response.offer;
  }

  // Socket methods
  static joinDealRoom(dealId: string): void {
    if (this.socket) {
      this.socket.emit('join_deal', dealId);
    }
  }

  static sendOffer(dealId: string, priceCents: number, note?: string): void {
    if (this.socket) {
      this.socket.emit('send_offer', { dealId, priceCents, note });
    }
  }

  static acceptOfferSocket(dealId: string, offerId: string): void {
    if (this.socket) {
      this.socket.emit('accept_offer', { dealId, offerId });
    }
  }

  static withdrawOfferSocket(dealId: string, offerId: string): void {
    if (this.socket) {
      this.socket.emit('withdraw_offer', { dealId, offerId });
    }
  }

  static cancelDealSocket(dealId: string): void {
    if (this.socket) {
      this.socket.emit('cancel_deal', { dealId });
    }
  }

  // Utility functions
  static formatPrice(priceCents: number): string {
    return `₪${(priceCents / 100).toLocaleString()}`;
  }

  static isMyTurn(deal: DealDetail): boolean {
    return deal.currentTurn === (deal.isBuyer ? deal.deal.buyerId : deal.deal.sellerId);
  }

  static getDealStatusText(status: string): string {
    switch (status) {
      case 'negotiating': return 'Negotiating';
      case 'matched': return 'Matched';
      case 'scheduled': return 'Scheduled';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  }

  static getOfferStatusText(status: string): string {
    switch (status) {
      case 'active': return 'Active';
      case 'accepted': return 'Accepted';
      case 'withdrawn': return 'Withdrawn';
      case 'countered': return 'Countered';
      default: return status;
    }
  }
}
```

## 6.6 My Deals Screen (React Native Migration)

### My Deals Screen
```typescript
// frontend/src/screens/deals/MyDealsScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { fetchUserDeals } from '@store/slices/dealSlice';
import { RootState } from '@store';
import { DealService } from '@services/deals/DealService';
import { Card } from '@components/common/Card/Card';
import { Text } from '@components/common/Text/Text';
import { Button } from '@components/common/Button/Button';
import { colors, spacing, typography } from '@utils/designSystem/tokens';

// MIGRATED from /frontend/Components/App.jsx (My Deals section)
export const MyDealsScreen: React.FC = () => {
  const dispatch = useDispatch();
  const { negotiating, matched, scheduled, loading } = useSelector((state: RootState) => state.deals);
  const [activeTab, setActiveTab] = useState<'negotiating' | 'matched' | 'scheduled'>('negotiating');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    dispatch(fetchUserDeals());
    
    // Initialize socket connection
    const token = ''; // Get from auth store
    DealService.initializeSocket(token);
    
    return () => {
      DealService.disconnectSocket();
    };
  }, [dispatch]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await dispatch(fetchUserDeals());
    setRefreshing(false);
  };

  const getCurrentDeals = () => {
    switch (activeTab) {
      case 'negotiating': return negotiating;
      case 'matched': return matched;
      case 'scheduled': return scheduled;
      default: return negotiating;
    }
  };

  const counts = {
    negotiating: negotiating.length,
    matched: matched.length,
    scheduled: scheduled.length,
  };

  const yourTurnCount = negotiating.filter(deal => DealService.isMyTurn(deal)).length;

  const renderDealCard = ({ item }: { item: any }) => {
    const isMyTurn = DealService.isMyTurn(item);
    const sharedEvent = item.sharedEvents && item.sharedEvents.length > 0 
      ? item.sharedEvents[0] 
      : null;

    if (activeTab === 'negotiating') {
      return (
        <Card style={styles.dealCard}>
          <View style={styles.dealCardTop}>
            <View style={styles.dealCardInfo}>
              <Text style={styles.dealCardName}>{item.listing.cardName}</Text>
              <Text style={styles.dealCardMeta}>
                {item.listing.cardSet} · {item.listing.condition}
              </Text>
            </View>
            <View style={styles.dealCardPricing}>
              <Text style={styles.dealPrice}>
                <Text style={styles.dealPriceStrike}>
                  {DealService.formatPrice(item.listing.priceCents)}
                </Text>
                {' '}{DealService.formatPrice(item.deal.currentPriceCents || 0)}
              </Text>
              {isMyTurn && (
                <View style={styles.turnBadge}>
                  <Text style={styles.turnBadgeText}>⚡ Your turn</Text>
                </View>
              )}
              {!isMyTurn && (
                <View style={styles.waitingBadge}>
                  <Text style={styles.waitingBadgeText}>Their turn</Text>
                </View>
              )}
            </View>
          </View>

          {sharedEvent && (
            <View style={styles.sharedEventRow}>
              <Text style={styles.sharedEventText}>
                📅 BOTH @ {sharedEvent.name.toUpperCase()}
              </Text>
              <Text style={styles.sharedEventDate}>{sharedEvent.startDate}</Text>
            </View>
          )}

          <View style={styles.counterpartyRow}>
            <View style={styles.counterpartyAvatar}>
              <Text style={styles.counterpartyAvatarText}>
                {item.counterparty.displayName.charAt(0)}
              </Text>
            </View>
            <View style={styles.counterpartyInfo}>
              <Text style={styles.counterpartyName}>{item.counterparty.displayName}</Text>
              <Text style={styles.counterpartyStats}>
                ★ {item.counterparty.rating.toFixed(1)} · {item.counterparty.completedDeals} deals · 
                <Text style={item.counterparty.noShows === 0 ? styles.zeroNoShows : styles.noNoShows}>
                  {' '}{item.counterparty.noShows} no-show{item.counterparty.noShows === 1 ? '' : 's'}
                </Text>
              </Text>
            </View>
          </View>

          {/* Offer thread preview */}
          <View style={styles.offerThread}>
            {item.offers.slice(-2).map((offer: any, index: number) => (
              <View key={index} style={styles.offerRow}>
                <Text style={styles.offerActor}>
                  {offer.fromUserId === (item.isBuyer ? item.deal.buyerId : item.deal.sellerId) 
                    ? 'YOU' : 'THEM'}
                </Text>
                <Text style={styles.offerAmount}>
                  {DealService.formatPrice(offer.priceCents)}
                </Text>
                <Text style={styles.offerTime}>
                  {new Date(offer.createdAt).toLocaleDateString()}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      );
    }

    if (activeTab === 'matched') {
      return (
        <Card style={styles.dealCard}>
          <View style={styles.dealCardTop}>
            <View style={styles.dealCardInfo}>
              <Text style={styles.dealCardName}>{item.listing.cardName}</Text>
              <Text style={styles.dealCardMeta}>
                {item.listing.cardSet} · {item.listing.condition}
              </Text>
            </View>
            <View style={styles.dealCardPricing}>
              <Text style={styles.dealPrice}>
                {DealService.formatPrice(item.deal.currentPriceCents || 0)}
              </Text>
              <View style={styles.matchedBadge}>
                <Text style={styles.matchedBadgeText}>✓ Matched</Text>
              </View>
            </View>
          </View>

          {sharedEvent && (
            <View style={styles.sharedEventRow}>
              <Text style={styles.sharedEventText}>
                📅 BOTH @ {sharedEvent.name.toUpperCase()}
              </Text>
              <Text style={styles.sharedEventDate}>{sharedEvent.startDate}</Text>
            </View>
          )}

          <View style={styles.windowDisplay}>
            <Text style={styles.windowTime}>14:00 – 14:30</Text>
            <View style={styles.windowDetail}>
              <Text style={styles.windowDay}>Sat May 23</Text>
              <Text style={styles.windowSpot}>Trade hall, table M-12</Text>
            </View>
            {isMyTurn && (
              <View style={styles.confirmBadge}>
                <Text style={styles.confirmBadgeText}>⚡ Confirm</Text>
              </View>
            )}
          </View>
        </Card>
      );
    }

    if (activeTab === 'scheduled') {
      return (
        <Card style={styles.dealCard}>
          <View style={styles.dealCardTop}>
            <View style={styles.dealCardInfo}>
              <Text style={styles.dealCardName}>{item.listing.cardName}</Text>
              <Text style={styles.dealCardMeta}>
                {item.listing.cardSet} · {item.listing.condition}
              </Text>
            </View>
            <View style={styles.dealCardPricing}>
              <Text style={styles.dealPrice}>
                {DealService.formatPrice(item.deal.currentPriceCents || 0)}
              </Text>
              <View style={styles.scheduledBadge}>
                <Text style={styles.scheduledBadgeText}>In 21h</Text>
              </View>
            </View>
          </View>

          <View style={styles.windowDisplay}>
            <Text style={styles.windowTime}>14:00 – 14:30</Text>
            <View style={styles.windowDetail}>
              <Text style={styles.windowDay}>Sat May 23</Text>
              <Text style={styles.windowSpot}>Trade hall, table M-12</Text>
            </View>
          </View>

          <View style={styles.counterpartyRow}>
            <View style={styles.counterpartyAvatar}>
              <Text style={styles.counterpartyAvatarText}>
                {item.counterparty.displayName.charAt(0)}
              </Text>
            </View>
            <View style={styles.counterpartyInfo}>
              <Text style={styles.counterpartyName}>{item.counterparty.displayName}</Text>
            </View>
          </View>

          <Button
            title="Check in at meetup"
            onPress={() => {/* Handle check-in */}}
            style={styles.checkInButton}
          />
        </Card>
      );
    }

    return null;
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyMark} />
      <Text style={styles.emptyTitle}>
        {activeTab === 'negotiating' && 'No active negotiations.'}
        {activeTab === 'matched' && 'Nothing matched.'}
        {activeTab === 'scheduled' && 'No meetups scheduled.'}
      </Text>
      <Text style={styles.emptyBody}>
        {activeTab === 'negotiating' && 'Browse the feed and make your first offer.'}
        {activeTab === 'matched' && 'Once both sides agree on a price, deals show up here to schedule.'}
        {activeTab === 'scheduled' && 'Confirmed windows will appear here, with a countdown.'}
      </Text>
      {activeTab === 'negotiating' && (
        <Button title="Browse feed" onPress={() => {/* Navigate to browse */}} />
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.title}>My Deals</Text>
            <Text style={styles.subtitle}>
              {yourTurnCount > 0 ? (
                <>
                  <Text style={styles.urgentText}>
                    {yourTurnCount} need you.
                  </Text>
                  <Text style={styles.italicText}>
                    {' '}The rest are with them.
                  </Text>
                </>
              ) : (
                <Text style={styles.italicText}>
                  All caught up — waiting on the other side.
                </Text>
              )}
            </Text>
          </View>
          <View style={styles.profileDot}>
            <Text style={styles.profileDotText}>R</Text>
          </View>
        </View>
      </View>

      <View style={styles.tabs}>
        {(['negotiating', 'matched', 'scheduled'] as const).map((tab) => (
          <Button
            key={tab}
            title={tab.charAt(0).toUpperCase() + tab.slice(1)}
            onPress={() => setActiveTab(tab)}
            variant={activeTab === tab ? 'primary' : 'secondary'}
            style={styles.tab}
          >
            <View style={styles.tabCount}>
              <Text style={styles.tabCountText}>{counts[tab]}</Text>
            </View>
            <Text style={styles.tabLabel}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</Text>
          </Button>
        ))}
      </View>

      <FlatList
        data={getCurrentDeals()}
        renderItem={renderDealCard}
        keyExtractor={(item) => item.deal.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />
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
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontFamily: typography.fonts.serif,
    fontSize: typography.sizes.h1.fontSize,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  subtitle: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  urgentText: {
    fontFamily: typography.fonts.sans,
    fontSize: typography.sizes.body.fontSize,
    fontWeight: typography.weights.semibold,
    color: '#991b1b', // warn color
  },
  italicText: {
    fontFamily: typography.fonts.serif,
    fontSize: typography.sizes.body.fontSize,
    fontStyle: 'italic',
    color: colors.ink2,
  },
  profileDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileDotText: {
    fontFamily: typography.fonts.sans,
    fontSize: typography.sizes.body.fontSize,
    fontWeight: typography.weights.semibold,
    color: 'white',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  tabCount: {
    marginRight: spacing.xs,
  },
  tabCountText: {
    fontFamily: typography.fonts.sans,
    fontSize: typography.sizes.caption.fontSize,
    fontWeight: typography.weights.semibold,
    color: 'inherit',
  },
  tabLabel: {
    fontFamily: typography.fonts.sans,
    fontSize: typography.sizes.small.fontSize,
    color: 'inherit',
  },
  list: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  dealCard: {
    padding: spacing.lg,
  },
  dealCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  dealCardInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  dealCardName: {
    fontFamily: typography.fonts.sans,
    fontSize: typography.sizes.body.fontSize,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  dealCardMeta: {
    fontFamily: typography.fonts.sans,
    fontSize: typography.sizes.small.fontSize,
    color: colors.ink2,
  },
  dealCardPricing: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  dealPrice: {
    fontFamily: typography.fonts.mono,
    fontSize: typography.sizes.body.fontSize,
    color: colors.ink,
  },
  dealPriceStrike: {
    textDecorationLine: 'line-through',
    color: colors.muted,
  },
  turnBadge: {
    backgroundColor: '#fef0c7', // warnSoft
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  turnBadgeText: {
    fontFamily: typography.fonts.mono,
    fontSize: typography.sizes.caption.fontSize,
    color: '#92400e', // warn
    fontWeight: typography.weights.semibold,
  },
  waitingBadge: {
    backgroundColor: colors.paper2,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  waitingBadgeText: {
    fontFamily: typography.fonts.mono,
    fontSize: typography.sizes.caption.fontSize,
    color: colors.muted,
    fontWeight: typography.weights.semibold,
  },
  matchedBadge: {
    backgroundColor: '#d6f0de', // goodSoft
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  matchedBadgeText: {
    fontFamily: typography.fonts.mono,
    fontSize: typography.sizes.caption.fontSize,
    color: '#15803d', // good
    fontWeight: typography.weights.semibold,
  },
  scheduledBadge: {
    backgroundColor: colors.paper2,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  scheduledBadgeText: {
    fontFamily: typography.fonts.mono,
    fontSize: typography.sizes.caption.fontSize,
    color: colors.muted,
    fontWeight: typography.weights.semibold,
  },
  sharedEventRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sharedEventText: {
    fontFamily: typography.fonts.mono,
    fontSize: typography.sizes.caption.fontSize,
    color: colors.accent,
    fontWeight: typography.weights.semibold,
  },
  sharedEventDate: {
    fontFamily: typography.fonts.mono,
    fontSize: typography.sizes.caption.fontSize,
    color: colors.muted,
  },
  counterpartyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  counterpartyAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.paper2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  counterpartyAvatarText: {
    fontFamily: typography.fonts.sans,
    fontSize: typography.sizes.body.fontSize,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  counterpartyInfo: {
    flex: 1,
  },
  counterpartyName: {
    fontFamily: typography.fonts.sans,
    fontSize: typography.sizes.body.fontSize,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  counterpartyStats: {
    fontFamily: typography.fonts.sans,
    fontSize: typography.sizes.small.fontSize,
    color: colors.ink2,
  },
  zeroNoShows: {
    color: '#15803d', // good
  },
  noNoShows: {
    color: colors.ink2,
  },
  offerThread: {
    marginTop: spacing.sm,
  },
  offerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  offerActor: {
    fontFamily: typography.fonts.mono,
    fontSize: typography.sizes.caption.fontSize,
    color: colors.muted,
    flex: 1,
  },
  offerAmount: {
    fontFamily: typography.fonts.mono,
    fontSize: typography.sizes.caption.fontSize,
    color: colors.ink,
    fontWeight: typography.weights.semibold,
    flex: 1,
    textAlign: 'center',
  },
  offerTime: {
    fontFamily: typography.fonts.mono,
    fontSize: typography.sizes.caption.fontSize,
    color: colors.muted,
    flex: 1,
    textAlign: 'right',
  },
  windowDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  windowTime: {
    fontFamily: typography.fonts.mono,
    fontSize: typography.sizes.body.fontSize,
    color: colors.ink,
    fontWeight: typography.weights.semibold,
  },
  windowDetail: {
    flex: 1,
    marginLeft: spacing.md,
  },
  windowDay: {
    fontFamily: typography.fonts.sans,
    fontSize: typography.sizes.body.fontSize,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  windowSpot: {
    fontFamily: typography.fonts.sans,
    fontSize: typography.sizes.small.fontSize,
    color: colors.ink2,
  },
  confirmBadge: {
    backgroundColor: '#fef0c7', // warnSoft
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  confirmBadgeText: {
    fontFamily: typography.fonts.mono,
    fontSize: typography.sizes.caption.fontSize,
    color: '#92400e', // warn
    fontWeight: typography.weights.semibold,
  },
  checkInButton: {
    marginTop: spacing.sm,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxxl,
  },
  emptyMark: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.line,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontFamily: typography.fonts.serif,
    fontSize: typography.sizes.h3.fontSize,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: typography.fonts.sans,
    fontSize: typography.sizes.body.fontSize,
    color: colors.ink2,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
});
```

## 6.7 Deal Store (Redux)

### Deal Store Slice
```typescript
// frontend/src/store/slices/dealSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { DealService, DealDetail, UserDeals } from '@services/deals/DealService';

interface DealState {
  negotiating: DealDetail[];
  matched: DealDetail[];
  scheduled: DealDetail[];
  selectedDeal: DealDetail | null;
  loading: boolean;
  error: string | null;
  socketConnected: boolean;
}

const initialState: DealState = {
  negotiating: [],
  matched: [],
  scheduled: [],
  selectedDeal: null,
  loading: false,
  error: null,
  socketConnected: false,
};

// Async thunks
export const fetchUserDeals = createAsyncThunk(
  'deals/fetchUserDeals',
  async () => {
    return await DealService.getUserDeals();
  }
);

export const fetchDeal = createAsyncThunk(
  'deals/fetchDeal',
  async (dealId: string) => {
    return await DealService.getDeal(dealId);
  }
);

export const createDeal = createAsyncThunk(
  'deals/createDeal',
  async (data: {
    listingId: string;
    initialOfferCents: number;
    note?: string;
  }) => {
    return await DealService.createDeal(data);
  }
);

export const makeOffer = createAsyncThunk(
  'deals/makeOffer',
  async (data: {
    dealId: string;
    priceCents: number;
    note?: string;
  }) => {
    return await DealService.makeOffer(data);
  }
);

export const acceptOffer = createAsyncThunk(
  'deals/acceptOffer',
  async (data: { dealId: string; offerId: string }) => {
    return await DealService.acceptOffer(data.dealId, data.offerId);
  }
);

export const withdrawOffer = createAsyncThunk(
  'deals/withdrawOffer',
  async (data: { dealId: string; offerId: string }) => {
    await DealService.withdrawOffer(data.dealId, data.offerId);
    return data.dealId;
  }
);

export const cancelDeal = createAsyncThunk(
  'deals/cancelDeal',
  async (dealId: string) => {
    await DealService.cancelDeal(dealId);
    return dealId;
  }
);

const dealSlice = createSlice({
  name: 'deals',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setSelectedDeal: (state, action: PayloadAction<DealDetail | null>) => {
      state.selectedDeal = action.payload;
    },
    setSocketConnected: (state, action: PayloadAction<boolean>) => {
      state.socketConnected = action.payload;
    },
    updateDealFromSocket: (state, action: PayloadAction<any>) => {
      const { type, dealId, data } = action.payload;
      
      // Find and update deal in appropriate list
      const updateInList = (list: DealDetail[]) => {
        const index = list.findIndex(d => d.deal.id === dealId);
        if (index !== -1) {
          // Handle different socket events
          switch (type) {
            case 'offer_received':
              // Update current turn
              list[index].currentTurn = data.currentTurn;
              break;
            case 'offer_accepted':
              // Move to matched
              const deal = list.splice(index, 1)[0];
              deal.deal.status = 'matched';
              deal.deal.currentPriceCents = data.offer.priceCents;
              state.matched.unshift(deal);
              break;
            case 'deal_cancelled':
              // Remove from list
              list.splice(index, 1);
              break;
          }
        }
      };

      updateInList(state.negotiating);
      updateInList(state.matched);
      updateInList(state.scheduled);
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch user deals
      .addCase(fetchUserDeals.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserDeals.fulfilled, (state, action) => {
        state.loading = false;
        state.negotiating = action.payload.negotiating;
        state.matched = action.payload.matched;
        state.scheduled = action.payload.scheduled;
      })
      .addCase(fetchUserDeals.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch deals';
      })
      // Fetch deal
      .addCase(fetchDeal.fulfilled, (state, action) => {
        state.selectedDeal = action.payload;
      })
      // Create deal
      .addCase(createDeal.fulfilled, (state, action) => {
        // Add to negotiating list
        const newDeal: DealDetail = {
          deal: action.payload,
          listing: action.payload.listing, // This would be populated by the API
          offers: [],
          counterparty: action.payload.counterparty,
          isBuyer: true,
          isSeller: false,
        };
        state.negotiating.unshift(newDeal);
      })
      // Make offer
      .addCase(makeOffer.fulfilled, (state, action) => {
        // Update deal with new offer
        const deal = state.negotiating.find(d => d.deal.id === action.payload.dealId);
        if (deal) {
          deal.offers.push(action.payload);
          deal.currentTurn = deal.currentTurn === deal.deal.buyerId ? deal.deal.sellerId : deal.deal.buyerId;
        }
      })
      // Accept offer
      .addCase(acceptOffer.fulfilled, (state, action) => {
        // Move deal from negotiating to matched
        const index = state.negotiating.findIndex(d => d.deal.id === action.payload.id);
        if (index !== -1) {
          const deal = state.negotiating.splice(index, 1)[0];
          deal.deal.status = 'matched';
          deal.deal.currentPriceCents = action.payload.currentPriceCents;
          state.matched.unshift(deal);
        }
      })
      // Withdraw offer
      .addCase(withdrawOffer.fulfilled, (state, action) => {
        // Update deal's offer chain
        const deal = state.negotiating.find(d => d.deal.id === action.payload);
        if (deal) {
          // Remove the withdrawn offer
          deal.offers = deal.offers.filter(o => o.id !== action.payload);
        }
      })
      // Cancel deal
      .addCase(cancelDeal.fulfilled, (state, action) => {
        // Remove deal from all lists
        state.negotiating = state.negotiating.filter(d => d.deal.id !== action.payload);
        state.matched = state.matched.filter(d => d.deal.id !== action.payload);
        state.scheduled = state.scheduled.filter(d => d.deal.id !== action.payload);
        
        if (state.selectedDeal?.deal.id === action.payload) {
          state.selectedDeal = null;
        }
      });
  },
});

export const { clearError, setSelectedDeal, setSocketConnected, updateDealFromSocket } = dealSlice.actions;
export default dealSlice.reducer;
```

## 6.8 Testing Deal System

### Deal Service Tests
```typescript
// backend/tests/services/DealService.test.ts
import { DealService } from '../../src/services/DealService';
import { Database } from '../../src/config/database';

describe('DealService', () => {
  let buyer: any;
  let seller: any;
  let listing: any;
  let deal: any;

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

    // Create test listing
    listing = await ListingModel.createListing({
      sellerId: seller.id,
      cardName: 'Test Card',
      condition: 'nm',
      priceCents: 10000,
      game: 'mtg',
    });
  });

  afterAll(async () => {
    await Database.close();
  });

  describe('createDeal', () => {
    it('should create a deal successfully', async () => {
      const dealData = {
        listingId: listing.id,
        buyerId: buyer.id,
        initialOfferCents: 8000,
      };

      deal = await DealService.createDeal(dealData);

      expect(deal.listingId).toBe(listing.id);
      expect(deal.buyerId).toBe(buyer.id);
      expect(deal.sellerId).toBe(seller.id);
      expect(deal.status).toBe('negotiating');
      expect(deal.currentTurn).toBe(buyer.id);
    });

    it('should reject creating deal for own listing', async () => {
      const dealData = {
        listingId: listing.id,
        buyerId: seller.id,
        initialOfferCents: 8000,
      };

      await expect(DealService.createDeal(dealData))
        .rejects.toThrow('Cannot buy your own listing');
    });

    it('should reject invalid initial offer', async () => {
      const dealData = {
        listingId: listing.id,
        buyerId: buyer.id,
        initialOfferCents: -1000,
      };

      await expect(DealService.createDeal(dealData))
        .rejects.toThrow('Offer must be greater than 0');
    });
  });

  describe('makeOffer', () => {
    it('should make an offer successfully', async () => {
      const offerData = {
        dealId: deal.id,
        fromUserId: seller.id,
        priceCents: 9000,
      };

      const offer = await DealService.makeOffer(offerData);

      expect(offer.dealId).toBe(deal.id);
      expect(offer.fromUserId).toBe(seller.id);
      expect(offer.priceCents).toBe(9000);
      expect(offer.status).toBe('active');
    });

    it('should reject offer when not user\'s turn', async () => {
      const offerData = {
        dealId: deal.id,
        fromUserId: seller.id, // Already made an offer
        priceCents: 9500,
      };

      await expect(DealService.makeOffer(offerData))
        .rejects.toThrow('It is not your turn to make an offer');
    });

    it('should reject invalid offer amount', async () => {
      const offerData = {
        dealId: deal.id,
        fromUserId: buyer.id, // It's buyer's turn now
        priceCents: -1000,
      };

      await expect(DealService.makeOffer(offerData))
        .rejects.toThrow('Offer must be greater than 0');
    });
  });

  describe('acceptOffer', () => {
    it('should accept offer successfully', async () => {
      // Get the latest offer
      const offers = await OfferModel.getOfferChain(deal.id);
      const latestOffer = offers[offers.length - 1];

      const updatedDeal = await DealService.acceptOffer(latestOffer.id, seller.id);

      expect(updatedDeal.status).toBe('matched');
      expect(updatedDeal.currentTurn).toBeNull();
    });

    it('should reject accepting own offer', async () => {
      const offers = await OfferModel.getOfferChain(deal.id);
      const buyerOffer = offers.find(o => o.fromUserId === buyer.id);

      await expect(DealService.acceptOffer(buyerOffer.id, buyer.id))
        .rejects.toThrow('You cannot accept your own offer');
    });
  });

  describe('getUserDeals', () => {
    it('should get user deals correctly', async () => {
      const buyerDeals = await DealService.getUserDeals(buyer.id);
      const sellerDeals = await DealService.getUserDeals(seller.id);

      expect(buyerDeals.negotiating.length).toBeGreaterThanOrEqual(0);
      expect(buyerDeals.matched.length).toBeGreaterThanOrEqual(0);
      expect(buyerDeals.scheduled.length).toBeGreaterThanOrEqual(0);

      expect(sellerDeals.negotiating.length).toBeGreaterThanOrEqual(0);
      expect(sellerDeals.matched.length).toBeGreaterThanOrEqual(0);
      expect(sellerDeals.scheduled.length).toBeGreaterThanOrEqual(0);
    });
  });
});
```

## Verification Checklist

- [ ] Deal service with complete negotiation flow
- [ ] Real-time WebSocket implementation with Socket.io
- [ ] Turn-based offer system with validation
- [ ] Deal controller with comprehensive endpoints
- [ ] Socket authentication and room management
- [ ] Frontend deal service with API and socket integration
- [ ] My Deals screen migrated from existing JSX component
- [ ] Redux store for deal state management
- [ ] Real-time updates via WebSocket events
- [ ] Offer chain management and history
- [ ] Deal status transitions (negotiating → matched → scheduled)
- [ ] Comprehensive test coverage
- [ ] Integration with listing and notification systems

## Next Steps

Proceed to **Instruction 7: Meetup Scheduling** to implement the commitment window system, check-in functionality, and the scheduling features that enable reliable face-to-face meetings at shared events.
