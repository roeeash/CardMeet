export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  read: boolean;
  createdAt: Date;
}

export type NotificationType =
  | 'offer_received'
  | 'deal_matched'
  | 'meetup_reminder'
  | 'meetup_confirmed'
  | 'deal_completed';
