import { Game } from './user';

export interface Listing {
  id: string;
  seller_id: string;
  card_name: string;
  card_set?: string;
  condition: CardCondition;
  price_cents: number;
  currency: string;
  image_url?: string;
  description?: string;
  game: Game;
  status: ListingStatus;
  created_at: Date;
  updated_at: Date;
}

export type CardCondition = 'nm' | 'lp' | 'mp' | 'hp';
export type ListingStatus = 'active' | 'sold' | 'withdrawn';
