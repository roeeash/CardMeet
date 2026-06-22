import { Game } from './user';
export interface Event {
    id: string;
    name: string;
    description?: string;
    locationName: string;
    locationLat: number;
    locationLng: number;
    startDate: Date;
    endDate: Date;
    games: Game[];
    eventType: EventType;
    status: EventStatus;
    createdBy?: string;
    createdAt: Date;
    updatedAt: Date;
}
export type EventType = 'tournament' | 'convention' | 'fnm';
export type EventStatus = 'active' | 'cancelled' | 'completed';
export interface EventRSVP {
    id: string;
    userId: string;
    eventId: string;
    status: RSVPStatus;
    createdAt: Date;
    updatedAt: Date;
}
export type RSVPStatus = 'going' | 'maybe' | 'no';
//# sourceMappingURL=event.d.ts.map