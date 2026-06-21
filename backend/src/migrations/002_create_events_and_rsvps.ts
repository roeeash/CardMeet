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
