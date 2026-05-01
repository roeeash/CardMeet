export interface Meetup {
  id: string;
  dealId: string;
  eventId: string;
  startTime: Date;
  endTime: Date;
  locationNote?: string;
  status: MeetupStatus;
  buyerConfirmed: boolean;
  sellerConfirmed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type MeetupStatus = 'scheduled' | 'completed' | 'no_show_buyer' | 'no_show_seller' | 'cancelled';
