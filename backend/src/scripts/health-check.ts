import { checkDatabaseHealth } from '../utils/databaseHealth';

(async () => {
  const result = await checkDatabaseHealth();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === 'healthy' ? 0 : 1);
})();
