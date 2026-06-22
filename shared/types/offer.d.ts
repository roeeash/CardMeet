export interface Offer {
    id: string;
    dealId: string;
    fromUserId: string;
    priceCents: number;
    note?: string;
    status: OfferStatus;
    createdAt: Date;
    updatedAt: Date;
}
export type OfferStatus = 'active' | 'accepted' | 'withdrawn' | 'countered';
//# sourceMappingURL=offer.d.ts.map