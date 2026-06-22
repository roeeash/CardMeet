export interface User {
    id: string;
    email: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface UserProfile {
    userId: string;
    displayName: string;
    avatarUrl?: string;
    locationLat: number;
    locationLng: number;
    travelRadiusKm: number;
    games: Game[];
    rating: number;
    completedDeals: number;
    noShows: number;
    createdAt: Date;
    updatedAt: Date;
}
export type Game = 'mtg' | 'pokemon' | 'yugioh' | 'lorcana';
//# sourceMappingURL=user.d.ts.map