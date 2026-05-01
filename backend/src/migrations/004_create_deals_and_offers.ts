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
