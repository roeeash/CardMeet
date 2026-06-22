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
    buyerCheckedIn: boolean;
    sellerCheckedIn: boolean;
    buyerCheckedInAt?: Date | null;
    sellerCheckedInAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
}
export type MeetupStatus = 'scheduled' | 'completed' | 'no_show_buyer' | 'no_show_seller' | 'cancelled';
//# sourceMappingURL=meetup.d.ts.map