import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { BaseModel } from '../BaseModel';
import { User, UserProfile } from '@shared/types/user';

type UserRow = User & { password_hash: string };

export class UserModel extends BaseModel {
  static tableName = 'users';

  static async findByEmail(email: string): Promise<UserRow | null> {
    return this.db(this.tableName).where('email', email).first();
  }

  static async findById(id: string): Promise<UserRow | null> {
    return this.db(this.tableName).where('id', id).first();
  }

  static async create(userData: {
    email: string;
    password: string;
  }): Promise<User> {
    const passwordHash = await bcrypt.hash(userData.password, 12);
    
    const [user] = await this.db(this.tableName)
      .insert({
        email: userData.email,
        password_hash: passwordHash,
      })
      .returning('*');
    
    return user;
  }

  static async verifyPassword(email: string, password: string): Promise<UserRow | null> {
    const user = await this.findByEmail(email);
    if (!user) return null;

    const isValid = await bcrypt.compare(password, user.password_hash);
    return isValid ? user : null;
  }

  static async generateTokens(user: User): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: '7d' }
    );

    return { accessToken, refreshToken };
  }

  static async verifyToken(token: string, isRefresh = false): Promise<any> {
    const secret = isRefresh 
      ? process.env.JWT_REFRESH_SECRET 
      : process.env.JWT_SECRET;
    
    return jwt.verify(token, secret!);
  }
}

export class UserProfileModel extends BaseModel {
  static tableName = 'user_profiles';

  static async findByUserId(userId: string): Promise<UserProfile | null> {
    return this.db(this.tableName).where('user_id', userId).first();
  }

  static async createProfile(profileData: Partial<UserProfile>): Promise<UserProfile> {
    const [profile] = await this.db(this.tableName)
      .insert({
        ...profileData,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    
    return profile;
  }

  static async updateProfile(userId: string, data: Partial<UserProfile>): Promise<UserProfile> {
    const [profile] = await this.db(this.tableName)
      .where('user_id', userId)
      .update({
        ...data,
        updated_at: new Date(),
      })
      .returning('*');
    
    return profile;
  }

  static async findNearbyUsers(
    lat: number,
    lng: number,
    radiusKm: number,
    games: string[] = []
  ): Promise<UserProfile[]> {
    // MVP: Use simple lat/lng range checks instead of PostGIS
    // Phase 3 will implement precise geographic distance calculations
    const latDelta = radiusKm / 111; // Approx km per degree latitude
    const lngDelta = radiusKm / (111 * Math.cos(lat * Math.PI / 180)); // Approx km per degree longitude

    const query = this.db(this.tableName)
      .select('*')
      .where('location_lat', '>=', lat - latDelta)
      .where('location_lat', '<=', lat + latDelta)
      .where('location_lng', '>=', lng - lngDelta)
      .where('location_lng', '<=', lng + lngDelta);

    if (games.length > 0) {
      query.whereRaw('games && ?', [games]);
    }

    return query;
  }

  static async updateReputation(
    userId: string,
    completedDeals: number,
    noShows: number
  ): Promise<UserProfile> {
    const rating = Math.max(1.0, 5.0 - (noShows * 0.5));
    
    const [profile] = await this.db(this.tableName)
      .where('user_id', userId)
      .update({
        completed_deals: completedDeals,
        no_shows: noShows,
        rating: Math.round(rating * 100) / 100,
        updated_at: new Date(),
      })
      .returning('*');
    
    return profile;
  }
}
