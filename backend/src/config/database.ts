import knex, { Knex } from 'knex';
import dotenv from 'dotenv';
import knexConfig from '../../knexfile';
import { BaseModel } from '@models/BaseModel';
import { UserModel, UserProfileModel } from '@models/user/User';
import { EventModel, EventRSVPModel } from '@models/event/Event';
import { ListingModel } from '@models/listing/Listing';
import { DealModel } from '@models/deal/Deal';
import { OfferModel } from '@models/deal/Offer';
import { MeetupModel } from '@models/meetup/Meetup';

dotenv.config();

export class Database {
  private static instance: Knex;

  static async ensureDatabase(): Promise<void> {
    try {
      const { ensureDatabaseExists } = await import('../scripts/init-database');
      await ensureDatabaseExists();
      console.log('[Database] Bootstrap phase completed');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[Database] Bootstrap failed: ${msg}`);
      throw error;
    }
  }

  static getInstance(): Knex {
    if (!Database.instance) {
      const env = process.env.NODE_ENV || 'development';
      Database.instance = knex(knexConfig[env]);
      Database.wireModels(Database.instance);
    }
    return Database.instance;
  }

  private static wireModels(db: Knex): void {
    [UserModel, UserProfileModel, EventModel, EventRSVPModel,
     ListingModel, DealModel, OfferModel, MeetupModel].forEach(
      (Model) => (Model as typeof BaseModel).setDatabase(db)
    );
  }

  static async migrate(): Promise<void> {
    await Database.getInstance().migrate.latest();
    console.log('Database migrations completed');
  }

  static async seed(): Promise<void> {
    await Database.getInstance().seed.run();
    console.log('Database seeding completed');
  }

  static async close(): Promise<void> {
    if (Database.instance) {
      await Database.instance.destroy();
      (Database as any).instance = null;
    }
  }
}
