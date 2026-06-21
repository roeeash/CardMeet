import knex from 'knex';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const db = knex({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'cardmeet_dev',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: { rejectUnauthorized: false },
  },
  pool: { min: 0, max: 2 },
  acquireConnectionTimeout: 10000,
});

async function testConnection() {
  try {
    console.log('🔍 Testing database connection...');
    console.log(`📍 Host: ${process.env.DB_HOST}`);
    console.log(`🗄️  Database: ${process.env.DB_NAME}`);
    
    // Test basic connection
    const result = await db.raw('SELECT NOW() as current_time');
    console.log('✅ Database connected successfully!');
    console.log(`🕐 Server time: ${result.rows[0].current_time}`);
    
    // Test if we can see tables
    const tables = await db.raw(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    if (tables.rows.length > 0) {
      console.log('📋 Existing tables:', tables.rows.map((t: any) => t.table_name).join(', '));
    } else {
      console.log('📋 No tables found - ready for migrations!');
    }
    
    await db.destroy();
    process.exit(0);
    
  } catch (error: any) {
    console.error('❌ Database connection failed:');
    console.error('Error:', error.message);
    console.error('Check your .env file settings');
    await db.destroy();
    process.exit(1);
  }
}

testConnection();
