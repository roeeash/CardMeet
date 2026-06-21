import dotenv from 'dotenv';
import { Database } from './config/database';
import { server } from './app';

dotenv.config();

const PORT = process.env.PORT || 3001;

async function startServer(): Promise<void> {
  try {
    console.log('[Startup] Bootstrapping database...');
    await Database.ensureDatabase();

    server.listen(PORT, () => {
      console.log(`[Startup] CardMeet server listening on http://localhost:${PORT}`);
      console.log(`[Startup] Socket.IO ready for real-time connections`);
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[Startup] Fatal error: ${msg}`);
    process.exit(1);
  }
}

startServer();
