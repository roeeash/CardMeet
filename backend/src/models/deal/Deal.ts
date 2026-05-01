import { Knex } from 'knex';
import { BaseModel } from '../BaseModel';
import { Deal, DealStatus } from '@shared/types/deal';

export class DealModel extends BaseModel {
  static tableName = 'deals';

  static async createDeal(dealData: {
    listingId: string;
    buyerId: string;
    sellerId: string;
    initialPriceCents: number;
  }): Promise<Deal> {
    const [deal] = await this.db(this.tableName)
      .insert({
        listing_id: dealData.listingId,
        buyer_id: dealData.buyerId,
        seller_id: dealData.sellerId,
        status: 'negotiating',
        current_price_cents: dealData.initialPriceCents,
        current_turn: dealData.buyerId,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    
    return deal;
  }

  static async getUserDeals(userId: string): Promise<{
    negotiating: Deal[];
    matched: Deal[];
    scheduled: Deal[];
  }> {
    const allDeals = await this.db(this.tableName)
      .select('deals.*', 'listings.card_name', 'listings.game')
      .join('listings', 'deals.listing_id', 'listings.id')
      .where(function() {
        this.where('buyer_id', userId).orWhere('seller_id', userId);
      })
      .whereNot('status', 'completed')
      .whereNot('status', 'cancelled')
      .orderBy('updated_at', 'desc');

    return {
      negotiating: allDeals.filter(deal => deal.status === 'negotiating'),
      matched: allDeals.filter(deal => deal.status === 'matched'),
      scheduled: allDeals.filter(deal => deal.status === 'scheduled'),
    };
  }

  static async updateDealStatus(
    dealId: string,
    status: DealStatus,
    currentTurn?: string
  ): Promise<Deal> {
    const updateData: any = {
      status,
      updated_at: new Date(),
    };

    if (currentTurn) {
      updateData.current_turn = currentTurn;
    }

    const [deal] = await this.db(this.tableName)
      .where('id', dealId)
      .update(updateData)
      .returning('*');
    
    return deal;
  }

  static async getCurrentTurn(dealId: string): Promise<string | null> {
    const deal = await this.db(this.tableName)
      .select('current_turn')
      .where('id', dealId)
      .first();
    
    return deal?.current_turn || null;
  }
}
