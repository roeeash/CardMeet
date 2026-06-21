import knex from './src/config/database';

async function verifyData() {
  // Check roee user
  const roeeUser = await knex('users').where({ email: 'roee@example.com' }).first();
  console.log('=== ROEE USER ===');
  console.log(JSON.stringify(roeeUser, null, 2));

  // Check roee profile
  if (roeeUser) {
    const roeeProfile = await knex('user_profiles').where({ user_id: roeeUser.id }).first();
    console.log('\n=== ROEE PROFILE ===');
    console.log(JSON.stringify(roeeProfile, null, 2));
  }

  // Check events
  console.log('\n=== EVENTS ===');
  const events = await knex('events').select('*');
  console.log(JSON.stringify(events, null, 2));

  // Check event count and coordinates
  console.log('\n=== EVENT SUMMARY ===');
  events.forEach((e: any) => {
    console.log(`${e.name}: (${e.location_lat}, ${e.location_lng}) - status: ${e.status}, type: ${e.event_type}, games: ${e.games}`);
  });

  // Check listings
  console.log('\n=== LISTINGS COUNT ===');
  const listings = await knex('listings').select('*');
  console.log(`Total listings: ${listings.length}`);
  
  // Group by game
  const gameGroups: Record<string, number> = {};
  listings.forEach((l: any) => {
    gameGroups[l.game] = (gameGroups[l.game] || 0) + 1;
  });
  console.log('By game:', gameGroups);

  // Check listing prices and names
  console.log('\n=== SAMPLE LISTINGS ===');
  listings.slice(0, 5).forEach((l: any) => {
    console.log(`${l.card_name} (${l.game}): ${l.price_cents}¢ - ${l.condition}`);
  });

  // Check RSVPs
  console.log('\n=== RSVP COUNT ===');
  const rsvps = await knex('event_rsvps').select('*');
  console.log(`Total RSVPs: ${rsvps.length}`);
  console.log(JSON.stringify(rsvps, null, 2));

  process.exit(0);
}

verifyData().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
