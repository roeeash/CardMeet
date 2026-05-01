# Instruction 2: Database Setup & Models

## Overview
This instruction covers the complete database implementation including schema creation, migration files, data models with validations, and seeding scripts. We'll implement the full PostgreSQL database with PostGIS for geospatial queries.

## 2.1 Database Schema Implementation

### Create Migration Files

```bash
# Navigate to backend directory
cd backend

# Create migrations directory
mkdir -p src/migrations src/seeds

# Create initial migration
npx knex migrate:make create_initial_schema --knexfile knexfile.ts
```

### Users and Profiles Migration
```typescript
// backend/src/migrations/001_create_users_and_profiles.ts
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Users table
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('email', 255).unique().notNullable();
    table.string('password_hash', 255).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['email']);
  });

  // User profiles table
  await knex.schema.createTable('user_profiles', (table) => {
    table.uuid('user_id').primary().references('id').inTable('users').onDelete('CASCADE');
    table.string('display_name', 100).notNullable();
    table.text('avatar_url');
    table.decimal('location_lat', 10, 8).notNullable();
    table.decimal('location_lng', 11, 8).notNullable();
    table.integer('travel_radius_km').notNullable().defaultTo(50);
    table.specificType('games', 'text[]').notNullable();
    table.decimal('rating', 3, 2).defaultTo(5.0);
    table.integer('completed_deals').defaultTo(0);
    table.integer('no_shows').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['location_lat', 'location_lng']);
    table.index(['games']);
  });

  // Add PostGIS extension for geospatial queries
  await knex.raw('CREATE EXTENSION IF NOT EXISTS postgis');
  
  // Add geospatial index for user locations
  await knex.raw(`
    CREATE INDEX idx_user_profiles_location 
    ON user_profiles 
    USING GIST (ST_Point(location_lng, location_lat))
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_profiles');
  await knex.schema.dropTableIfExists('users');
}
```

### Events and RSVPs Migration
```typescript
// backend/src/migrations/002_create_events_and_rsvps.ts
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Events table
  await knex.schema.createTable('events', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 255).notNullable();
    table.text('description');
    table.string('location_name', 255).notNullable();
    table.decimal('location_lat', 10, 8).notNullable();
    table.decimal('location_lng', 11, 8).notNullable();
    table.timestamp('start_date').notNullable();
    table.timestamp('end_date').notNullable();
    table.specificType('games', 'text[]').notNullable();
    table.enum('event_type', ['tournament', 'convention', 'fnm']).notNullable();
    table.enum('status', ['active', 'cancelled', 'completed']).defaultTo('active');
    table.uuid('created_by').references('id').inTable('users');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['start_date']);
    table.index(['event_type']);
    table.index(['status']);
    table.index(['games']);
  });

  // Add geospatial index for event locations
  await knex.raw(`
    CREATE INDEX idx_events_location 
    ON events 
    USING GIST (ST_Point(location_lng, location_lat))
  `);

  // Event RSVPs table
  await knex.schema.createTable('event_rsvps', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.uuid('event_id').references('id').inTable('events').onDelete('CASCADE');
    table.enum('status', ['going', 'maybe', 'no']).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Unique constraint
    table.unique(['user_id', 'event_id']);
    
    // Indexes
    table.index(['user_id']);
    table.index(['event_id']);
    table.index(['status']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('event_rsvps');
  await knex.schema.dropTableIfExists('events');
}
```

### Listings Migration
```typescript
// backend/src/migrations/003_create_listings.ts
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('listings', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('seller_id').references('id').inTable('users').onDelete('CASCADE');
    table.string('card_name', 255).notNullable();
    table.string('card_set', 100);
    table.enum('condition', ['nm', 'lp', 'mp', 'hp']).notNullable();
    table.integer('price_cents').notNullable();
    table.string('currency', 3).defaultTo('ILS');
    table.text('image_url');
    table.text('description');
    table.enum('game', ['mtg', 'pokemon', 'yugioh', 'lorcana']).notNullable();
    table.enum('status', ['active', 'sold', 'withdrawn']).defaultTo('active');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['seller_id', 'game', 'status']);
    table.index(['price_cents']);
    table.index(['created_at']);
    table.index(['card_name']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('listings');
}
```

### Deals and Offers Migration
```typescript
// backend/src/migrations/004_create_deals_and_offers.ts
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Deals table
  await knex.schema.createTable('deals', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('listing_id').references('id').inTable('listings').onDelete('CASCADE');
    table.uuid('buyer_id').references('id').inTable('users').onDelete('CASCADE');
    table.uuid('seller_id').references('id').inTable('users').onDelete('CASCADE');
    table.enum('status', ['negotiating', 'matched', 'scheduled', 'completed', 'cancelled']).notNullable();
    table.integer('current_price_cents');
    table.uuid('current_turn').references('id').inTable('users');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['buyer_id', 'status']);
    table.index(['seller_id', 'status']);
    table.index(['listing_id']);
    table.index(['current_turn']);
    table.index(['status']);
  });

  // Offers table
  await knex.schema.createTable('offers', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('deal_id').references('id').inTable('deals').onDelete('CASCADE');
    table.uuid('from_user_id').references('id').inTable('users').onDelete('CASCADE');
    table.integer('price_cents').notNullable();
    table.text('note');
    table.enum('status', ['active', 'accepted', 'withdrawn', 'countered']).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['deal_id', 'created_at']);
    table.index(['from_user_id']);
    table.index(['status']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('offers');
  await knex.schema.dropTableIfExists('deals');
}
```

### Meetups and Notifications Migration
```typescript
// backend/src/migrations/005_create_meetups_and_notifications.ts
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Meetups table
  await knex.schema.createTable('meetups', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('deal_id').references('id').inTable('deals').onDelete('CASCADE');
    table.uuid('event_id').references('id').inTable('events').onDelete('CASCADE');
    table.timestamp('start_time').notNullable();
    table.timestamp('end_time').notNullable();
    table.text('location_note');
    table.enum('status', ['scheduled', 'completed', 'no_show_buyer', 'no_show_seller', 'cancelled']).defaultTo('scheduled');
    table.boolean('buyer_confirmed').defaultTo(false);
    table.boolean('seller_confirmed').defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['deal_id']);
    table.index(['event_id']);
    table.index(['start_time']);
    table.index(['status']);
  });

  // Notifications table
  await knex.schema.createTable('notifications', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.enum('type', ['offer_received', 'deal_matched', 'meetup_reminder', 'meetup_confirmed', 'deal_completed']).notNullable();
    table.string('title', 255).notNullable();
    table.text('body').notNullable();
    table.jsonb('data');
    table.boolean('read').defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['user_id', 'read']);
    table.index(['created_at']);
    table.index(['type']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('notifications');
  await knex.schema.dropTableIfExists('meetups');
}
```

## 2.2 Data Models Implementation

### Base Model Class
```typescript
// backend/src/models/BaseModel.ts
import { Knex } from 'knex';

export abstract class BaseModel {
  protected static tableName: string;
  protected static db: Knex;

  static setDatabase(db: Knex) {
    this.db = db;
  }

  static async findById(id: string) {
    return this.db(this.tableName).where('id', id).first();
  }

  static async create(data: any) {
    const [result] = await this.db(this.tableName).insert(data).returning('*');
    return result;
  }

  static async update(id: string, data: any) {
    const [result] = await this.db(this.tableName)
      .where('id', id)
      .update({ ...data, updated_at: new Date() })
      .returning('*');
    return result;
  }

  static async delete(id: string) {
    return this.db(this.tableName).where('id', id).del();
  }

  static async findMany(conditions: any = {}, options: any = {}) {
    let query = this.db(this.tableName);

    // Apply conditions
    Object.entries(conditions).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        query = query.whereIn(key, value);
      } else {
        query = query.where(key, value);
      }
    });

    // Apply ordering
    if (options.orderBy) {
      query = query.orderBy(options.orderBy, options.orderDirection || 'asc');
    }

    // Apply pagination
    if (options.limit) {
      query = query.limit(options.limit);
    }
    if (options.offset) {
      query = query.offset(options.offset);
    }

    return query;
  }
}
```

### User Model
```typescript
// backend/src/models/User.ts
import { Knex } from 'knex';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { BaseModel } from './BaseModel';
import { User, UserProfile } from '@shared/types/user';

export class UserModel extends BaseModel {
  static tableName = 'users';

  static async findByEmail(email: string): Promise<User | null> {
    return this.db(this.tableName).where('email', email).first();
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

  static async verifyPassword(email: string, password: string): Promise<User | null> {
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
    const query = this.db(this.tableName)
      .select('*')
      .whereRaw(`
        ST_DWithin(
          ST_Point(location_lng, location_lat)::geography,
          ST_Point(?, ?)::geography,
          ?
        )
      `, [lng, lat, radiusKm * 1000]); // Convert km to meters

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
```

### Event Model
```typescript
// backend/src/models/Event.ts
import { Knex } from 'knex';
import { BaseModel } from './BaseModel';
import { Event, EventRSVP, EventType, EventStatus, RSVPStatus } from '@shared/types/event';

export class EventModel extends BaseModel {
  static tableName = 'events';

  static async findNearbyEvents(
    userLat: number,
    userLng: number,
    radiusKm: number,
    games: string[] = [],
    startDate?: Date,
    endDate?: Date
  ): Promise<Event[]> {
    let query = this.db(this.tableName)
      .select('*')
      .where('status', 'active')
      .whereRaw(`
        ST_DWithin(
          ST_Point(location_lng, location_lat)::geography,
          ST_Point(?, ?)::geography,
          ?
        )
      `, [userLng, userLat, radiusKm * 1000]);

    if (games.length > 0) {
      query.whereRaw('games && ?', [games]);
    }

    if (startDate) {
      query = query.where('start_date', '>=', startDate);
    }

    if (endDate) {
      query = query.where('end_date', '<=', endDate);
    }

    return query.orderBy('start_date', 'asc');
  }

  static async findByGameAndLocation(
    games: string[],
    userLat: number,
    userLng: number,
    radiusKm: number
  ): Promise<Event[]> {
    return this.db(this.tableName)
      .select('*')
      .where('status', 'active')
      .whereRaw('games && ?', [games])
      .whereRaw(`
        ST_DWithin(
          ST_Point(location_lng, location_lat)::geography,
          ST_Point(?, ?)::geography,
          ?
        )
      `, [userLng, userLat, radiusKm * 1000])
      .orderBy('start_date', 'asc');
  }

  static async createEvent(eventData: Partial<Event>): Promise<Event> {
    const [event] = await this.db(this.tableName)
      .insert({
        ...eventData,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    
    return event;
  }

  static async findSharedEvents(
    user1Id: string,
    user2Id: string
  ): Promise<Event[]> {
    return this.db(this.tableName)
      .select('events.*')
      .join('event_rsvps as rsvp1', function() {
        this.on('events.id', '=', 'rsvp1.event_id')
          .andOn('rsvp1.user_id', '=', this.db.raw('?', [user1Id]))
          .andOn('rsvp1.status', '=', this.db.raw('?', ['going']));
      })
      .join('event_rsvps as rsvp2', function() {
        this.on('events.id', '=', 'rsvp2.event_id')
          .andOn('rsvp2.user_id', '=', this.db.raw('?', [user2Id]))
          .andOn('rsvp2.status', '=', this.db.raw('?', ['going']));
      })
      .where('events.status', 'active')
      .where('events.start_date', '>=', new Date());
  }
}

export class EventRSVPModel extends BaseModel {
  static tableName = 'event_rsvps';

  static async getUserRSVPs(userId: string): Promise<EventRSVP[]> {
    return this.db(this.tableName)
      .select('event_rsvps.*', 'events.*')
      .join('events', 'event_rsvps.event_id', 'events.id')
      .where('event_rsvps.user_id', userId)
      .orderBy('events.start_date', 'asc');
  }

  static async setRSVP(
    userId: string,
    eventId: string,
    status: RSVPStatus
  ): Promise<EventRSVP> {
    const [rsvp] = await this.db(this.tableName)
      .insert({
        user_id: userId,
        event_id: eventId,
        status,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .onConflict(['user_id', 'event_id'])
      .merge({
        status,
        updated_at: new Date(),
      })
      .returning('*');
    
    return rsvp;
  }

  static async getEventAttendees(eventId: string): Promise<EventRSVP[]> {
    return this.db(this.tableName)
      .select('event_rsvps.*', 'user_profiles.*')
      .join('user_profiles', 'event_rsvps.user_id', 'user_profiles.user_id')
      .where('event_rsvps.event_id', eventId)
      .where('event_rsvps.status', 'going');
  }
}
```

### Listing Model
```typescript
// backend/src/models/Listing.ts
import { Knex } from 'knex';
import { BaseModel } from './BaseModel';
import { Listing, Game, ListingStatus } from '@shared/types/listing';

export class ListingModel extends BaseModel {
  static tableName = 'listings';

  static async findListingsForUser(
    userId: string,
    filters: {
      games?: Game[];
      locationLat?: number;
      locationLng?: number;
      radiusKm?: number;
      sharedEventsOnly?: boolean;
      minPrice?: number;
      maxPrice?: number;
      condition?: string[];
    } = {}
  ): Promise<Listing[]> {
    let query = this.db(this.tableName)
      .select('listings.*')
      .join('user_profiles', 'listings.seller_id', 'user_profiles.user_id')
      .where('listings.status', 'active')
      .where('listings.seller_id', '!=', userId);

    // Game filter
    if (filters.games && filters.games.length > 0) {
      query = query.whereIn('listings.game', filters.games);
    }

    // Location filter
    if (filters.locationLat && filters.locationLng && filters.radiusKm) {
      query = query.whereRaw(`
        ST_DWithin(
          ST_Point(user_profiles.location_lng, user_profiles.location_lat)::geography,
          ST_Point(?, ?)::geography,
          ?
        )
      `, [filters.locationLng, filters.locationLat, filters.radiusKm * 1000]);
    }

    // Price range
    if (filters.minPrice !== undefined) {
      query = query.where('listings.price_cents', '>=', filters.minPrice * 100);
    }
    if (filters.maxPrice !== undefined) {
      query = query.where('listings.price_cents', '<=', filters.maxPrice * 100);
    }

    // Condition filter
    if (filters.condition && filters.condition.length > 0) {
      query = query.whereIn('listings.condition', filters.condition);
    }

    // Shared events filter
    if (filters.sharedEventsOnly) {
      query = query.whereExists(function() {
        this.select('*')
          .from('events')
          .join('event_rsvps', 'events.id', 'event_rsvps.event_id')
          .whereRaw(`
            ST_DWithin(
              ST_Point(events.location_lng, events.location_lat)::geography,
              ST_Point(user_profiles.location_lng, user_profiles.location_lat)::geography,
              ?
            )
          `, [filters.radiusKm! * 1000])
          .where('event_rsvps.user_id', userId)
          .where('event_rsvps.status', 'going')
          .whereRaw('events.games && ?', [filters.games || ['mtg', 'pokemon', 'yugioh', 'lorcana']])
          .where('events.status', 'active')
          .where('events.start_date', '>=', new Date());
      });
    }

    return query.orderBy('listings.created_at', 'desc');
  }

  static async createListing(listingData: Partial<Listing>): Promise<Listing> {
    const [listing] = await this.db(this.tableName)
      .insert({
        ...listingData,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    
    return listing;
  }

  static async updateListingStatus(
    listingId: string,
    status: ListingStatus
  ): Promise<Listing> {
    const [listing] = await this.db(this.tableName)
      .where('id', listingId)
      .update({
        status,
        updated_at: new Date(),
      })
      .returning('*');
    
    return listing;
  }

  static async getSellerListings(sellerId: string): Promise<Listing[]> {
    return this.db(this.tableName)
      .where('seller_id', sellerId)
      .orderBy('created_at', 'desc');
  }
}
```

### Deal Model
```typescript
// backend/src/models/Deal.ts
import { Knex } from 'knex';
import { BaseModel } from './BaseModel';
import { Deal, DealStatus } from '@shared/types/deal';

export class DealModel extends BaseModel {
  static tableName = 'deals';

  static async createDeal(dealData: {
    listingId: string;
    buyerId: string;
    sellerId: string;
    initialPriceCents: number;
  }): Promise<Deal> {
    const [deal] = await this.db(this.tableName)
      .insert({
        listing_id: dealData.listingId,
        buyer_id: dealData.buyerId,
        seller_id: dealData.sellerId,
        status: 'negotiating',
        current_price_cents: dealData.initialPriceCents,
        current_turn: dealData.buyerId,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    
    return deal;
  }

  static async getUserDeals(userId: string): Promise<{
    negotiating: Deal[];
    matched: Deal[];
    scheduled: Deal[];
  }> {
    const allDeals = await this.db(this.tableName)
      .select('deals.*', 'listings.card_name', 'listings.game')
      .join('listings', 'deals.listing_id', 'listings.id')
      .where(function() {
        this.where('buyer_id', userId).orWhere('seller_id', userId);
      })
      .whereNot('status', 'completed')
      .whereNot('status', 'cancelled')
      .orderBy('updated_at', 'desc');

    return {
      negotiating: allDeals.filter(deal => deal.status === 'negotiating'),
      matched: allDeals.filter(deal => deal.status === 'matched'),
      scheduled: allDeals.filter(deal => deal.status === 'scheduled'),
    };
  }

  static async updateDealStatus(
    dealId: string,
    status: DealStatus,
    currentTurn?: string
  ): Promise<Deal> {
    const updateData: any = {
      status,
      updated_at: new Date(),
    };

    if (currentTurn) {
      updateData.current_turn = currentTurn;
    }

    const [deal] = await this.db(this.tableName)
      .where('id', dealId)
      .update(updateData)
      .returning('*');
    
    return deal;
  }

  static async getCurrentTurn(dealId: string): Promise<string | null> {
    const deal = await this.db(this.tableName)
      .select('current_turn')
      .where('id', dealId)
      .first();
    
    return deal?.current_turn || null;
  }
}
```

### Offer Model
```typescript
// backend/src/models/Offer.ts
import { Knex } from 'knex';
import { BaseModel } from './BaseModel';
import { Offer, OfferStatus } from '@shared/types/offer';

export class OfferModel extends BaseModel {
  static tableName = 'offers';

  static async createOffer(offerData: {
    dealId: string;
    fromUserId: string;
    priceCents: number;
    note?: string;
  }): Promise<Offer> {
    // First, mark all previous offers from this user as withdrawn
    await this.db(this.tableName)
      .where('deal_id', offerData.dealId)
      .where('from_user_id', offerData.fromUserId)
      .where('status', 'active')
      .update({
        status: 'withdrawn',
        updated_at: new Date(),
      });

    // Create new offer
    const [offer] = await this.db(this.tableName)
      .insert({
        deal_id: offerData.dealId,
        from_user_id: offerData.fromUserId,
        price_cents: offerData.priceCents,
        note: offerData.note,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    
    return offer;
  }

  static async getOfferChain(dealId: string): Promise<Offer[]> {
    return this.db(this.tableName)
      .where('deal_id', dealId)
      .orderBy('created_at', 'asc');
  }

  static async acceptOffer(offerId: string): Promise<Offer> {
    // Mark this offer as accepted
    const [offer] = await this.db(this.tableName)
      .where('id', offerId)
      .update({
        status: 'accepted',
        updated_at: new Date(),
      })
      .returning('*');

    // Mark all other active offers in this deal as withdrawn
    await this.db(this.tableName)
      .where('deal_id', offer.deal_id)
      .where('id', '!=', offerId)
      .where('status', 'active')
      .update({
        status: 'withdrawn',
        updated_at: new Date(),
      });

    return offer;
  }

  static async withdrawOffer(offerId: string): Promise<Offer> {
    const [offer] = await this.db(this.tableName)
      .where('id', offerId)
      .update({
        status: 'withdrawn',
        updated_at: new Date(),
      })
      .returning('*');
    
    return offer;
  }

  static async getActiveOffer(dealId: string, userId: string): Promise<Offer | null> {
    return this.db(this.tableName)
      .where('deal_id', dealId)
      .where('from_user_id', userId)
      .where('status', 'active')
      .first();
  }
}
```

### Meetup Model
```typescript
// backend/src/models/Meetup.ts
import { Knex } from 'knex';
import { BaseModel } from './BaseModel';
import { Meetup, MeetupStatus } from '@shared/types/meetup';

export class MeetupModel extends BaseModel {
  static tableName = 'meetups';

  static async createMeetup(meetupData: {
    dealId: string;
    eventId: string;
    startTime: Date;
    endTime: Date;
    locationNote?: string;
  }): Promise<Meetup> {
    const [meetup] = await this.db(this.tableName)
      .insert({
        deal_id: meetupData.dealId,
        event_id: meetupData.eventId,
        start_time: meetupData.startTime,
        end_time: meetupData.endTime,
        location_note: meetupData.locationNote,
        status: 'scheduled',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    
    return meetup;
  }

  static async confirmMeetup(meetupId: string, userId: string, isBuyer: boolean): Promise<Meetup> {
    const updateField = isBuyer ? 'buyer_confirmed' : 'seller_confirmed';
    
    const [meetup] = await this.db(this.tableName)
      .where('id', meetupId)
      .update({
        [updateField]: true,
        updated_at: new Date(),
      })
      .returning('*');
    
    return meetup;
  }

  static async completeMeetup(meetupId: string, status: MeetupStatus): Promise<Meetup> {
    const [meetup] = await this.db(this.tableName)
      .where('id', meetupId)
      .update({
        status,
        updated_at: new Date(),
      })
      .returning('*');
    
    return meetup;
  }

  static async getUserMeetups(userId: string): Promise<Meetup[]> {
    return this.db(this.tableName)
      .select('meetups.*', 'deals.buyer_id', 'deals.seller_id', 'events.name as event_name')
      .join('deals', 'meetups.deal_id', 'deals.id')
      .join('events', 'meetups.event_id', 'events.id')
      .where(function() {
        this.where('deals.buyer_id', userId).orWhere('deals.seller_id', userId);
      })
      .where('meetups.status', 'scheduled')
      .orderBy('meetups.start_time', 'asc');
  }

  static async findAvailableSlots(
    eventId: string,
    date: Date,
    durationMinutes: number = 30
  ): Promise<{ startTime: Date; endTime: Date }[]> {
    // Get existing meetups for this event on this date
    const existingMeetups = await this.db(this.tableName)
      .select('start_time', 'end_time')
      .where('event_id', eventId)
      .where('status', 'scheduled')
      .whereRaw('DATE(start_time) = ?', [date.toISOString().split('T')[0]])
      .orderBy('start_time', 'asc');

    // Generate available slots (9:00 AM to 9:00 PM)
    const availableSlots: { startTime: Date; endTime: Date }[] = [];
    const startOfDay = new Date(date);
    startOfDay.setHours(9, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(21, 0, 0, 0);

    let currentTime = new Date(startOfDay);
    
    while (currentTime.getTime() + durationMinutes * 60 * 1000 <= endOfDay.getTime()) {
      const slotEnd = new Date(currentTime.getTime() + durationMinutes * 60 * 1000);
      
      // Check if this slot conflicts with existing meetups
      const hasConflict = existingMeetups.some(meetup => {
        const meetupStart = new Date(meetup.start_time);
        const meetupEnd = new Date(meetup.end_time);
        
        return (
          (currentTime >= meetupStart && currentTime < meetupEnd) ||
          (slotEnd > meetupStart && slotEnd <= meetupEnd) ||
          (currentTime <= meetupStart && slotEnd >= meetupEnd)
        );
      });

      if (!hasConflict) {
        availableSlots.push({
          startTime: new Date(currentTime),
          endTime: new Date(slotEnd),
        });
      }

      // Move to next 30-minute slot
      currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000);
    }

    return availableSlots;
  }
}
```

### Notification Model
```typescript
// backend/src/models/Notification.ts
import { Knex } from 'knex';
import { BaseModel } from './BaseModel';
import { Notification, NotificationType } from '@shared/types/notification';

export class NotificationModel extends BaseModel {
  static tableName = 'notifications';

  static async createNotification(notificationData: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: any;
  }): Promise<Notification> {
    const [notification] = await this.db(this.tableName)
      .insert({
        user_id: notificationData.userId,
        type: notificationData.type,
        title: notificationData.title,
        body: notificationData.body,
        data: notificationData.data,
        created_at: new Date(),
      })
      .returning('*');
    
    return notification;
  }

  static async getUserNotifications(
    userId: string,
    limit = 20,
    offset = 0
  ): Promise<Notification[]> {
    return this.db(this.tableName)
      .where('user_id', userId)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);
  }

  static async markAsRead(notificationId: string): Promise<Notification> {
    const [notification] = await this.db(this.tableName)
      .where('id', notificationId)
      .update({
        read: true,
      })
      .returning('*');
    
    return notification;
  }

  static async markAllAsRead(userId: string): Promise<void> {
    await this.db(this.tableName)
      .where('user_id', userId)
      .where('read', false)
      .update({
        read: true,
      });
  }

  static async getUnreadCount(userId: string): Promise<number> {
    const result = await this.db(this.tableName)
      .count('id as count')
      .where('user_id', userId)
      .where('read', false)
      .first();
    
    return parseInt(result?.count || '0');
  }

  static async cleanupOldNotifications(daysOld = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    await this.db(this.tableName)
      .where('created_at', '<', cutoffDate)
      .where('read', true)
      .del();
  }
}
```

## 2.3 Database Seeding

### Seed Users and Profiles
```typescript
// backend/src/seeds/001_users.ts
import { Knex } from 'knex';
import { UserModel, UserProfileModel } from '../models';

export async function seed(knex: Knex): Promise<void> {
  // Clear existing data
  await knex('user_profiles').del();
  await knex('users').del();

  // Create test users
  const users = [
    {
      email: 'daniel@example.com',
      password: 'password123',
    },
    {
      email: 'sarah@example.com',
      password: 'password123',
    },
    {
      email: 'mike@example.com',
      password: 'password123',
    },
  ];

  const createdUsers = [];
  for (const userData of users) {
    const user = await UserModel.create(userData);
    createdUsers.push(user);
  }

  // Create user profiles
  const profiles = [
    {
      userId: createdUsers[0].id,
      displayName: 'Daniel Chen',
      locationLat: 32.0853,
      locationLng: 34.7818,
      travelRadiusKm: 75,
      games: ['mtg', 'pokemon'],
      rating: 4.9,
      completedDeals: 23,
      noShows: 0,
    },
    {
      userId: createdUsers[1].id,
      displayName: 'Sarah Miller',
      locationLat: 32.0853,
      locationLng: 34.7818,
      travelRadiusKm: 50,
      games: ['mtg', 'yugioh'],
      rating: 4.7,
      completedDeals: 15,
      noShows: 1,
    },
    {
      userId: createdUsers[2].id,
      displayName: 'Mike Johnson',
      locationLat: 32.0853,
      locationLng: 34.7818,
      travelRadiusKm: 100,
      games: ['pokemon', 'lorcana'],
      rating: 5.0,
      completedDeals: 8,
      noShows: 0,
    },
  ];

  for (const profileData of profiles) {
    await UserProfileModel.createProfile(profileData);
  }

  console.log('Seeded users and profiles');
}
```

### Seed Events
```typescript
// backend/src/seeds/002_events.ts
import { Knex } from 'knex';
import { EventModel } from '../models/Event';
import { EventRSVPModel } from '../models/Event';

export async function seed(knex: Knex): Promise<void> {
  // Clear existing data
  await knex('event_rsvps').del();
  await knex('events').del();

  // Create test events
  const events = [
    {
      name: 'FNM at Freaks',
      description: 'Friday Night Magic at Freaks Game Store',
      locationName: 'Freaks Game Store, Tel Aviv',
      locationLat: 32.0853,
      locationLng: 34.7818,
      startDate: new Date('2026-05-09T19:00:00Z'),
      endDate: new Date('2026-05-09T23:00:00Z'),
      games: ['mtg'],
      eventType: 'fnm',
      status: 'active',
    },
    {
      name: 'Pokémon Regional Cup',
      description: 'Official Pokémon Regional Championship',
      locationName: 'Herzliya Convention Center',
      locationLat: 32.1586,
      locationLng: 34.8447,
      startDate: new Date('2026-05-17T09:00:00Z'),
      endDate: new Date('2026-05-17T18:00:00Z'),
      games: ['pokemon'],
      eventType: 'tournament',
      status: 'active',
    },
    {
      name: 'GP Tel Aviv 2026',
      description: 'Magic: The Gathering Grand Prix Tel Aviv',
      locationName: 'Expo Tel Aviv',
      locationLat: 32.0853,
      locationLng: 34.7818,
      startDate: new Date('2026-05-22T09:00:00Z'),
      endDate: new Date('2026-05-24T20:00:00Z'),
      games: ['mtg'],
      eventType: 'convention',
      status: 'active',
    },
  ];

  const createdEvents = [];
  for (const eventData of events) {
    const event = await EventModel.createEvent(eventData);
    createdEvents.push(event);
  }

  // Get users for RSVPs
  const users = await knex('users').select('id');
  
  // Create RSVPs
  for (const event of createdEvents) {
    for (let i = 0; i < Math.min(users.length, 3); i++) {
      await EventRSVPModel.setRSVP(
        users[i].id,
        event.id,
        i === 0 ? 'going' : i === 1 ? 'maybe' : 'no'
      );
    }
  }

  console.log('Seeded events and RSVPs');
}
```

### Seed Listings
```typescript
// backend/src/seeds/003_listings.ts
import { Knex } from 'knex';
import { ListingModel } from '../models/Listing';

export async function seed(knex: Knex): Promise<void> {
  // Clear existing data
  await knex('listings').del();

  // Get users
  const users = await knex('users').select('id');

  // Create test listings
  const listings = [
    {
      sellerId: users[0].id,
      cardName: 'Liliana of the Veil',
      cardSet: 'Innistrad',
      condition: 'nm',
      priceCents: 26000, // ₪260
      currency: 'ILS',
      description: 'Near mint Liliana of the Veil from original Innistrad set.',
      game: 'mtg',
    },
    {
      sellerId: users[1].id,
      cardName: 'Charizard ex',
      cardSet: 'Obsidian Flames',
      condition: 'lp',
      priceCents: 18000, // ₪180
      currency: 'ILS',
      description: 'Lightly played Charizard ex, great condition for play.',
      game: 'pokemon',
    },
    {
      sellerId: users[0].id,
      cardName: 'Ragavan, Pilferer',
      cardSet: 'MH2',
      condition: 'nm',
      priceCents: 32000, // ₪320
      currency: 'ILS',
      description: 'Near mint Ragavan, one of the best red creatures in Modern.',
      game: 'mtg',
    },
    {
      sellerId: users[2].id,
      cardName: 'Solitude',
      cardSet: 'MH2',
      condition: 'nm',
      priceCents: 24000, // ₪240
      currency: 'ILS',
      description: 'Near mint Solitude, staple in white creature strategies.',
      game: 'mtg',
    },
  ];

  for (const listingData of listings) {
    await ListingModel.createListing(listingData);
  }

  console.log('Seeded listings');
}
```

## 2.4 Database Connection and Initialization

### Database Initialization Script
```typescript
// backend/src/config/database.ts
import { Knex } from 'knex';
import knexConfig from '../../knexfile';
import { pool } from './database';

export class Database {
  private static instance: Knex;
  
  static getInstance(): Knex {
    if (!Database.instance) {
      const environment = process.env.NODE_ENV || 'development';
      Database.instance = require('knex')(knexConfig[environment]);
      
      // Set database for all models
      this.setupModels();
    }
    
    return Database.instance;
  }

  private static setupModels(): void {
    const db = Database.instance;
    
    // Import all models and set their database instance
    const { UserModel, UserProfileModel } = require('../models/User');
    const { EventModel, EventRSVPModel } = require('../models/Event');
    const { ListingModel } = require('../models/Listing');
    const { DealModel } = require('../models/Deal');
    const { OfferModel } = require('../models/Offer');
    const { MeetupModel } = require('../models/Meetup');
    const { NotificationModel } = require('../models/Notification');

    // Set database instance for all models
    [UserModel, UserProfileModel, EventModel, EventRSVPModel, 
     ListingModel, DealModel, OfferModel, MeetupModel, NotificationModel].forEach(Model => {
      if (Model.setDatabase) {
        Model.setDatabase(db);
      }
    });
  }

  static async migrate(): Promise<void> {
    const db = Database.getInstance();
    await db.migrate.latest();
    console.log('Database migrations completed');
  }

  static async seed(): Promise<void> {
    const db = Database.getInstance();
    await db.seed.run();
    console.log('Database seeding completed');
  }

  static async close(): Promise<void> {
    if (Database.instance) {
      await Database.instance.destroy();
      Database.instance = null;
    }
  }
}
```

### Database Health Check
```typescript
// backend/src/utils/databaseHealth.ts
import { pool } from '../config/database';

export async function checkDatabaseHealth(): Promise<{
  status: 'healthy' | 'unhealthy';
  details: any;
}> {
  try {
    // Test basic connection
    const result = await pool.query('SELECT 1 as health_check');
    
    // Test PostGIS extension
    const postgisResult = await pool.query(
      'SELECT PostGIS_Version() as version'
    );
    
    // Check table counts
    const tableCounts = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM events) as events,
        (SELECT COUNT(*) FROM listings) as listings,
        (SELECT COUNT(*) FROM deals) as deals
    `);

    return {
      status: 'healthy',
      details: {
        connection: 'ok',
        postgis: postgisResult.rows[0]?.version,
        tables: tableCounts.rows[0],
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
    };
  }
}
```

## 2.5 Testing Database Models

### Model Tests
```typescript
// backend/tests/models/UserModel.test.ts
import { UserModel, UserProfileModel } from '../../src/models/User';
import { Database } from '../../src/config/database';

describe('UserModel', () => {
  beforeAll(async () => {
    await Database.migrate();
  });

  afterAll(async () => {
    await Database.close();
  });

  describe('create and find', () => {
    it('should create a user and find by email', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
      };

      const user = await UserModel.create(userData);
      expect(user.email).toBe(userData.email);
      expect(user.password_hash).toBeDefined();
      expect(user.password_hash).not.toBe(userData.password);

      const foundUser = await UserModel.findByEmail(userData.email);
      expect(foundUser?.email).toBe(userData.email);
    });

    it('should verify password correctly', async () => {
      const userData = {
        email: 'verify@example.com',
        password: 'password123',
      };

      await UserModel.create(userData);
      
      const validUser = await UserModel.verifyPassword(userData.email, userData.password);
      expect(validUser).toBeTruthy();

      const invalidUser = await UserModel.verifyPassword(userData.email, 'wrongpassword');
      expect(invalidUser).toBeFalsy();
    });
  });

  describe('user profiles', () => {
    it('should create and find user profile', async () => {
      const user = await UserModel.create({
        email: 'profile@example.com',
        password: 'password123',
      });

      const profileData = {
        userId: user.id,
        displayName: 'Test User',
        locationLat: 32.0853,
        locationLng: 34.7818,
        travelRadiusKm: 50,
        games: ['mtg', 'pokemon'],
      };

      const profile = await UserProfileModel.createProfile(profileData);
      expect(profile.displayName).toBe(profileData.displayName);
      expect(profile.games).toEqual(profileData.games);

      const foundProfile = await UserProfileModel.findByUserId(user.id);
      expect(foundProfile?.displayName).toBe(profileData.displayName);
    });
  });
});
```

## 2.6 Migration and Seed Scripts

### Package.json Scripts Update
```json
{
  "scripts": {
    "db:migrate": "knex migrate:latest --knexfile knexfile.ts",
    "db:rollback": "knex migrate:rollback --knexfile knexfile.ts",
    "db:seed": "knex seed:run --knexfile knexfile.ts",
    "db:reset": "npm run db:rollback:all && npm run db:migrate && npm run db:seed",
    "db:rollback:all": "knex migrate:rollback:all --knexfile knexfile.ts",
    "db:make:migration": "knex migrate:make --knexfile knexfile.ts",
    "db:make:seed": "knex seed:make --knexfile knexfile.ts",
    "db:health": "ts-node -e \"require('./src/utils/databaseHealth').checkDatabaseHealth().then(console.log)\""
  }
}
```

## Verification Checklist

- [ ] All migration files created and tested
- [ ] Database schema matches architecture specifications
- [ ] PostGIS extension properly configured
- [ ] All models implemented with proper validations
- [ ] Geospatial queries working correctly
- [ ] Database indexes created for performance
- [ ] Seed scripts populate test data
- [ ] Model tests passing
- [ ] Database health check working
- [ ] Migration rollback functionality tested
- [ ] Foreign key constraints enforced
- [ ] Connection pooling configured

## Next Steps

Proceed to **Instruction 3: Authentication & User Management** to implement JWT authentication, user registration/login flows, and profile management with proper security measures.
