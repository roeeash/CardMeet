import { BaseModel } from '../BaseModel';
import { Offer } from '@shared/types/offer';

export class OfferModel extends BaseModel {
  static tableName = 'offers';

  static async createOffer(offerData: {
    dealId: string;
    fromUserId: string;
    priceCents: number;
    note?: string;
  }): Promise<Offer> {
    // First, mark all previous offers from this user as withdrawn
    await this.db(this.tableName)
      .where('deal_id', offerData.dealId)
      .where('from_user_id', offerData.fromUserId)
      .where('status', 'active')
      .update({
        status: 'withdrawn',
        updated_at: new Date(),
      });

    // Create new offer
    const [offer] = await this.db(this.tableName)
      .insert({
        deal_id: offerData.dealId,
        from_user_id: offerData.fromUserId,
        price_cents: offerData.priceCents,
        note: offerData.note,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    
    return offer;
  }

  static async getOfferChain(dealId: string): Promise<Offer[]> {
    return this.db(this.tableName)
      .where('deal_id', dealId)
      .orderBy('created_at', 'asc');
  }

  static async acceptOffer(offerId: string): Promise<Offer> {
    // Mark this offer as accepted
    const [offer] = await this.db(this.tableName)
      .where('id', offerId)
      .update({
        status: 'accepted',
        updated_at: new Date(),
      })
      .returning('*');

    // Mark all other active offers in this deal as withdrawn
    await this.db(this.tableName)
      .where('deal_id', offer.deal_id)
      .where('id', '!=', offerId)
      .where('status', 'active')
      .update({
        status: 'withdrawn',
        updated_at: new Date(),
      });

    return offer;
  }

  static async withdrawOffer(offerId: string): Promise<Offer> {
    const [offer] = await this.db(this.tableName)
      .where('id', offerId)
      .update({
        status: 'withdrawn',
        updated_at: new Date(),
      })
      .returning('*');
    
    return offer;
  }

  static async getActiveOffer(dealId: string, userId: string): Promise<Offer | null> {
    return this.db(this.tableName)
      .where('deal_id', dealId)
      .where('from_user_id', userId)
      .where('status', 'active')
      .first();
  }

  static async findByDealId(dealId: string): Promise<Offer[]> {
    return this.db(this.tableName)
      .where('deal_id', dealId)
      .orderBy('created_at', 'asc');
  }

  static async getById(offerId: string): Promise<Offer | null> {
    return this.db(this.tableName)
      .where('id', offerId)
      .first();
  }
}
