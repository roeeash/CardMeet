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

  const [roee] = await knex('users').insert({
    email: 'roee@example.com',
    password_hash: passwordHash,
  }).returning('*');

  const [alice] = await knex('users').insert({
    email: 'alice@example.com',
    password_hash: passwordHash,
  }).returning('*');

  const [bob] = await knex('users').insert({
    email: 'bob@example.com',
    password_hash: passwordHash,
  }).returning('*');

  const [charlie] = await knex('users').insert({
    email: 'charlie@example.com',
    password_hash: passwordHash,
  }).returning('*');

  // Create user profiles
  await knex('user_profiles').insert([
    {
      user_id: roee.id,
      display_name: 'Roee A.',
      avatar_url: null,
      location_lat: 32.0853,
      location_lng: 34.7818,
      travel_radius_km: 75,
      games: ['mtg', 'pokemon'],
      rating: 4.9,
      completed_deals: 17,
      no_shows: 0,
    },
    {
      user_id: alice.id,
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
      user_id: bob.id,
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
      user_id: charlie.id,
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

  // Create sample events in Tel Aviv
  const [event1] = await knex('events').insert({
    name: 'Friday Night Magic (FNM)',
    description: 'Weekly Friday Night Magic gathering',
    location_name: 'Tel Aviv',
    location_lat: 32.0853,
    location_lng: 34.7818,
    start_date: new Date('2026-06-26T19:00:00Z'),
    end_date: new Date('2026-06-26T23:00:00Z'),
    games: ['mtg'],
    event_type: 'fnm',
    status: 'active',
    created_by: roee.id,
  }).returning('*');

  const [event2] = await knex('events').insert({
    name: 'Pokémon Regional Championship',
    description: 'Pokémon TCG Regional Tournament',
    location_name: 'Tel Aviv',
    location_lat: 32.0853,
    location_lng: 34.7818,
    start_date: new Date('2026-06-23T09:00:00Z'),
    end_date: new Date('2026-06-25T18:00:00Z'),
    games: ['pokemon'],
    event_type: 'tournament',
    status: 'active',
    created_by: roee.id,
  }).returning('*');

  const [event3] = await knex('events').insert({
    name: 'Grand Prix Tel Aviv',
    description: 'Premium Magic tournament with top players',
    location_name: 'Tel Aviv',
    location_lat: 32.0853,
    location_lng: 34.7818,
    start_date: new Date('2026-07-03T10:00:00Z'),
    end_date: new Date('2026-07-05T18:00:00Z'),
    games: ['mtg'],
    event_type: 'tournament',
    status: 'active',
    created_by: roee.id,
  }).returning('*');

  // Create RSVPs
  await knex('event_rsvps').insert([
    // roee 'going' to all 3 events
    {
      user_id: roee.id,
      event_id: event1.id,
      status: 'going',
    },
    {
      user_id: roee.id,
      event_id: event2.id,
      status: 'going',
    },
    {
      user_id: roee.id,
      event_id: event3.id,
      status: 'going',
    },
    // alice 'going' to events 1 & 3 (FNM & GP)
    {
      user_id: alice.id,
      event_id: event1.id,
      status: 'going',
    },
    {
      user_id: alice.id,
      event_id: event3.id,
      status: 'going',
    },
    // bob 'going' to event 1 (FNM)
    {
      user_id: bob.id,
      event_id: event1.id,
      status: 'going',
    },
    // charlie 'going' to event 2 (Pokémon Regional)
    {
      user_id: charlie.id,
      event_id: event2.id,
      status: 'going',
    },
  ]);

  // Create sample listings
  await knex('listings').insert([
    // Alice's listings
    {
      seller_id: alice.id,
      card_name: 'Jace, the Mind Sculptor',
      card_set: 'Worldwake',
      condition: 'nm',
      price_cents: 250000, // 2500₪
      currency: 'ILS',
      image_url: null,
      description: 'Near mint condition Jace, the Mind Sculptor from Worldwake',
      game: 'mtg',
      status: 'active',
    },
    {
      seller_id: alice.id,
      card_name: 'Questing Beast',
      card_set: 'Modern Horizons 2',
      condition: 'lp',
      price_cents: 180000, // 1800₪
      currency: 'ILS',
      image_url: null,
      description: 'Light play Questing Beast from Modern Horizons 2',
      game: 'mtg',
      status: 'active',
    },
    {
      seller_id: alice.id,
      card_name: 'Blue-Eyes White Dragon',
      card_set: 'LOB-001',
      condition: 'nm',
      price_cents: 120000, // 1200₪
      currency: 'ILS',
      image_url: null,
      description: 'Classic Blue-Eyes White Dragon in near mint condition',
      game: 'yugioh',
      status: 'active',
    },
    {
      seller_id: alice.id,
      card_name: 'Ursula, the Sea Witch',
      card_set: 'Rise of the Floodborn',
      condition: 'lp',
      price_cents: 75000, // 750₪
      currency: 'ILS',
      image_url: null,
      description: 'Light play Lorcana Ursula card',
      game: 'lorcana',
      status: 'active',
    },
    // Bob's listings
    {
      seller_id: bob.id,
      card_name: 'Black Lotus',
      card_set: 'Alpha',
      condition: 'nm',
      price_cents: 500000, // 5000₪
      currency: 'ILS',
      image_url: null,
      description: 'Original Alpha Black Lotus in near mint condition',
      game: 'mtg',
      status: 'active',
    },
    {
      seller_id: bob.id,
      card_name: 'Mox Sapphire',
      card_set: 'Beta',
      condition: 'lp',
      price_cents: 450000, // 4500₪
      currency: 'ILS',
      image_url: null,
      description: 'Beta Mox Sapphire with light play',
      game: 'mtg',
      status: 'active',
    },
    {
      seller_id: bob.id,
      card_name: 'Dark Magician',
      card_set: 'SDY-006',
      condition: 'lp',
      price_cents: 95000, // 950₪
      currency: 'ILS',
      image_url: null,
      description: 'Light play Dark Magician from starter deck',
      game: 'yugioh',
      status: 'active',
    },
    {
      seller_id: bob.id,
      card_name: 'Red-Eyes B. Dragon',
      card_set: 'SDK-001',
      condition: 'mp',
      price_cents: 60000, // 600₪
      currency: 'ILS',
      image_url: null,
      description: 'Moderate play Red-Eyes Black Dragon',
      game: 'yugioh',
      status: 'active',
    },
    // Charlie's listings
    {
      seller_id: charlie.id,
      card_name: 'Charizard Holo',
      card_set: 'Base Set',
      condition: 'lp',
      price_cents: 150000, // 1500₪
      currency: 'ILS',
      image_url: null,
      description: 'First edition Charizard holo with light play',
      game: 'pokemon',
      status: 'active',
    },
    {
      seller_id: charlie.id,
      card_name: 'Blastoise',
      card_set: 'Base Set',
      condition: 'mp',
      price_cents: 80000, // 800₪
      currency: 'ILS',
      image_url: null,
      description: 'Blastoise from Base Set with moderate play',
      game: 'pokemon',
      status: 'active',
    },
    {
      seller_id: charlie.id,
      card_name: 'Pikachu Illustrator',
      card_set: 'Pikachu',
      condition: 'nm',
      price_cents: 300000, // 3000₪
      currency: 'ILS',
      image_url: null,
      description: 'Rare Pikachu Illustrator card in near mint condition',
      game: 'pokemon',
      status: 'active',
    },
    {
      seller_id: charlie.id,
      card_name: 'Eowyn, Lady of Rohan',
      card_set: 'The Return of the King',
      condition: 'nm',
      price_cents: 100000, // 1000₪
      currency: 'ILS',
      image_url: null,
      description: 'Beautiful Lorcana Eowyn card in near mint condition',
      game: 'lorcana',
      status: 'active',
    },
  ]);

  console.log('Sample data seeded successfully!');
}
