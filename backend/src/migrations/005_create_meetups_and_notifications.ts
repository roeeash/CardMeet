import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Meetups table
  await knex.schema.createTable('meetups', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('deal_id').references('id').inTable('deals').onDelete('CASCADE');
    table.uuid('event_id').references('id').inTable('events').onDelete('CASCADE');
    table.timestamp('start_time').nullable();
    table.timestamp('end_time').nullable();
    table.string('proposed_window_start', 5).nullable(); // HH:MM format
    table.string('proposed_window_end', 5).nullable(); // HH:MM format
    table.text('location_note');
    table.enum('status', ['proposed', 'confirmed', 'scheduled', 'completed', 'no_show_buyer', 'no_show_seller', 'cancelled']).defaultTo('proposed');
    table.boolean('buyer_confirmed').defaultTo(false);
    table.boolean('seller_confirmed').defaultTo(false);
    table.boolean('buyer_checked_in').defaultTo(false);
    table.boolean('seller_checked_in').defaultTo(false);
    table.timestamp('buyer_checked_in_at').nullable();
    table.timestamp('seller_checked_in_at').nullable();
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
    table.timestamp('updated_at').defaultTo(knex.fn.now());

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
