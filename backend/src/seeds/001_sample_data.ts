import { Knex } from 'knex';
import bcrypt from 'bcryptjs';

export async function seed(knex: Knex): Promise<void> {
  // Clean existing data
  await knex('notifications').del();
  await knex('meetups').del();
  await knex('offers').del();
  await knex('deals').del();
  await knex('listings').del();
  await knex('event_rsvps').del();
  await knex('events').del();
  await knex('user_profiles').del();
  await knex('users').del();

  // Create sample users
  const passwordHash = await bcrypt.hash('password123', 12);
  
  const [user1] = await knex('users').insert({
    email: 'alice@example.com',
    password_hash: passwordHash,
  }).returning('*');

  const [user2] = await knex('users').insert({
    email: 'bob@example.com',
    password_hash: passwordHash,
  }).returning('*');

  const [user3] = await knex('users').insert({
    email: 'charlie@example.com',
    password_hash: passwordHash,
  }).returning('*');

  // Create user profiles
  await knex('user_profiles').insert([
    {
      user_id: user1.id,
      display_name: 'Alice Collector',
      avatar_url: null,
      location_lat: 32.0853,
      location_lng: 34.7818,
      travel_radius_km: 50,
      games: ['mtg', 'pokemon'],
      rating: 5.0,
      completed_deals: 12,
      no_shows: 0,
    },
    {
      user_id: user2.id,
      display_name: 'Bob Trader',
      avatar_url: null,
      location_lat: 32.0753,
      location_lng: 34.7718,
      travel_radius_km: 75,
      games: ['mtg', 'yugioh'],
      rating: 4.8,
      completed_deals: 8,
      no_shows: 1,
    },
    {
      user_id: user3.id,
      display_name: 'Charlie Player',
      avatar_url: null,
      location_lat: 32.0953,
      location_lng: 34.7918,
      travel_radius_km: 100,
      games: ['pokemon', 'lorcana'],
      rating: 4.5,
      completed_deals: 15,
      no_shows: 0,
    },
  ]);

  // Create sample events
  const [event1] = await knex('events').insert({
    name: 'Tel Aviv Magic Tournament',
    description: 'Standard format tournament with prizes',
    location_name: 'Tel Aviv Convention Center',
    location_lat: 32.0853,
    location_lng: 34.7818,
    start_date: new Date('2024-06-15T10:00:00Z'),
    end_date: new Date('2024-06-15T18:00:00Z'),
    games: ['mtg'],
    event_type: 'tournament',
    status: 'active',
    created_by: user1.id,
  }).returning('*');

  const [event2] = await knex('events').insert({
    name: 'Pokémon Sunday FNM',
    description: 'Casual Pokémon gathering',
    location_name: 'Jerusalem Gaming Center',
    location_lat: 31.7683,
    location_lng: 35.2137,
    start_date: new Date('2024-06-20T14:00:00Z'),
    end_date: new Date('2024-06-20T20:00:00Z'),
    games: ['pokemon'],
    event_type: 'fnm',
    status: 'active',
    created_by: user3.id,
  }).returning('*');

  // Create RSVPs
  await knex('event_rsvps').insert([
    {
      user_id: user1.id,
      event_id: event1.id,
      status: 'going',
    },
    {
      user_id: user2.id,
      event_id: event1.id,
      status: 'going',
    },
    {
      user_id: user3.id,
      event_id: event2.id,
      status: 'going',
    },
  ]);

  // Create sample listings
  const [listing1] = await knex('listings').insert({
    seller_id: user1.id,
    card_name: 'Black Lotus',
    card_set: 'Alpha',
    condition: 'nm',
    price_cents: 500000, // $5000
    currency: 'ILS',
    image_url: null,
    description: 'Original Alpha Black Lotus, near mint condition',
    game: 'mtg',
    status: 'active',
  }).returning('*');

  const [listing2] = await knex('listings').insert({
    seller_id: user2.id,
    card_name: 'Charizard',
    card_set: 'Base Set',
    condition: 'lp',
    price_cents: 150000, // $1500
    currency: 'ILS',
    image_url: null,
    description: 'First edition Charizard, some play wear',
    game: 'pokemon',
    status: 'active',
  }).returning('*');

  console.log('Sample data seeded successfully!');
}
