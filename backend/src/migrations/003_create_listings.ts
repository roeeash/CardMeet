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
