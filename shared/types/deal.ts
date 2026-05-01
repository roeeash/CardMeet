export interface Deal {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  status: DealStatus;
  currentPriceCents?: number;
  currentTurn?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type DealStatus = 'negotiating' | 'matched' | 'scheduled' | 'completed' | 'cancelled';
