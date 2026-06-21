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

}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_profiles');
  await knex.schema.dropTableIfExists('users');
}
