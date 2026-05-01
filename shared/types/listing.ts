import { Game } from './user';

export interface Listing {
  id: string;
  sellerId: string;
  cardName: string;
  cardSet?: string;
  condition: CardCondition;
  priceCents: number;
  currency: string;
  imageUrl?: string;
  description?: string;
  game: Game;
  status: ListingStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type CardCondition = 'nm' | 'lp' | 'mp' | 'hp';
export type ListingStatus = 'active' | 'sold' | 'withdrawn';
